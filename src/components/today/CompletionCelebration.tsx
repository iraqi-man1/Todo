import { Pin } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import type { DateKey } from '@/domain/types'

const CONFETTI = ['#FFF0A8', '#F8C9CE', '#D4EBCB', '#DDD4F8', '#FFD9BD', '#CFE5F5']

/** Shown once every task is done. Nothing is archived until the user chooses to pin. */
export function CompletionCelebration({
  date,
  level,
  busy,
  onPin,
  onDismiss,
}: {
  date: DateKey
  level: MotionLevel
  busy: boolean
  onPin: () => void
  onDismiss: () => void
}) {
  const { d, f, date: fmt } = useI18n()
  return (
    <motion.div
      role="status"
      initial={level === 'off' ? false : { opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={level === 'off' ? undefined : { opacity: 0, y: -8, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-soft"
    >
      {level === 'full' &&
        Array.from({ length: 18 }, (_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute top-0 block h-2.5 w-1.5 rounded-[1px]"
            style={{ left: `${(i * 53) % 100}%`, background: CONFETTI[i % CONFETTI.length], boxShadow: '0 0 0 0.5px rgb(0 0 0 / 0.06)' }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{ y: 160 + (i % 5) * 20, rotate: (i % 2 ? 1 : -1) * (180 + i * 20), opacity: [1, 1, 0] }}
            transition={{ duration: 1.6 + (i % 4) * 0.25, delay: (i % 6) * 0.06, ease: [0.2, 0.6, 0.4, 1] }}
          />
        ))}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-hand text-[30px] leading-none text-ink">{d.celebrate.title}</p>
          <p className="mt-1.5 text-sm text-ink-soft">{f(d.celebrate.body, { date: fmt(date, 'long') })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDismiss} className="flex-1 sm:flex-none">
            {d.celebrate.later}
          </Button>
          <Button variant="primary" size="lg" onClick={onPin} disabled={busy} className="flex-[2] sm:flex-none">
            <Pin /> {d.celebrate.pin}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
