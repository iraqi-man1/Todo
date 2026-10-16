import { AnimatePresence, motion, type Variants } from 'motion/react'
import type { MotionLevel } from '@/hooks/useMotionLevel'

/**
 * Swaps "pages" of the calendar inside a board that itself stays still. Going forward, the old page
 * lifts and folds away upward like a torn-off calendar sheet; going back, it folds down. The incoming
 * page fades in while its notes settle in one by one (handled by the notes themselves).
 * `popLayout` lets rapid clicks queue cleanly: only the newest page is ever interactive.
 */
export function PageTurn({ pageKey, dirn, level, children }: { pageKey: string; dirn: number; level: MotionLevel; children: React.ReactNode }) {
  const variants: Variants = {
    enter: () => (level === 'off' ? {} : { opacity: 0 }),
    center: { opacity: 1, rotateX: 0, y: 0, transition: { duration: level === 'full' ? 0.25 : 0.15 } },
    exit: (dn: number) =>
      level === 'full'
        ? { opacity: 0, rotateX: dn >= 0 ? -58 : 58, y: dn >= 0 ? -18 : 18, originY: dn >= 0 ? 0 : 1, transition: { duration: 0.34, ease: [0.42, 0, 0.75, 0.45] } }
        : level === 'reduced'
          ? { opacity: 0, transition: { duration: 0.12 } }
          : { opacity: 0, transition: { duration: 0 } },
  }
  return (
    <div className="relative" style={{ perspective: 1400 }}>
      <AnimatePresence mode="popLayout" initial={false} custom={dirn}>
        <motion.div key={pageKey} custom={dirn} variants={variants} initial="enter" animate="center" exit="exit">
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
