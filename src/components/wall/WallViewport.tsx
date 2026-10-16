import { animate, motion, useMotionValue, useVelocity, type AnimationPlaybackControls, type MotionValue } from 'motion/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { WallSwingContext } from './drag'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { clamp, cn } from '@/lib/utils'

export interface WallViewportHandle {
  zoomBy: (factor: number) => void
  reset: (animated?: boolean) => void
  focusElement: (el: HTMLElement, opts?: { minScreenWidth?: number; animated?: boolean }) => void
  pan: (dx: number, dy: number) => void
  scale: () => number
  /** Abort the in-progress pan/pinch (a note was picked up instead). */
  cancelGesture: () => void
}

interface Props {
  children: React.ReactNode
  /** When this changes the view re-fits (new period or view). */
  fitKey: string
  fit: 'contain' | 'width'
  level: MotionLevel
  label: string
  className?: string
  onScaleChange?: (s: number) => void
  /** Remember the user's pan/zoom per `fitKey` across visits. */
  persist?: boolean
  /** Controls rendered over the wall; receive the live scale without re-rendering the board. */
  overlay?: (scale: MotionValue<number>) => React.ReactNode
}

const STORE = 'dw-viewports'
type Saved = Record<string, { x: number; y: number; s: number; t: number }>
function readSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved
  } catch {
    return {}
  }
}
function writeSaved(key: string, v: { x: number; y: number; s: number } | null) {
  try {
    const all = readSaved()
    if (v) all[key] = { ...v, t: Date.now() }
    else delete all[key]
    // keep the 24 most recent views
    const keep = Object.entries(all).sort((a, b) => b[1].t - a[1].t).slice(0, 24)
    localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(keep)))
  } catch {
    /* storage unavailable */
  }
}

const MIN = 0.12
const MAX = 2.5
const TAP_SLOP = 7

/**
 * Pan & zoom surface. Pointer events give one code path for mouse, pen and touch:
 * one pointer pans (after a small slop, so taps still reach the notes), two pointers pinch,
 * the wheel zooms around the cursor, and releasing a pan glides with inertia.
 */
export const WallViewport = forwardRef<WallViewportHandle, Props>(function WallViewport(
  { children, fitKey, fit, level, label, className, onScaleChange, persist, overlay },
  ref,
) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  /** True while the view is the automatic fit, i.e. the user hasn't moved it yet. */
  const autoFit = useRef(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const s = useMotionValue(1)
  // shared with pinned notes so they swing when the wall moves (one velocity tracker for all)
  const vx = useVelocity(x)
  const vy = useVelocity(y)
  const vs = useVelocity(s)
  const swing = useMemo(() => ({ vx, vy, vs }), [vx, vy, vs])
  const anims = useRef<AnimationPlaybackControls[]>([])
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    mode: 'idle' | 'pending' | 'pan' | 'pinch'
    sx: number
    sy: number
    ox: number
    oy: number
    os: number
    d0: number
    mid: { x: number; y: number }
    samples: { t: number; x: number; y: number }[]
  }>({ mode: 'idle', sx: 0, sy: 0, ox: 0, oy: 0, os: 1, d0: 1, mid: { x: 0, y: 0 }, samples: [] })
  const dragged = useRef(false)
  const fitted = useRef<string | null>(null)

  const stop = () => {
    anims.current.forEach((a) => a.stop())
    anims.current = []
  }

  const sizes = useCallback(() => {
    const o = outer.current!
    const i = inner.current!
    return { cw: o.clientWidth, ch: o.clientHeight, bw: i.offsetWidth, bh: i.offsetHeight }
  }, [])

  const bounds = useCallback(
    (scale: number) => {
      const { cw, ch, bw, bh } = sizes()
      const w = bw * scale
      const h = bh * scale
      const mx = Math.min(cw * 0.4, 160)
      const my = Math.min(ch * 0.4, 160)
      return {
        minX: Math.min(cw - w - mx, (cw - w) / 2),
        maxX: Math.max(mx, (cw - w) / 2),
        minY: Math.min(ch - h - my, (ch - h) / 2),
        maxY: Math.max(my, (ch - h) / 2),
      }
    },
    [sizes],
  )

  const go = useCallback(
    (tx: number, ty: number, ts: number, animated: boolean) => {
      stop()
      const b = bounds(ts)
      tx = clamp(tx, b.minX, b.maxX)
      ty = clamp(ty, b.minY, b.maxY)
      if (!animated || level === 'off') {
        x.set(tx)
        y.set(ty)
        s.set(ts)
      } else {
        const t = level === 'reduced' ? { duration: 0.2 } : { type: 'spring' as const, stiffness: 170, damping: 26 }
        anims.current = [animate(x, tx, t), animate(y, ty, t), animate(s, ts, t)]
      }
      onScaleChange?.(ts)
    },
    [bounds, level, onScaleChange, s, x, y],
  )

  const fitView = useCallback(
    (animated: boolean) => {
      const { cw, ch, bw, bh } = sizes()
      if (!bw || !bh || !cw || !ch) return
      const pad = cw < 640 ? 0.97 : 0.92
      const sc = clamp(fit === 'width' ? Math.min((cw * pad) / bw, 1.1) : Math.min((cw * pad) / bw, (ch * pad) / bh, 1.1), MIN, MAX)
      const tx = (cw - bw * sc) / 2
      const ty = fit === 'width' && bh * sc > ch ? Math.min(16, (ch - bh * sc) / 2) : (ch - bh * sc) / 2
      go(tx, ty, sc, animated)
    },
    [fit, go, sizes],
  )

  const zoomAt = useCallback(
    (px: number, py: number, next: number, animated = false) => {
      const cur = s.get()
      next = clamp(next, MIN, MAX)
      const cx = (px - x.get()) / cur
      const cy = (py - y.get()) / cur
      go(px - cx * next, py - cy * next, next, animated)
    },
    [go, s, x, y],
  )

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (factor) => {
        autoFit.current = false
        const { cw, ch } = sizes()
        zoomAt(cw / 2, ch / 2, s.get() * factor, true)
      },
      reset: (animated = true) => {
        if (persist) writeSaved(fitKey, null)
        autoFit.current = true
        fitView(animated)
      },
      cancelGesture: () => {
        stop()
        pointers.current.clear()
        gesture.current.mode = 'idle'
        dragged.current = true
      },
      pan: (dx, dy) => {
        autoFit.current = false
        go(x.get() + dx, y.get() + dy, s.get(), true)
      },
      scale: () => s.get(),
      focusElement: (el, opts = {}) => {
        autoFit.current = false
        const i = inner.current!
        const { cw, ch } = sizes()
        // Offsets relative to the unscaled board
        let ox = 0
        let oy = 0
        let node: HTMLElement | null = el
        while (node && node !== i) {
          ox += node.offsetLeft
          oy += node.offsetTop
          node = node.offsetParent as HTMLElement | null
        }
        const ew = el.offsetWidth
        const eh = el.offsetHeight
        const want = opts.minScreenWidth ?? Math.min(cw * 0.42, 220)
        const sc = clamp(Math.max(s.get(), want / ew), MIN, MAX)
        go(cw / 2 - (ox + ew / 2) * sc, ch / 2 - (oy + eh / 2) * sc, sc, opts.animated ?? true)
      },
    }),
    [fitKey, fitView, go, persist, s, sizes, x, y, zoomAt],
  )

  // Fit whenever the content key changes, once the board has a size.
  useLayoutEffect(() => {
    if (fitted.current === fitKey) return
    const first = fitted.current === null
    fitted.current = fitKey
    const saved = persist ? readSaved()[fitKey] : undefined
    autoFit.current = !saved
    if (saved) go(saved.x, saved.y, clamp(saved.s, MIN, MAX), false)
    else fitView(!first)
  }, [fitKey, fitView, go, persist])

  // Save the view shortly after it settles.
  useEffect(() => {
    if (!persist) return
    let t: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      if (t === undefined) return
      clearTimeout(t)
      t = undefined
      if (fitted.current === fitKey) writeSaved(fitKey, { x: x.get(), y: y.get(), s: s.get() })
    }
    const save = () => {
      clearTimeout(t)
      t = setTimeout(flush, 400)
    }
    const offs = [x.on('change', save), y.on('change', save), s.on('change', save)]
    window.addEventListener('pagehide', flush)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      offs.forEach((o) => o())
    }
  }, [fitKey, persist, s, x, y])

  // Keep the board sensible when the window or board size changes. Until the user pans or zooms,
  // keep it fitted: boards whose content loads late (goals) would otherwise stay mis-framed.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (autoFit.current) return fitView(false)
      const b = bounds(s.get())
      x.set(clamp(x.get(), b.minX, b.maxX))
      y.set(clamp(y.get(), b.minY, b.maxY))
    })
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [bounds, fitView, s, x, y])

  // Wheel must be non-passive to prevent page zoom/scroll.
  useEffect(() => {
    const el = outer.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      autoFit.current = false
      const r = el.getBoundingClientRect()
      if (!e.ctrlKey && (Math.abs(e.deltaX) > 0.5 || e.shiftKey)) {
        go(x.get() - e.deltaX, y.get() - (e.shiftKey ? 0 : e.deltaY), s.get(), false)
        return
      }
      const k = e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.06 : 0.0018
      zoomAt(e.clientX - r.left, e.clientY - r.top, s.get() * Math.exp(-e.deltaY * k))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [go, s, x, y, zoomAt])

  const local = (e: React.PointerEvent) => {
    const r = outer.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const beginPinch = () => {
    const [a, b] = [...pointers.current.values()]
    const g = gesture.current
    g.mode = 'pinch'
    g.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1
    g.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    g.ox = x.get()
    g.oy = y.get()
    g.os = s.get()
  }

  const beginPan = (p: { x: number; y: number }) => {
    const g = gesture.current
    g.sx = p.x
    g.sy = p.y
    g.ox = x.get()
    g.oy = y.get()
    g.samples = [{ t: performance.now(), x: p.x, y: p.y }]
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    autoFit.current = false
    stop()
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    dragged.current = false
    if (pointers.current.size === 1) {
      gesture.current.mode = 'pending'
      beginPan(p)
    } else if (pointers.current.size === 2) {
      for (const id of pointers.current.keys()) outer.current!.setPointerCapture?.(id)
      dragged.current = true
      beginPinch()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current
    if (g.mode === 'pending' && Math.hypot(p.x - g.sx, p.y - g.sy) > TAP_SLOP) {
      g.mode = 'pan'
      dragged.current = true
      outer.current!.setPointerCapture?.(e.pointerId)
      beginPan(p)
    }
    if (g.mode === 'pan') {
      const b = bounds(s.get())
      // rubber-band past the edges
      const rx = g.ox + (p.x - g.sx)
      const ry = g.oy + (p.y - g.sy)
      x.set(rx < b.minX ? b.minX - (b.minX - rx) * 0.35 : rx > b.maxX ? b.maxX + (rx - b.maxX) * 0.35 : rx)
      y.set(ry < b.minY ? b.minY - (b.minY - ry) * 0.35 : ry > b.maxY ? b.maxY + (ry - b.maxY) * 0.35 : ry)
      const now = performance.now()
      g.samples.push({ t: now, x: p.x, y: p.y })
      while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift()
    } else if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const ns = clamp(g.os * (dist / g.d0), MIN, MAX)
      const cx = (g.mid.x - g.ox) / g.os
      const cy = (g.mid.y - g.oy) / g.os
      x.set(mid.x - cx * ns)
      y.set(mid.y - cy * ns)
      s.set(ns)
      onScaleChange?.(ns)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g.mode === 'pinch') {
      if (pointers.current.size === 1) {
        g.mode = 'pan'
        beginPan([...pointers.current.values()][0])
      } else if (pointers.current.size === 0) settle(0, 0)
      return
    }
    if (pointers.current.size > 0) return
    if (g.mode === 'pan') {
      const first = g.samples[0]
      const last = g.samples[g.samples.length - 1]
      const dt = Math.max(16, last.t - first.t)
      const vx = ((last.x - first.x) / dt) * 1000
      const vy = ((last.y - first.y) / dt) * 1000
      settle(vx, vy)
    }
    g.mode = 'idle'
  }

  const settle = (vx: number, vy: number) => {
    const b = bounds(s.get())
    if (level === 'off') {
      x.set(clamp(x.get(), b.minX, b.maxX))
      y.set(clamp(y.get(), b.minY, b.maxY))
      return
    }
    const base = { type: 'inertia' as const, power: level === 'full' ? 0.32 : 0.1, timeConstant: 280, bounceStiffness: 260, bounceDamping: 32 }
    anims.current = [
      animate(x, x.get(), { ...base, velocity: vx, min: b.minX, max: b.maxX }),
      animate(y, y.get(), { ...base, velocity: vy, min: b.minY, max: b.maxY }),
    ]
  }

  return (
    <div
      ref={outer}
      role="region"
      aria-label={label}
      aria-roledescription="zoomable wall"
      className={cn('wall-backdrop relative h-full w-full touch-none overflow-hidden select-none', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (dragged.current) {
          e.stopPropagation()
          e.preventDefault()
          dragged.current = false
        }
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        const r = outer.current!.getBoundingClientRect()
        zoomAt(e.clientX - r.left, e.clientY - r.top, s.get() * 1.6, true)
      }}
    >
      <motion.div ref={inner} className="absolute top-0 left-0 w-max will-change-transform" style={{ x, y, scale: s, originX: 0, originY: 0 }}>
        <WallSwingContext.Provider value={swing}>{children}</WallSwingContext.Provider>
      </motion.div>
      {overlay && (
        <div className="pointer-events-none absolute inset-0" onPointerDown={(e) => e.stopPropagation()}>
          {overlay(s)}
        </div>
      )}
    </div>
  )
})
