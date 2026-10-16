import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

/** Spring presets shared by every paper interaction. Soft, a little overshoot, quick to settle. */
export const PAPER_SPRING = { stiffness: 220, damping: 14, mass: 0.6 }
export const SETTLE_SPRING = { stiffness: 300, damping: 18, mass: 0.7 }

/**
 * Hover physics for a sheet of paper.
 * - `tilt` (small notes): the sheet leans toward the pointer in 3D and sways around its top edge (the
 *   pin) with the pointer's sideways speed, like a draught catching it.
 * - always: lifts a little, its shadow grows and softens, and a faint highlight follows the pointer.
 * Everything runs on motion values (no React renders) and only transforms/opacity change.
 */
export function PaperPhysics({
  enabled,
  amp = 1,
  tilt = false,
  maxTilt = 3,
  className,
  children,
}: {
  enabled: boolean
  amp?: number
  tilt?: boolean
  maxTilt?: number
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rx = useSpring(0, PAPER_SPRING)
  const ry = useSpring(0, PAPER_SPRING)
  const sway = useSpring(0, { stiffness: 140, damping: 9, mass: 0.6 })
  const lift = useSpring(0, { stiffness: 260, damping: 24 })
  const mx = useMotionValue(50)
  const my = useMotionValue(30)
  const last = useRef<{ x: number; t: number } | null>(null)

  const y = useTransform(lift, (v) => -v * 3 * amp)
  const shadowY = useTransform(lift, (v) => 4 + v * 10)
  const shadowScale = useTransform(lift, (v) => 0.96 + v * 0.06)
  const shadowOpacity = useTransform(lift, (v) => 0.18 + v * 0.22)
  const sheen = useMotionTemplate`radial-gradient(circle at ${mx}% ${my}%, rgb(255 255 255 / 0.22), transparent 55%)`
  const sheenOpacity = useTransform(lift, (v) => v * 0.9)

  if (!enabled || amp <= 0) return <div className={cn('relative', className)}>{children}</div>

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    mx.set((nx + 0.5) * 100)
    my.set((ny + 0.5) * 100)
    if (tilt) {
      rx.set(-ny * maxTilt * amp)
      ry.set(nx * maxTilt * amp)
      const now = performance.now()
      if (last.current) {
        const v = (e.clientX - last.current.x) / Math.max(8, now - last.current.t)
        sway.set(Math.max(-1, Math.min(1, v)) * 2.2 * amp)
      }
      last.current = { x: e.clientX, t: now }
    }
  }
  const onEnter = () => lift.set(1)
  const onLeave = () => {
    lift.set(0)
    rx.set(0)
    ry.set(0)
    sway.set(0)
    last.current = null
  }

  return (
    <div ref={ref} className={cn('relative', className)} onPointerEnter={onEnter} onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* contact shadow on the surface: grows and drifts as the paper lifts */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] top-[8%] bottom-0 -z-10 rounded-[40%]"
        style={{ y: shadowY, scale: shadowScale, opacity: shadowOpacity, background: 'radial-gradient(ellipse at 50% 60%, rgb(20 10 2 / 0.55), transparent 70%)' }}
      />
      <motion.div
        style={
          tilt
            ? { rotateX: rx, rotateY: ry, rotate: sway, y, transformPerspective: 700, originY: 0 }
            : { y }
        }
        className="relative"
      >
        {children}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[3px]" style={{ backgroundImage: sheen, opacity: sheenOpacity, mixBlendMode: 'soft-light' }} />
      </motion.div>
    </div>
  )
}
