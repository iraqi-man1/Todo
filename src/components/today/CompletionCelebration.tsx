import { Pin } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react'
import { useRef } from 'react'
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
  animated,
  onPin,
  onDismiss,
}: {
  date: DateKey
  level: MotionLevel
  busy: boolean
  /** Play confetti only when the day was just completed, not on every visit. */
  animated: boolean
  /** pressure: how firmly the stamp was pressed (0–1), from how long the button was held. */
  onPin: (pressure: number) => void
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
        animated &&
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
          <StampButton busy={busy} level={level} onPin={onPin} label={d.celebrate.pin} hint={d.celebrate.holdHint} />
        </div>
      </div>
    </motion.div>
  )
}

const HOLD_FULL = 900 // ms of holding for the firmest stamp

/**
 * "Pin to My Wall", pressed like a real stamp: a click gives an ordinary imprint, holding loads more
 * ink (a ring fills around the button) for a darker, crisper one. Keyboard activation stamps normally.
 */
function StampButton({ busy, level, onPin, label, hint }: { busy: boolean; level: MotionLevel; onPin: (pressure: number) => void; label: string; hint: string }) {
  const charge = useMotionValue(0)
  const dash = useTransform(charge, (c) => 1 - c)
  const press = useRef<{ start: number; anim: AnimationPlaybackControls } | null>(null)
  const release = (cancel = false) => {
    const p = press.current
    press.current = null
    if (!p) return
    p.anim.stop()
    const held = Math.min(1, (performance.now() - p.start) / HOLD_FULL)
    void animate(charge, 0, { duration: level === 'off' ? 0 : 0.25 })
    // a tap still stamps firmly enough; holding goes all the way
    if (!cancel) onPin(0.55 + held * 0.45)
  }
  return (
    <Button
      variant="primary"
      size="lg"
      disabled={busy}
      title={hint}
      aria-description={hint}
      className="relative flex-[2] overflow-hidden sm:flex-none"
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        e.currentTarget.setPointerCapture(e.pointerId)
        press.current = { start: performance.now(), anim: animate(charge, 1, { duration: HOLD_FULL / 1000, ease: 'linear' }) }
      }}
      onPointerUp={() => release()}
      onPointerCancel={() => release(true)}
      onClick={(e) => {
        // pointer presses are handled on release; this is keyboard Enter/Space
        if (e.detail === 0) onPin(0.7)
      }}
    >
      {/* the ink loading up as you hold: a ring drawn around the button's face */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" style={{ width: '100%', height: '100%' }}>
        <motion.rect x="0" y="0" width="100%" height="100%" rx="14" fill="none" stroke="rgb(255 248 235 / 0.95)" strokeWidth="7" pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: dash }} />
      </svg>
      <Pin /> {label}
    </Button>
  )
}
