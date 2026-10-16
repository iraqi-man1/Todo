import { animate, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { DateKey } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { cn } from '@/lib/utils'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Offset {
  x: number
  y: number
}

export const SNAP = 8

/** Pure: snap, clamp to the allowed radius, then back off toward the previous spot until nothing overlaps. */
export function resolveOffset(
  target: Offset,
  previous: Offset,
  home: Rect,
  others: Rect[],
  limit: Offset,
  pad = 6,
): Offset {
  const snap = (v: number) => Math.round(v / SNAP) * SNAP
  const clampTo = (v: number, m: number) => Math.max(-m, Math.min(m, v))
  const collides = (o: Offset) =>
    others.some(
      (r) => home.x + o.x < r.x + r.w + pad && home.x + o.x + home.w + pad > r.x && home.y + o.y < r.y + r.h + pad && home.y + o.y + home.h + pad > r.y,
    )
  const want = { x: clampTo(snap(target.x), limit.x), y: clampTo(snap(target.y), limit.y) }
  for (let i = 0; i <= 12; i++) {
    const k = 1 - i / 12
    const o = { x: snap(previous.x + (want.x - previous.x) * k), y: snap(previous.y + (want.y - previous.y) * k) }
    if (!collides(o)) return o
  }
  return collides({ x: 0, y: 0 }) ? previous : { x: 0, y: 0 }
}

export interface SlotLayout {
  /** Rect of a date's slot in board coordinates, if on this board. */
  home: (date: DateKey) => Rect | undefined
  /** Rects of every other note currently on the board, including their own offsets. */
  obstacles: (date: DateKey) => Rect[]
  limit: Offset
  onMove: (date: DateKey, offset: Offset | undefined) => void
}

export const SlotLayoutContext = createContext<SlotLayout | null>(null)

export interface WallGesture {
  cancelPan: () => void
  scale: () => number
}
export const WallGestureContext = createContext<WallGesture | null>(null)

const HOLD_MS = { mouse: 170, touch: 280, pen: 220 } as const

/**
 * Lets a pinned note be picked up (press and hold) and nudged within its slot. While carried it tilts
 * with the cursor's speed and its shadow grows; on release it settles with a soft overshoot and a small
 * swing on its pin. A quick drag still pans the wall, and Alt+Arrow keys nudge it for keyboard users.
 */
export function DraggableNote({
  date,
  offset,
  level,
  enabled,
  amp = 1,
  children,
  className,
}: {
  date: DateKey
  offset?: Offset
  level: MotionLevel
  enabled: boolean
  /** Physics strength (0 disables tilt/swing; dragging still works). */
  amp?: number
  children: React.ReactNode
  className?: string
}) {
  const layout = useContext(SlotLayoutContext)
  const gesture = useContext(WallGestureContext)
  const x = useMotionValue(offset?.x ?? 0)
  const y = useMotionValue(offset?.y ?? 0)
  const tilt = useSpring(0, { stiffness: 260, damping: 16, mass: 0.6 })
  const lift = useSpring(0, { stiffness: 320, damping: 26 })
  const scale = useTransform(lift, (v) => 1 + v * 0.06)
  const shadowY = useTransform(lift, (v) => v * 20)
  const shadowOpacity = useTransform(lift, (v) => v * 0.55)
  const shadowScale = useTransform(lift, (v) => 0.9 + v * 0.18)
  const [lifted, setLifted] = useState(false)
  const st = useRef<{
    timer?: ReturnType<typeof setTimeout>
    sx: number
    sy: number
    base: Offset
    id: number | null
    suppress: boolean
    vx: number
    lx: number
    lt: number
    up: boolean
  }>({ sx: 0, sy: 0, base: { x: 0, y: 0 }, id: null, suppress: false, vx: 0, lx: 0, lt: 0, up: false })
  const active = enabled && !!layout && !!gesture

  // Follow external changes (undo, import, reset) when not being dragged.
  useEffect(() => {
    if (lifted) return
    const t = level === 'off' ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 22 }
    const a = [animate(x, offset?.x ?? 0, t), animate(y, offset?.y ?? 0, t)]
    return () => a.forEach((c) => c.stop())
  }, [offset?.x, offset?.y, lifted, level, x, y])

  const commit = (target: Offset) => {
    if (!layout) return
    const home = layout.home(date)
    if (!home) return
    const prev = offset ?? { x: 0, y: 0 }
    const next = resolveOffset(target, prev, home, layout.obstacles(date), layout.limit)
    // Settle: a little overshoot into place, then a damped swing on the pin.
    const t = level === 'off' ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 17, mass: 0.8 }
    animate(x, next.x, t)
    animate(y, next.y, t)
    if (amp > 0 && level !== 'off') {
      tilt.set(Math.max(-4, Math.min(4, -st.current.vx * 3)) * amp)
      setTimeout(() => tilt.set(0), 60)
    } else tilt.jump(0)
    if (next.x !== prev.x || next.y !== prev.y) layout.onMove(date, next.x === 0 && next.y === 0 ? undefined : next)
  }

  const clear = () => {
    clearTimeout(st.current.timer)
    st.current.timer = undefined
  }

  const drop = (target: Offset) => {
    if (!st.current.up) return
    st.current.up = false
    setLifted(false)
    lift.set(0)
    commit(target)
  }

  return (
    <motion.div
      className={cn('relative', lifted && 'z-30', className)}
      style={{ x, y }}
      onPointerDown={(e) => {
        if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return
        const s = st.current
        s.sx = e.clientX
        s.sy = e.clientY
        s.lx = e.clientX
        s.lt = performance.now()
        s.vx = 0
        s.id = e.pointerId
        s.base = { x: x.get(), y: y.get() }
        const target = e.currentTarget
        clear()
        s.timer = setTimeout(() => {
          gesture!.cancelPan()
          try {
            target.setPointerCapture(e.pointerId)
          } catch {
            /* pointer already released */
          }
          s.suppress = true
          s.up = true
          setLifted(true)
          lift.set(1)
          if (amp > 0) tilt.set(-1.5 * amp)
          navigator.vibrate?.(8)
        }, HOLD_MS[e.pointerType as keyof typeof HOLD_MS] ?? 220)
      }}
      onPointerMove={(e) => {
        const s = st.current
        if (!s.up) {
          if (s.timer && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 6) clear()
          return
        }
        e.stopPropagation()
        const k = gesture!.scale() || 1
        const lim = layout!.limit
        const nx = s.base.x + (e.clientX - s.sx) / k
        const ny = s.base.y + (e.clientY - s.sy) / k
        x.set(Math.max(-lim.x - 12, Math.min(lim.x + 12, nx)))
        y.set(Math.max(-lim.y - 12, Math.min(lim.y + 12, ny)))
        // Lean into the motion: smoothed horizontal speed → rotation (capped, so it never wobbles).
        const now = performance.now()
        const v = (e.clientX - s.lx) / Math.max(8, now - s.lt)
        s.vx = s.vx * 0.7 + v * 0.3
        s.lx = e.clientX
        s.lt = now
        if (amp > 0) tilt.set(Math.max(-8, Math.min(8, s.vx * 9)) * amp)
      }}
      onPointerUp={(e) => {
        clear()
        if (!st.current.up) return
        e.stopPropagation()
        drop({ x: x.get(), y: y.get() })
      }}
      onPointerCancel={() => {
        clear()
        drop(st.current.base)
      }}
      onLostPointerCapture={() => {
        // Interrupted drag (alt-tab, system gesture): put the note down where it was picked up.
        drop(st.current.base)
      }}
      onClickCapture={(e) => {
        if (st.current.suppress) {
          e.stopPropagation()
          e.preventDefault()
          st.current.suppress = false
        }
      }}
      onKeyDown={(e) => {
        if (!active || !e.altKey) return
        const step = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] }[e.key]
        if (!step) return
        e.preventDefault()
        e.stopPropagation()
        commit({ x: (offset?.x ?? 0) + step[0], y: (offset?.y ?? 0) + step[1] })
      }}
    >
      {/* The carried note's shadow on the wood: further and softer the higher it is lifted. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[4%] rounded-[30%]"
        style={{ y: shadowY, scale: shadowScale, opacity: shadowOpacity, background: 'radial-gradient(ellipse at 50% 55%, rgb(15 8 2 / 0.7), transparent 70%)' }}
      />
      <motion.div style={{ rotate: tilt, scale }} className={cn('relative', lifted && 'cursor-grabbing')}>
        {children}
      </motion.div>
    </motion.div>
  )
}
