import { CircleDashed, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { memo, useEffect } from 'react'
import { DraggableNote, type Offset } from './drag'
import { PaperPhysics } from '@/components/paper/PaperPhysics'
import { useEffects } from '@/hooks/useMotionLevel'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Pushpin } from '@/components/paper/Pushpin'
import { Paper } from '@/components/paper/StickyNote'
import { noteRotation } from '@/domain/colors'
import type { DaySummary } from '@/domain/summary'
import { MOOD_EMOJI, type Archive, type DateKey, type Mood, type NoteColor, type PinStyle, type StampStyle } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export type SlotStatus = 'pinned' | 'ready' | 'unfinished' | 'today' | 'future' | 'empty'

export function slotStatus(date: DateKey, summary: DaySummary | undefined, today: DateKey): SlotStatus {
  if (summary?.archived) return 'pinned'
  if (summary?.complete) return 'ready'
  if (date === today) return 'today'
  if (date > today) return 'future'
  if (summary && summary.total > 0) return 'unfinished'
  return 'empty'
}


export interface WallNoteProps {
  date: DateKey
  status: SlotStatus
  summary?: DaySummary
  archive?: Archive
  fallbackColor: NoteColor
  size: 'md' | 'lg'
  level: MotionLevel
  dimmed?: boolean
  hidden?: boolean
  arrive?: boolean
  offset?: Offset
  /** Staggered entrance when a new period slides in. */
  enter?: { index: number; delay: number }
  mood?: Mood | null
  pin?: PinStyle
  stamp?: StampStyle
  onOpen: (date: DateKey, el: HTMLElement, rotate: number) => void
  onArrived?: () => void
}

/** One day's slot on the wall. Every state has text, not just color, so status never relies on color alone. */
export const WallNote = memo(function WallNote({ date, status, summary, archive, fallbackColor, size, level, dimmed, hidden, arrive, offset, enter, mood, pin, stamp, onOpen, onArrived }: WallNoteProps) {
  const fx = useEffects()
  const { d, f, date: fmt } = useI18n()
  const rot = noteRotation(date)
  const lg = size === 'lg'
  const dims = lg ? 'h-[240px] w-[220px]' : 'h-[150px] w-[140px]'
  const done = summary?.completed ?? 0
  const total = summary?.total ?? 0
  const statusText =
    status === 'pinned' ? d.wall.statusPinned : status === 'ready' ? d.wall.statusReady : status === 'today' ? d.wall.statusToday : d.wall.statusUnfinished
  const aria = f(d.wall.noteLabel, { date: fmt(date, 'long'), status: statusText, done, total })

  useEffect(() => {
    if (!arrive || level === 'off') return
    const t1 = setTimeout(() => playSound('pin'), level === 'full' ? 1080 : 250)
    const t2 = setTimeout(() => onArrived?.(), 3000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [arrive, level, onArrived])

  if (status === 'empty' || status === 'future' || (status === 'today' && total === 0)) {
    const interactive = status === 'today'
    const Comp = interactive ? 'button' : 'div'
    return (
      <Comp
        type={interactive ? 'button' : undefined}
        data-date={date}
        onClick={interactive ? (e: React.MouseEvent<HTMLElement>) => onOpen(date, e.currentTarget, 0) : undefined}
        aria-label={interactive ? `${fmt(date, 'long')}: ${d.wall.statusToday}` : undefined}
        aria-hidden={interactive ? undefined : true}
        className={cn(
          dims,
          'relative flex flex-col items-center justify-center rounded-[4px] transition-opacity',
          status === 'today' ? 'border-2 border-dashed border-[rgb(255_248_235/0.7)] bg-black/[0.06] hover:bg-white/10' : 'border border-[rgb(255_248_235/0.13)]',
          dimmed && 'opacity-30',
        )}
      >
        <span className={cn('chalk font-hand leading-none', lg ? 'text-6xl' : 'text-[40px]', status !== 'today' && 'opacity-60')}>
          {fmt(date, 'day')}
        </span>
        {status === 'today' && (
          <span className="chalk mt-2 flex items-center gap-1 text-[13px] font-semibold tracking-wide text-[rgb(255_248_235/0.92)] uppercase">
            <Plus className="size-3.5" /> {d.wall.statusToday}
          </span>
        )}
      </Comp>
    )
  }

  if (status === 'today' || status === 'unfinished') {
    return (
      <button
        type="button"
        data-date={date}
        onClick={(e) => onOpen(date, e.currentTarget, rot * 0.5)}
        aria-label={aria}
        className={cn('group relative block text-start transition-opacity', dims, dimmed && 'opacity-30')}
        style={{ transform: `rotate(${rot * 0.5}deg)` }}
      >
        {/* A loose paper held by a strip of tape: clearly not pinned yet */}
        <Paper color={fallbackColor} curl={false} className="flex h-full w-full flex-col p-3 opacity-80 saturate-[0.35] transition group-hover:opacity-95">
          <span className={cn('font-semibold tracking-wider text-[#302c28]/55 uppercase', lg ? 'text-sm' : 'text-[11px]')}>{fmt(date, 'weekdayShort')}</span>
          <span className={cn('font-hand leading-none text-[#302c28]/80', lg ? 'text-6xl' : 'text-[44px]')}>{fmt(date, 'day')}</span>
          <span className="mt-auto flex items-center gap-1.5 text-[12px] font-medium text-[#302c28]/70">
            <CircleDashed className="size-3.5 shrink-0" />
            <span className="truncate">{status === 'today' ? d.wall.inProgress : d.wall.unfinished}</span>
          </span>
          <span className="mt-0.5 text-[12px] tabular-nums text-[#302c28]/60">{f(d.wall.tasksDone, { done, total })}</span>
        </Paper>
        {mood && <MoodSticker mood={mood} size={lg ? 'lg' : 'md'} />}
        <span aria-hidden className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[-4deg] bg-[rgb(255_253_240/0.55)] shadow-[0_1px_2px_rgb(0_0_0/0.15)] backdrop-blur-[1px]" />
      </button>
    )
  }

  // pinned or ready
  const color = archive?.color ?? fallbackColor
  const pinned = status === 'pinned'
  const full = level === 'full'
  const physics = fx.physics && !arrive
  // Arrival: glide in, wait for the pin, then swing to rest around it.
  const arriveFull = arrive && full
  return (
    <DraggableNote date={date} offset={offset} level={level} enabled={pinned && !arrive} amp={fx.physics ? fx.amp : 0}>
    <motion.button
      type="button"
      data-date={date}
      onClick={(e) => onOpen(date, e.currentTarget, rot)}
      aria-label={aria}
      aria-keyshortcuts={pinned ? 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown' : undefined}
      className={cn('group relative block text-start outline-offset-4', dims, dimmed && 'opacity-30', hidden && 'invisible')}
      style={{ originY: 0 }}
      initial={
        arrive && level !== 'off'
          ? full
            ? { scale: 1.35, y: -70, rotate: rot + 12, opacity: 0 }
            : { opacity: 0 }
          : enter && level !== 'off'
            ? { opacity: 0, y: full ? -10 : 0, rotate: rot + (full ? (enter.index % 2 ? 3 : -3) : 0) }
            : false
      }
      animate={
        arriveFull
          ? { scale: 1, y: 0, opacity: 1, rotate: [rot + 12, rot + 4, rot + 4, rot - 2.4, rot + 0.9, rot - 0.3, rot] }
          : { scale: 1, y: 0, rotate: rot, opacity: 1 }
      }
      transition={
        arriveFull
          ? {
              scale: { delay: 0.55, type: 'spring', stiffness: 150, damping: 17 },
              y: { delay: 0.55, type: 'spring', stiffness: 150, damping: 17 },
              opacity: { delay: 0.55, duration: 0.2 },
              rotate: { delay: 0.55, duration: 1.9, times: [0, 0.22, 0.34, 0.5, 0.66, 0.82, 1], ease: 'easeInOut' },
            }
          : arrive
            ? { delay: 0.1, duration: 0.2 }
            : enter && level !== 'off'
              ? { delay: enter.delay, ...(full ? { type: 'spring', stiffness: 260, damping: 20 } : { duration: 0.18 }) }
              : { duration: 0 }
      }
      whileHover={physics || level === 'off' ? undefined : { y: -3, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
    >
      <PaperPhysics enabled={physics} amp={fx.amp} tilt maxTilt={lg ? 2.5 : 3.5}>
        <Paper color={color} className={cn('flex h-full w-full flex-col', lg ? 'p-4 pt-5' : 'p-3 pt-3.5', !pinned && 'opacity-90')}>
          <span className={cn('font-semibold tracking-wider text-[#302c28]/55 uppercase', lg ? 'text-sm' : 'text-[11px]')}>{fmt(date, 'weekdayShort')}</span>
          <span className={cn('font-hand leading-[0.9] text-[#302c28]', lg ? 'text-[64px]' : 'text-[46px]')}>{fmt(date, 'day')}</span>
          {archive?.title && <span className={cn('font-hand truncate leading-tight text-[#302c28]/80', lg ? 'text-2xl' : 'text-lg')}>{archive.title}</span>}
          <span className="mt-auto">
            <span className={cn('block font-medium tabular-nums text-[#302c28]/70', lg ? 'text-sm' : 'text-[12px]')}>
              {f(d.wall.tasksDone, { done, total })} · {summary?.percentage ?? 0}%
            </span>
            {!pinned && <span className="mt-0.5 block text-[11px] font-semibold tracking-wide text-[#302c28]/60 uppercase">{d.celebrate.readyToPin}</span>}
          </span>
        </Paper>
        {mood && <MoodSticker mood={mood} size={lg ? 'lg' : 'md'} />}
        {pinned && (
          <motion.span
            className={cn('absolute end-1', lg ? 'top-6' : 'top-4')}
            initial={arrive && level !== 'off' ? { scale: 1.9, opacity: 0, rotate: -30 } : false}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={arrive ? { delay: full ? 2.0 : 0.3, type: 'spring', stiffness: 380, damping: 14 } : { duration: 0 }}
          >
            <DoneStamp size={lg ? 64 : 44} label={d.stamp} rotate={-14 + rot * 2} variant={stamp} />
          </motion.span>
        )}
      </PaperPhysics>
      {pinned ? (
        <motion.span
          className="absolute -top-1.5 left-1/2 z-10 -ml-[9px] block"
          initial={arrive && level !== 'off' ? (full ? { y: -18, scale: 1.3, opacity: 0 } : { opacity: 0 }) : false}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={
            arrive
              ? full
                ? { opacity: { delay: 1.0, duration: 0.12 }, y: { delay: 1.0, type: 'spring', stiffness: 700, damping: 26 }, scale: { delay: 1.0, type: 'spring', stiffness: 700, damping: 26 } }
                : { delay: 0.25, duration: 0.15 }
              : { duration: 0 }
          }
        >
          <Pushpin color={pin ?? 'red'} size={lg ? 22 : 18} className="relative" />
        </motion.span>
      ) : (
        <span aria-hidden className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[3deg] bg-[rgb(255_253_240/0.55)] shadow-[0_1px_2px_rgb(0_0_0/0.15)]" />
      )}
    </motion.button>
    </DraggableNote>
  )
})

/** A small round sticker with the day's mood, stuck near the bottom corner of the paper. */
function MoodSticker({ mood, size }: { mood: Mood; size: 'md' | 'lg' }) {
  const lg = size === 'lg'
  if (!MOOD_EMOJI[mood]) return null
  return (
    <span
      aria-hidden
      className={cn('absolute grid place-items-center rounded-full bg-[#FFFDF5] shadow-[0_1px_2px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.05)]', lg ? '-end-2.5 -bottom-2.5 size-9 text-[20px]' : '-end-2 -bottom-2 size-7 text-[15px]')}
      style={{ transform: 'rotate(10deg)' }}
    >
      {MOOD_EMOJI[mood]}
    </span>
  )
}
