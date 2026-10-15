import { motion } from 'motion/react'
import type { MotionLevel } from '@/hooks/useMotionLevel'

/** A hand-drawn check that draws itself in. */
export function HandCheck({ checked, level, className }: { checked: boolean; level: MotionLevel; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <motion.path
        d="M4.5 12.8c1.6 1.2 3.1 2.7 4.4 4.6.4.6 1 .6 1.4 0 2.6-4.4 5.4-8 9.2-11.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={
          level === 'off'
            ? { duration: 0 }
            : { pathLength: { duration: level === 'reduced' ? 0.12 : 0.32, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.05 } }
        }
      />
    </svg>
  )
}
