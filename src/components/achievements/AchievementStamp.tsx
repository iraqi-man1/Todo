import { CalendarCheck, Flame, Lock, Moon, StickyNote } from 'lucide-react'
import { motion } from 'motion/react'
import type { AchievementDef } from '@/domain/achievements'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const INK = ['#3F7A4C', '#A0473A', '#3D5F8C', '#7A4F8C', '#8C6A2A', '#2F6F6A']

function Glyph({ icon }: { icon: AchievementDef['icon'] }) {
  switch (icon) {
    case 'sticky':
      return <StickyNote className="size-6" />
    case 'flame':
      return <Flame className="size-6" />
    case 'calendar':
      return <CalendarCheck className="size-6" />
    case 'moon':
      return <Moon className="size-6" />
    case 'three':
      return <span className="text-xl leading-none font-black">3</span>
    case 'hundred':
      return <span className="text-lg leading-none font-black">100</span>
  }
}

/** An ink stamp; unlocked ones are inked, locked ones are a faint pencil outline with progress. */
export function AchievementStamp({
  def,
  index,
  unlockedAt,
  progress,
  level,
}: {
  def: AchievementDef
  index: number
  unlockedAt?: number
  progress: [number, number]
  level: MotionLevel
}) {
  const { d, date } = useI18n()
  const info = d.achievements[def.id]
  const ink = INK[index % INK.length]
  const unlocked = !!unlockedAt
  return (
    <li className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
      <motion.div
        initial={level === 'full' && unlocked ? { scale: 1.3, opacity: 0, rotate: -20 } : false}
        whileInView={{ scale: 1, opacity: 1, rotate: index % 2 ? 6 : -8 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: index * 0.05 }}
        className={cn('relative grid size-[72px] place-items-center rounded-full', !unlocked && 'opacity-45')}
        style={{
          color: unlocked ? ink : 'var(--dw-ink-soft)',
          border: `3px ${unlocked ? 'solid' : 'dashed'} currentColor`,
          boxShadow: unlocked ? 'inset 0 0 0 4px var(--dw-surface), inset 0 0 0 5.5px currentColor' : undefined,
        }}
        aria-hidden
      >
        {unlocked ? <Glyph icon={def.icon} /> : <Lock className="size-5" />}
      </motion.div>
      <div>
        <p className="text-sm font-semibold">{info.name}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{info.desc}</p>
        <p className="mt-1.5 text-xs font-medium text-ink-soft tabular-nums">
          {unlocked ? date(new Date(unlockedAt), 'medium') : `${d.achievements.locked} · ${progress[0]}/${progress[1]}`}
        </p>
      </div>
    </li>
  )
}
