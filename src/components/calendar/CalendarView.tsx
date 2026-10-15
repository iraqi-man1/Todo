import { addMonths } from 'date-fns'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NOTE_HEX } from '@/domain/colors'
import { rangeStats } from '@/domain/stats'
import type { Archive, DateKey } from '@/domain/types'
import { slotStatus } from '@/components/wall/WallNote'
import { useArchives, useSummaries } from '@/hooks/useData'
import { dur, useMotionLevel } from '@/hooks/useMotionLevel'
import { useToday } from '@/hooks/useToday'
import { fromKey, monthDays, monthGrid, toKey, weekdayOrder } from '@/lib/dates'
import { formatKey, useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'

export function CalendarView() {
  const { d, f, date, lang } = useI18n()
  const today = useToday()
  const level = useMotionLevel()
  const prefs = usePrefs((s) => s.prefs)
  const navigate = useUI((s) => s.navigate)
  const setInspect = useUI((s) => s.setInspect)
  const [month, setMonth] = useState(() => today.slice(0, 8) + '01')
  const [dirn, setDirn] = useState(0)
  const summaries = useSummaries()
  const archivesList = useArchives()
  const archives = useMemo(() => new Map<DateKey, Archive>((archivesList ?? []).map((a) => [a.date, a])), [archivesList])
  const cells = monthGrid(month, prefs.weekStartsOn)
  const stats = summaries ? rangeStats(summaries, monthDays(month)) : null

  const shift = (n: number) => {
    setDirn(n)
    setMonth(toKey(addMonths(fromKey(month), n)))
  }

  const open = (key: DateKey) => {
    const s = summaries?.get(key)
    if (s?.archived || (s && s.total > 0 && key < today)) setInspect({ date: key })
    else navigate(key === today ? { name: 'today' } : { name: 'today', date: key })
  }

  const statusLabel = (key: DateKey) => {
    const s = summaries?.get(key)
    const st = slotStatus(key, s, today)
    if (st === 'pinned') return `${d.calendar.legendComplete}, ${s!.completed}/${s!.total}`
    if (st === 'ready') return `${d.calendar.legendReady}, ${s!.completed}/${s!.total}`
    if (s && s.total) return `${d.calendar.legendPartial}, ${s.completed}/${s.total}`
    return d.calendar.noTasks
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-[calc(1.25rem+var(--safe-top))] pb-28 sm:px-6 md:pt-10 md:pb-16">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">{d.calendar.title}</h1>
        {month.slice(0, 7) !== today.slice(0, 7) && (
          <Button variant="subtle" size="sm" onClick={() => {
              setDirn(today > month ? 1 : -1)
              setMonth(today.slice(0, 8) + '01')
            }}>
            {d.wall.today}
          </Button>
        )}
      </header>

      <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label={d.calendar.prev}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <h2 className="text-lg font-semibold" aria-live="polite">
            {date(month, 'monthYear')}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label={d.calendar.next}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
        <div className="grid grid-cols-7 px-2 pt-3 sm:px-4" aria-hidden>
          {weekdayOrder(prefs.weekStartsOn).map((wd) => (
            <span key={wd} className="text-center text-xs font-semibold tracking-wide text-ink-soft uppercase">
              {formatKey(new Date(2023, 0, 1 + wd), 'weekdayShort', lang, 'friendly')}
            </span>
          ))}
        </div>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={dirn}>
            <motion.div
              key={month}
              custom={dirn}
              initial={level === 'off' ? false : { x: level === 'full' ? dirn * 60 : 0, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={level === 'off' ? undefined : { x: level === 'full' ? dirn * -60 : 0, opacity: 0 }}
              transition={{ duration: dur(level, 0.28), ease: [0.22, 1, 0.36, 1] }}
              drag={level === 'off' ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                const rtl = document.documentElement.dir === 'rtl'
                if (Math.abs(info.offset.x) > 70) shift((info.offset.x < 0 ? 1 : -1) * (rtl ? -1 : 1))
              }}
              style={{ touchAction: 'pan-y' }}
              className="grid grid-cols-7 gap-1 px-2 pt-2 pb-3 sm:gap-2 sm:px-4 sm:pb-4"
              role="grid"
              aria-label={date(month, 'monthYear')}
            >
              {cells.map((k, i) => {
                if (!k) return <span key={`x${i}`} />
                const s = summaries?.get(k)
                const st = slotStatus(k, s, today)
                const isToday = k === today
                const a = archives.get(k)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => open(k)}
                    aria-label={f(d.calendar.dayLabel, { date: date(k, 'long'), status: statusLabel(k) })}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'group relative flex aspect-square flex-col items-center justify-center rounded-xl text-[15px] transition-colors hover:bg-surface-2 sm:aspect-[1/0.9]',
                      isToday && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                    )}
                  >
                    {st === 'pinned' || st === 'ready' ? (
                      <span
                        className={cn('relative grid size-[78%] max-h-12 max-w-12 place-items-center rounded-[3px] font-semibold text-[#302c28] shadow-[0_1px_2px_rgb(60_40_20/0.2),0_3px_6px_-2px_rgb(60_40_20/0.2)]', st === 'ready' && 'opacity-70')}
                        style={{ background: NOTE_HEX[a?.color ?? prefs.defaultNoteColor], transform: `rotate(${(fromKey(k).getDate() % 5) - 2}deg)` }}
                      >
                        {fromKey(k).getDate()}
                        {st === 'pinned' && (
                          <span className="absolute -end-1 -bottom-1 grid size-4 place-items-center rounded-full bg-success text-white shadow">
                            <Check className="size-2.5" strokeWidth={3.5} />
                          </span>
                        )}
                      </span>
                    ) : (
                      <>
                        <span className={cn('font-medium', k > today && 'text-ink-soft', isToday && 'font-bold')}>{fromKey(k).getDate()}</span>
                        {s && s.total > 0 && (
                          <span className="mt-1 flex h-1.5 w-6 overflow-hidden rounded-full bg-line" aria-hidden>
                            <span className="h-full bg-oak" style={{ width: `${s.percentage}%` }} />
                          </span>
                        )}
                      </>
                    )}
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-xs text-ink-soft">
          <Legend swatch={<span className="relative size-3.5 rounded-[2px] bg-note-yellow shadow-sm"><Check className="absolute -end-1 -bottom-1 size-2.5 rounded-full bg-success p-px text-white" strokeWidth={4} /></span>} label={d.calendar.legendComplete} />
          <Legend swatch={<span className="size-3.5 rounded-[2px] bg-note-yellow opacity-60 shadow-sm" />} label={d.calendar.legendReady} />
          <Legend swatch={<span className="flex h-1.5 w-5 overflow-hidden rounded-full bg-line"><span className="w-1/2 bg-oak" /></span>} label={d.calendar.legendPartial} />
          <Legend swatch={<span className="size-3.5 rounded-full ring-2 ring-accent" />} label={d.calendar.legendToday} />
        </div>
      </section>

      {stats && (
        <section className="mt-5 grid grid-cols-3 gap-3" aria-label={d.calendar.summary}>
          <Stat label={d.calendar.completedDays} value={stats.completedDays} />
          <Stat label={d.calendar.tasksDone} value={stats.completedTasks} />
          <Stat label={d.calendar.rate} value={`${stats.percentage}%`} />
        </section>
      )}
    </div>
  )
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      {label}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
    </div>
  )
}
