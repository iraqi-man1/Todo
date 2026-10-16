import { animate, motion, useMotionValue } from 'motion/react'
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
 * Lets a pinned note be picked up (press and hold) and nudged within its slot. A quick drag still pans
 * the wall, and Alt+Arrow keys nudge it for keyboard users.
 */
export function DraggableNote({
  date,
  offset,
  level,
  enabled,
  children,
  className,
}: {
  date: DateKey
  offset?: Offset
  level: MotionLevel
  enabled: boolean
  children: React.ReactNode
  className?: string
}) {
  const layout = useContext(SlotLayoutContext)
  const gesture = useContext(WallGestureContext)
  const x = useMotionValue(offset?.x ?? 0)
  const y = useMotionValue(offset?.y ?? 0)
  const [lifted, setLifted] = useState(false)
  const st = useRef<{ timer?: ReturnType<typeof setTimeout>; sx: number; sy: number; base: Offset; id: number | null; suppress: boolean }>({
    sx: 0,
    sy: 0,
    base: { x: 0, y: 0 },
    id: null,
    suppress: false,
  })
  const active = enabled && !!layout && !!gesture

  // Follow external changes (undo, import, reset) when not being dragged.
  useEffect(() => {
    if (lifted) return
    const t = level === 'off' ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 30 }
    const a = [animate(x, offset?.x ?? 0, t), animate(y, offset?.y ?? 0, t)]
    return () => a.forEach((c) => c.stop())
  }, [offset?.x, offset?.y, lifted, level, x, y])

  const commit = (target: Offset) => {
    if (!layout) return
    const home = layout.home(date)
    if (!home) return
    const prev = offset ?? { x: 0, y: 0 }
    const next = resolveOffset(target, prev, home, layout.obstacles(date), layout.limit)
    const t = level === 'off' ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 28 }
    animate(x, next.x, t)
    animate(y, next.y, t)
    if (next.x !== prev.x || next.y !== prev.y) layout.onMove(date, next.x === 0 && next.y === 0 ? undefined : next)
  }

  const clear = () => {
    clearTimeout(st.current.timer)
    st.current.timer = undefined
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
          setLifted(true)
          navigator.vibrate?.(8)
        }, HOLD_MS[e.pointerType as keyof typeof HOLD_MS] ?? 220)
      }}
      onPointerMove={(e) => {
        const s = st.current
        if (!lifted) {
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
      }}
      onPointerUp={(e) => {
        clear()
        if (!lifted) return
        e.stopPropagation()
        setLifted(false)
        commit({ x: x.get(), y: y.get() })
      }}
      onPointerCancel={() => {
        clear()
        if (lifted) {
          setLifted(false)
          commit(st.current.base)
        }
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
      <motion.div
        animate={lifted ? { scale: 1.07, rotate: -1.5 } : { scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(lifted && 'cursor-grabbing drop-shadow-[0_22px_18px_rgb(20_10_0/0.45)]')}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
