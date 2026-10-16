import { motion } from 'motion/react'
import { setDayMeta } from '@/domain/actions'
import { MOOD_EMOJI, MOODS, type DateKey, type Mood } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { reportError } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** "How was today?" Five small stickers; tapping the chosen one again clears it. Works on pinned days too. */
export function MoodPicker({ date, mood, level }: { date: DateKey; mood: Mood | null | undefined; level: MotionLevel }) {
  const { d } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-ink-soft">{d.mood.question}</span>
      <div role="radiogroup" aria-label={d.mood.question} className="flex gap-0.5">
        {MOODS.map((m) => {
          const on = mood === m
          return (
            <motion.button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={d.mood.labels[m]}
              title={d.mood.labels[m]}
              whileTap={level === 'off' ? undefined : { scale: 0.85 }}
              animate={on && level === 'full' ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.35 }}
              onClick={() => setDayMeta(date, { mood: on ? null : m }).catch(reportError)}
              className={cn(
                'grid size-9 place-items-center rounded-full text-[19px] transition-[opacity,background-color,filter]',
                on ? 'bg-accent/20 ring-1 ring-accent/50' : mood ? 'opacity-45 grayscale-[0.4] hover:opacity-90' : 'opacity-80 hover:bg-surface-2 hover:opacity-100',
              )}
            >
              <span aria-hidden>{MOOD_EMOJI[m]}</span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
