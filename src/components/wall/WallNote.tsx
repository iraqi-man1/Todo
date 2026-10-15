import { CircleDashed, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Pushpin, type PinColor } from '@/components/paper/Pushpin'
import { Paper } from '@/components/paper/StickyNote'
import { noteRotation, seededPick } from '@/domain/colors'
import type { DaySummary } from '@/domain/summary'
import type { Archive, DateKey, NoteColor } from '@/domain/types'
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

const PINS: PinColor[] = ['red', 'brass', 'walnut', 'sage', 'red']

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
  onOpen: (date: DateKey, el: HTMLElement, rotate: number) => void
  onArrived?: () => void
}

/** One day's slot on the wall. Every state has text, not just color, so status never relies on color alone. */
export function WallNote({ date, status, summary, archive, fallbackColor, size, level, dimmed, hidden, arrive, onOpen, onArrived }: WallNoteProps) {
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
    const t1 = setTimeout(() => playSound('pin'), level === 'full' ? 1050 : 250)
    const t2 = setTimeout(() => onArrived?.(), 2600)
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
          status === 'today' ? 'border-2 border-dashed border-[rgb(255_248_235/0.55)] hover:bg-white/5' : 'border border-[rgb(255_248_235/0.13)]',
          dimmed && 'opacity-30',
        )}
      >
        <span className={cn('chalk font-hand leading-none', lg ? 'text-6xl' : 'text-[40px]', status !== 'today' && 'opacity-60')}>
          {fmt(date, 'day')}
        </span>
        {status === 'today' && (
          <span className="chalk mt-2 flex items-center gap-1 text-[13px] font-semibold tracking-wide uppercase">
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
        <span aria-hidden className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[-4deg] bg-[rgb(255_253_240/0.55)] shadow-[0_1px_2px_rgb(0_0_0/0.15)] backdrop-blur-[1px]" />
      </button>
    )
  }

  // pinned or ready
  const color = archive?.color ?? fallbackColor
  const pinned = status === 'pinned'
  const pin = seededPick(date, PINS)
  const full = level === 'full'
  return (
    <motion.button
      type="button"
      data-date={date}
      onClick={(e) => onOpen(date, e.currentTarget, rot)}
      aria-label={aria}
      className={cn('group relative block text-start outline-offset-4', dims, dimmed && 'opacity-30', hidden && 'invisible')}
      initial={arrive && level !== 'off' ? (full ? { scale: 1.55, y: -90, rotate: rot + 12, opacity: 0 } : { opacity: 0 }) : false}
      animate={{ scale: 1, y: 0, rotate: rot, opacity: 1 }}
      transition={arrive ? (full ? { delay: 0.55, type: 'spring', stiffness: 140, damping: 15, mass: 0.9 } : { delay: 0.1, duration: 0.2 }) : { duration: 0 }}
      whileHover={level === 'off' ? undefined : { y: -3, rotate: rot * 0.6, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
    >
      <Paper color={color} className={cn('flex h-full w-full flex-col transition-shadow group-hover:shadow-lift', lg ? 'p-4 pt-5' : 'p-3 pt-3.5', !pinned && 'opacity-90')}>
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
      {pinned && (
        <motion.span
          className={cn('absolute end-1', lg ? 'top-6' : 'top-4')}
          initial={arrive && level !== 'off' ? { scale: 1.9, opacity: 0, rotate: -30 } : false}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={arrive ? { delay: full ? 1.35 : 0.3, type: 'spring', stiffness: 380, damping: 14 } : { duration: 0 }}
        >
          <DoneStamp size={lg ? 64 : 44} label={d.stamp} rotate={-14 + rot * 2} />
        </motion.span>
      )}
      {pinned ? (
        <motion.span
          className="absolute -top-1.5 left-1/2 -ml-[9px] block"
          initial={arrive && level !== 'off' ? { scale: 0, y: -14, opacity: 0 } : false}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={arrive ? { delay: full ? 1.05 : 0.25, type: 'spring', stiffness: 600, damping: 18 } : { duration: 0 }}
        >
          <Pushpin color={pin} size={lg ? 22 : 18} className="relative" />
        </motion.span>
      ) : (
        <span aria-hidden className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 rotate-[3deg] bg-[rgb(255_253_240/0.55)] shadow-[0_1px_2px_rgb(0_0_0/0.15)]" />
      )}
    </motion.button>
  )
}
