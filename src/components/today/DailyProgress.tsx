import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { percent } from '@/domain/summary'

export function DailyProgress({ done, total, level }: { done: number; total: number; level: MotionLevel }) {
  const { d, f } = useI18n()
  const pct = percent(done, total)
  const mv = useMotionValue(pct)
  const shown = useTransform(mv, (v) => `${Math.round(v)}%`)
  const R = 26
  const C = 2 * Math.PI * R
  const dash = useTransform(mv, (v) => C * (1 - v / 100))

  useEffect(() => {
    const controls = animate(mv, pct, level === 'off' ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18 })
    return () => controls.stop()
  }, [pct, level, mv])

  const label = total ? f(d.today.progress, { done, total, pct }) : d.today.noTasks

  return (
    <div className="flex items-center gap-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={label}>
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="var(--dw-line)" strokeWidth="6" />
          <motion.circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={pct === 100 ? 'var(--dw-success)' : 'var(--dw-accent)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            style={{ strokeDashoffset: dash }}
          />
        </svg>
        <motion.span aria-hidden className="absolute inset-0 grid place-items-center text-[13px] font-semibold tabular-nums">
          {shown}
        </motion.span>
      </div>
      <p className="min-w-0 text-[15px] leading-snug font-medium text-ink">{label}</p>
    </div>
  )
}
