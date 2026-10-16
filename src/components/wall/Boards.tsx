import { Check, CircleDashed } from 'lucide-react'
import { NOTE_HEX } from '@/domain/colors'
import { rangeStats } from '@/domain/stats'
import type { DaySummary } from '@/domain/summary'
import type { Archive, DateKey, NoteColor } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { fromKey, isoWeek, monthDays, monthGrid, toKey, weekDays, weekdayOrder, type WeekStart } from '@/lib/dates'
import { formatKey, useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { WallFilter } from '@/store/ui'
import { Board } from './Board'
import { slotStatus, WallNote, type SlotStatus } from './WallNote'
import { WoodenMonthPlaque } from './WoodenMonthPlaque'
import { Paper } from '@/components/paper/StickyNote'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Pushpin } from '@/components/paper/Pushpin'
import { noteRotation } from '@/domain/colors'
import { useMemo } from 'react'
import { SlotLayoutContext, type Offset, type Rect, type SlotLayout } from './drag'

export interface BoardProps {
  anchor: DateKey
  today: DateKey
  summaries: Map<DateKey, DaySummary>
  archives: Map<DateKey, Archive>
  level: MotionLevel
  filter: WallFilter
  weekStartsOn: WeekStart
  narrow: boolean
  fallbackColor: NoteColor
  justPinned: DateKey | null
  inspecting: DateKey | null
  onOpen: (date: DateKey, el: HTMLElement, rotate: number) => void
  onArrived: () => void
  onPickMonth?: (key: DateKey) => void
  onMoveNote: (date: DateKey, offset: Offset | undefined) => void
}

function dimmedFor(status: SlotStatus, filter: WallFilter) {
  if (filter === 'complete') return status !== 'pinned'
  if (filter === 'incomplete') return status !== 'unfinished' && status !== 'today'
  return false
}

function Slot(p: BoardProps & { date: DateKey; size: 'md' | 'lg' }) {
  const summary = p.summaries.get(p.date)
  const status = slotStatus(p.date, summary, p.today)
  return (
    <WallNote
      date={p.date}
      status={status}
      summary={summary}
      archive={p.archives.get(p.date)}
      fallbackColor={p.fallbackColor}
      size={p.size}
      level={p.level}
      dimmed={dimmedFor(status, p.filter)}
      hidden={p.inspecting === p.date}
      arrive={p.justPinned === p.date}
      offset={p.archives.get(p.date)?.offset}
      onOpen={p.onOpen}
      onArrived={p.onArrived}
    />
  )
}

const hasPaper = (s: SlotStatus, total: number) => s === 'pinned' || s === 'ready' || s === 'unfinished' || (s === 'today' && total > 0)

/**
 * Geometry of a grid of date slots, so a dragged note can stay near its date and never overlap another.
 * Coordinates are grid-relative and visual (mirrored for RTL).
 */
function useSlotLayout(p: BoardProps, cells: (DateKey | null)[], cols: number, cell: { w: number; h: number }, pitch: { x: number; y: number }): SlotLayout {
  return useMemo(() => {
    const index = new Map<DateKey, number>()
    cells.forEach((k, i) => k && index.set(k, i))
    const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
    const home = (date: DateKey): Rect | undefined => {
      const i = index.get(date)
      if (i === undefined) return
      const col = i % cols
      const row = Math.floor(i / cols)
      return { x: (rtl ? cols - 1 - col : col) * pitch.x, y: row * pitch.y, w: cell.w, h: cell.h }
    }
    const obstacles = (date: DateKey) => {
      const out: Rect[] = []
      for (const [k] of index) {
        if (k === date) continue
        const s = p.summaries.get(k)
        if (!hasPaper(slotStatus(k, s, p.today), s?.total ?? 0)) continue
        const r = home(k)!
        const o = p.archives.get(k)?.offset
        out.push(o ? { ...r, x: r.x + o.x, y: r.y + o.y } : r)
      }
      return out
    }
    return { home, obstacles, limit: { x: Math.round(pitch.x * 0.45), y: Math.round(pitch.y * 0.45) }, onMove: p.onMoveNote }
  }, [cells, cols, cell.w, cell.h, pitch.x, pitch.y, p.summaries, p.archives, p.today, p.onMoveNote])
}

function WeekdayHeader({ weekStartsOn, lang, cell, gap }: { weekStartsOn: WeekStart; lang: 'en' | 'ar'; cell: number; gap: number }) {
  return (
    <div className="mb-3 grid" style={{ gridTemplateColumns: `repeat(7, ${cell}px)`, columnGap: gap }}>
      {weekdayOrder(weekStartsOn).map((wd) => (
        <span key={wd} className="engraved text-center text-[13px] font-bold tracking-[0.2em] uppercase">
          {formatKey(new Date(2023, 0, 1 + wd), 'weekdayShort', lang, 'friendly')}
        </span>
      ))}
    </div>
  )
}

export function MonthBoard(p: BoardProps) {
  const { d, f, lang, date } = useI18n()
  const cells = monthGrid(p.anchor, p.weekStartsOn)
  const stats = rangeStats(p.summaries, monthDays(p.anchor))
  const pinnedCount = monthDays(p.anchor).filter((k) => p.archives.has(k)).length
  const pad = p.narrow ? 28 : 56
  const layout = useSlotLayout(p, cells, 7, { w: 140, h: 150 }, { x: 162, y: 172 })
  return (
    <SlotLayoutContext.Provider value={layout}>
    <Board padding={pad}>
      <WoodenMonthPlaque
        title={date(p.anchor, 'monthYear')}
        subtitle={`${f(d.wall.completedDays, { n: stats.completedDays })} · ${f(d.wall.rate, { pct: stats.percentage })}`}
        className="mb-9"
      />
      <WeekdayHeader weekStartsOn={p.weekStartsOn} lang={lang} cell={140} gap={22} />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 140px)', gap: 22 }}>
        {cells.map((k, i) => (k ? <Slot key={k} {...p} date={k} size="md" /> : <div key={`x${i}`} className="h-[150px] w-[140px]" />))}
      </div>
      {pinnedCount === 0 && <p className="chalk font-hand mt-8 text-center text-[26px]">{d.wall.emptyMonth}</p>}
    </Board>
    </SlotLayoutContext.Provider>
  )
}

export function WeekBoard(p: BoardProps) {
  const { d, f, date } = useI18n()
  const days = weekDays(p.anchor, p.weekStartsOn)
  const stats = rangeStats(p.summaries, days)
  const cols = p.narrow ? 2 : 7
  const gap = p.narrow ? 28 : 30
  const layout = useSlotLayout(p, days, cols, { w: 220, h: 240 }, { x: 220 + gap, y: 272 + gap })
  return (
    <SlotLayoutContext.Provider value={layout}>
    <Board padding={p.narrow ? 28 : 56}>
      <WoodenMonthPlaque
        title={f(d.wall.week, { n: isoWeek(days[3]) })}
        subtitle={`${date(days[0], 'short')} – ${date(days[6], 'medium')} · ${f(d.wall.completedDays, { n: stats.completedDays })}`}
        className="mb-10"
      />
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 220px)`, gap }}>
        {days.map((k) => (
          <div key={k} className="flex flex-col items-center gap-3">
            <span className="engraved text-[13px] font-bold tracking-[0.2em] uppercase">{date(k, 'weekday')}</span>
            <Slot {...p} date={k} size="lg" />
          </div>
        ))}
      </div>
    </Board>
    </SlotLayoutContext.Provider>
  )
}

export function DayBoard(p: BoardProps) {
  const { d, f, date } = useI18n()
  const summary = p.summaries.get(p.anchor)
  const archive = p.archives.get(p.anchor)
  const status = slotStatus(p.anchor, summary, p.today)
  const rot = noteRotation(p.anchor, 1.5)
  const hasNote = status === 'pinned' || status === 'ready' || status === 'unfinished' || (status === 'today' && (summary?.total ?? 0) > 0)
  return (
    <Board padding={p.narrow ? 28 : 64}>
      <WoodenMonthPlaque title={date(p.anchor, 'weekday')} subtitle={date(p.anchor, 'medium')} className="mb-10" />
      <div className="flex w-[min(460px,100%)] min-w-[340px] justify-center pb-4">
        {hasNote ? (
          <button
            type="button"
            data-date={p.anchor}
            onClick={(e) => p.onOpen(p.anchor, e.currentTarget, rot)}
            aria-label={f(d.wall.noteLabel, { date: date(p.anchor, 'long'), status, done: summary?.completed ?? 0, total: summary?.total ?? 0 })}
            className={cn('relative block w-[400px] text-start', p.inspecting === p.anchor && 'invisible')}
            style={{ transform: `rotate(${rot}deg)` }}
          >
            <Paper color={archive?.color ?? p.fallbackColor} className={cn('min-h-[420px] p-7 pt-8', status !== 'pinned' && 'saturate-[0.5]')}>
              <p className="font-hand text-[40px] leading-none">{archive?.title || date(p.anchor, 'long')}</p>
              <p className="mt-2 text-sm font-medium text-[#302c28]/65">
                {f(d.wall.tasksDone, { done: summary?.completed ?? 0, total: summary?.total ?? 0 })} · {summary?.percentage ?? 0}%
              </p>
              {archive ? (
                <ul className="mt-5 space-y-2.5">
                  {archive.tasks.slice(0, 12).map((t) => (
                    <li key={t.id} className="flex items-start gap-2.5 text-[17px] leading-snug">
                      {t.completed ? <Check className="mt-0.5 size-5 shrink-0 text-[#3D6B39]" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-[#302c28]/50" />}
                      <span className={cn(t.completed && 'text-[#302c28]/60 line-through decoration-[#302c28]/40')}>{t.title}</span>
                    </li>
                  ))}
                  {archive.tasks.length > 12 && <li className="text-sm text-[#302c28]/55">+{archive.tasks.length - 12}</li>}
                </ul>
              ) : (
                <p className="mt-6 flex items-center gap-2 text-[15px] text-[#302c28]/70">
                  <CircleDashed className="size-4" /> {status === 'ready' ? d.celebrate.readyToPin : status === 'today' ? d.wall.inProgress : d.wall.unfinished}
                </p>
              )}
              {status === 'pinned' && <DoneStamp size={84} label={d.stamp} className="absolute end-5 bottom-5" />}
            </Paper>
            {status === 'pinned' && <Pushpin size={26} className="-top-2 left-1/2 -ml-[13px]" />}
          </button>
        ) : (
          <p className="chalk font-hand py-24 text-center text-[30px]">{d.wall.emptyDay}</p>
        )}
      </div>
    </Board>
  )
}

export function YearBoard(p: BoardProps) {
  const { d, f, date } = useI18n()
  const year = fromKey(p.anchor).getFullYear()
  const months = Array.from({ length: 12 }, (_, m) => toKey(new Date(year, m, 1)))
  const cols = p.narrow ? 2 : 4
  return (
    <Board padding={p.narrow ? 24 : 48}>
      <WoodenMonthPlaque title={String(year)} className="mb-10" />
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 280px)`, gap: p.narrow ? 24 : 36 }}>
        {months.map((m) => {
          const stats = rangeStats(p.summaries, monthDays(m))
          return (
            <button
              key={m}
              type="button"
              onClick={() => p.onPickMonth?.(m)}
              aria-label={f(d.wall.monthPlaqueLabel, { month: date(m, 'monthYear'), n: stats.completedDays, pct: stats.percentage })}
              className="group flex flex-col justify-start rounded-xl p-3 text-start transition-colors hover:bg-black/[0.06]"
            >
              <WoodenMonthPlaque title={date(m, 'month')} size="sm" className="mb-4" />
              <div className="mx-auto grid w-fit" style={{ gridTemplateColumns: 'repeat(7, 30px)', gap: 6 }}>
                {monthGrid(m, p.weekStartsOn).map((k, i) => (k ? <MiniSlot key={k} {...p} date={k} /> : <span key={`x${i}`} className="size-[30px]" />))}
              </div>
              <p className="engraved mt-3 text-center text-[13px] font-semibold">
                {f(d.wall.completedDays, { n: stats.completedDays })} · {stats.percentage}%
              </p>
            </button>
          )
        })}
      </div>
    </Board>
  )
}

function MiniSlot(p: BoardProps & { date: DateKey }) {
  const summary = p.summaries.get(p.date)
  const status = slotStatus(p.date, summary, p.today)
  const dim = dimmedFor(status, p.filter)
  const archive = p.archives.get(p.date)
  if (status === 'pinned' || status === 'ready')
    return (
      <span
        className={cn('relative block size-[30px] rounded-[2px] shadow-[0_1px_2px_rgb(0_0_0/0.35)]', dim && 'opacity-30', status === 'ready' && 'opacity-75')}
        style={{ background: NOTE_HEX[archive?.color ?? p.fallbackColor], transform: `rotate(${noteRotation(p.date, 5)}deg)` }}
      >
        {status === 'pinned' && <span className="absolute top-0.5 left-1/2 -ml-[3px] size-1.5 rounded-full bg-[#C4553F] shadow-[0_1px_1px_rgb(0_0_0/0.4)]" />}
        <span className="absolute inset-x-0 bottom-0.5 text-center text-[10px] leading-none font-semibold text-[#302c28]/70">{fromKey(p.date).getDate()}</span>
      </span>
    )
  if (status === 'unfinished' || (status === 'today' && (summary?.total ?? 0) > 0))
    return (
      <span className={cn('grid size-[30px] place-items-center rounded-[2px] bg-[rgb(255_250_240/0.35)] text-[10px] font-semibold text-[#302c28]/60', dim && 'opacity-30')}>
        {fromKey(p.date).getDate()}
      </span>
    )
  return (
    <span className={cn('chalk grid size-[30px] place-items-center rounded-[2px] text-[10px] font-medium opacity-60', status === 'today' && 'ring-1 ring-[rgb(255_248_235/0.6)] opacity-100')}>
      {fromKey(p.date).getDate()}
    </span>
  )
}
