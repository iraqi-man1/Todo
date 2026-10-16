import { CalendarCheck2, CheckCheck, Flame, StickyNote, Trophy, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { AchievementStamp } from '@/components/achievements/AchievementStamp'
import { CollectionPanel } from '@/components/achievements/CollectionPanel'
import { ACHIEVEMENTS } from '@/domain/achievements'
import { monthlyTrend, moodStats, overallStats, weekdayTotals } from '@/domain/stats'
import { MOOD_EMOJI } from '@/domain/types'
import { useAchievementRecords, useMoods, useSummaries } from '@/hooks/useData'
import { dur, useMotionLevel, type MotionLevel } from '@/hooks/useMotionLevel'
import { useToday } from '@/hooks/useToday'
import { weekdayOrder } from '@/lib/dates'
import { formatKey, useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'

export function StatisticsDashboard() {
  const { d, f, lang, date } = useI18n()
  const today = useToday()
  const level = useMotionLevel()
  const weekStartsOn = usePrefs((s) => s.prefs.weekStartsOn)
  const summaries = useSummaries()
  const moods = useMoods()
  const records = useAchievementRecords()
  const unlocked = new Map(records.map((r) => [r.id, r.unlockedAt]))
  const data = useMemo(() => {
    if (!summaries) return null
    return {
      stats: overallStats(summaries, today, weekStartsOn),
      trend: monthlyTrend(summaries, today, 12),
      weekdays: weekdayTotals(summaries),
      moods: moodStats(summaries, moods),
    }
  }, [summaries, moods, today, weekStartsOn])

  if (!data) return <div className="h-dvh" />
  const { stats, trend, weekdays, moods: moodRows } = data
  const days = (n: number) => f(n === 1 ? d.stats.day : d.stats.days, { n })
  const wdName = (wd: number, style: 'weekday' | 'weekdayShort') => formatKey(new Date(2023, 0, 1 + wd), style, lang, 'friendly')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-[calc(1.25rem+var(--safe-top))] pb-28 sm:px-6 md:pt-10 md:pb-16">
      <h1 className="mb-5 text-[28px] font-semibold tracking-tight">{d.stats.title}</h1>
      {stats.totalTasks === 0 && <p className="mb-5 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink-soft">{d.stats.empty}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<CheckCheck />} label={d.stats.totalTasks} value={stats.totalCompletedTasks.toLocaleString(lang)} tint="mint" />
        <Tile icon={<CalendarCheck2 />} label={d.stats.completedDays} value={stats.completedDays.toLocaleString(lang)} tint="yellow" />
        <Tile icon={<Flame />} label={d.stats.currentStreak} value={days(stats.currentStreak)} tint="peach" />
        <Tile icon={<Trophy />} label={d.stats.longestStreak} value={days(stats.longestStreak)} tint="lavender" />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RingTile label={d.stats.week} pct={stats.week.percentage} sub={f(d.stats.tasksCount, { n: `${stats.week.completedTasks}/${stats.week.totalTasks}` })} level={level} />
        <RingTile label={d.stats.month} pct={stats.month.percentage} sub={f(d.stats.tasksCount, { n: `${stats.month.completedTasks}/${stats.month.totalTasks}` })} level={level} />
        <Tile icon={<TrendingUp />} label={d.stats.bestDay} value={stats.mostProductiveWeekday === null ? d.stats.none : wdName(stats.mostProductiveWeekday, 'weekday')} tint="blue" />
        <Tile icon={<StickyNote />} label={d.stats.archived} value={stats.archivedNotes.toLocaleString(lang)} tint="pink" />
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-5">
        <Card title={d.stats.trend} desc={d.stats.trendDesc} className="lg:col-span-3">
          <BarChart
            level={level}
            bars={trend.map((m) => ({
              key: m.month,
              label: date(`${m.month}-01`, 'monthShort'),
              value: m.completedTasks,
              tooltip: `${date(`${m.month}-01`, 'monthYear')}: ${f(d.stats.tasksCount, { n: m.completedTasks })} · ${days(m.completedDays)} · ${m.percentage}%`,
              highlight: m.month === today.slice(0, 7),
            }))}
            caption={d.stats.trend}
            headers={[d.calendar.title, d.stats.totalTasks]}
          />
        </Card>
        <Card title={d.stats.weekdays} desc={d.stats.weekdaysDesc} className="lg:col-span-2">
          <BarChart
            level={level}
            bars={weekdayOrder(weekStartsOn).map((wd) => ({
              key: String(wd),
              label: wdName(wd, 'weekdayShort'),
              value: weekdays[wd],
              tooltip: `${wdName(wd, 'weekday')}: ${f(d.stats.tasksCount, { n: weekdays[wd] })}`,
              highlight: wd === stats.mostProductiveWeekday,
            }))}
            caption={d.stats.weekdays}
            headers={[d.stats.weekdays, d.stats.totalTasks]}
          />
        </Card>
      </section>

      <Card title={d.mood.stats} desc={d.mood.statsDesc} className="mt-3">
        {moodRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">{d.mood.none}</p>
        ) : (
          <BarChart
            level={level}
            bars={moodRows.map((m) => ({
              key: m.mood,
              label: `${MOOD_EMOJI[m.mood]} ${d.mood.labels[m.mood]}`,
              value: m.average,
              tooltip: `${d.mood.labels[m.mood]}: ${m.average}% · ${f(d.mood.days, { n: m.days })}`,
            }))}
            caption={d.mood.stats}
            headers={[d.mood.question, d.calendar.rate]}
          />
        )}
      </Card>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{d.stats.achievements}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a, i) => (
            <AchievementStamp key={a.id} def={a} index={i} unlockedAt={unlocked.get(a.id)} progress={a.progress(stats)} level={level} />
          ))}
        </ul>
      </section>
      <CollectionPanel />
    </div>
  )
}

const TINTS = { mint: '#D4EBCB', yellow: '#FFF0A8', peach: '#FFD9BD', lavender: '#DDD4F8', blue: '#CFE5F5', pink: '#F8C9CE' }

function Tile({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: keyof typeof TINTS }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft">
      <span className="grid size-9 place-items-center rounded-xl text-[#302c28] [&_svg]:size-[18px]" style={{ background: TINTS[tint] }} aria-hidden>
        {icon}
      </span>
      <div>
        <p className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-0.5 text-[13px] text-ink-soft">{label}</p>
      </div>
    </div>
  )
}

function RingTile({ label, pct, sub, level }: { label: string; pct: number; sub: string; level: MotionLevel }) {
  const R = 22
  const C = 2 * Math.PI * R
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft sm:flex-row sm:items-center sm:gap-4">
      <svg viewBox="0 0 56 56" className="size-14 shrink-0 -rotate-90" role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--dw-line)" strokeWidth="6" />
        <motion.circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke="var(--dw-chart)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ duration: dur(level, 0.9), ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div>
        <p className="text-[22px] leading-tight font-semibold tabular-nums">{pct}%</p>
        <p className="text-[13px] text-ink-soft">{label}</p>
        <p className="text-xs text-ink-soft tabular-nums">{sub}</p>
      </div>
    </div>
  )
}

function Card({ title, desc, children, className }: { title: string; desc: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-3xl border border-line bg-surface p-5 shadow-soft', className)}>
      <h2 className="font-semibold">{title}</h2>
      <p className="text-[13px] text-ink-soft">{desc}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

interface Bar {
  key: string
  label: string
  value: number
  tooltip: string
  highlight?: boolean
}

/** Single-series bar chart: thin rounded bars on a recessive baseline, hover/focus tooltip, table for screen readers. */
function BarChart({ bars, level, caption, headers }: { bars: Bar[]; level: MotionLevel; caption: string; headers: [string, string] }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...bars.map((b) => b.value))
  const H = 140
  const active = bars.find((b) => b.key === hover)
  return (
    <div className="relative">
      <div className="relative" style={{ height: H + 24 }} aria-hidden>
        {[0.5, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: H - H * g }} />
        ))}
        <span className="absolute -top-1 end-0 text-[11px] text-ink-soft tabular-nums">{max}</span>
        <div className="absolute inset-x-0 top-0 flex items-end gap-[2px]" style={{ height: H }}>
          {bars.map((b, i) => (
            <div
              key={b.key}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onPointerEnter={() => setHover(b.key)}
              onPointerLeave={() => setHover((h) => (h === b.key ? null : h))}
            >
              <motion.div
                className="w-full max-w-7 rounded-t-[4px]"
                style={{ background: 'var(--dw-chart)', opacity: hover && hover !== b.key ? 0.45 : b.highlight || !hover ? 1 : 0.85 }}
                initial={{ height: 0 }}
                animate={{ height: b.value ? Math.max(3, (b.value / max) * H) : 0 }}
                transition={{ duration: dur(level, 0.6), delay: level === 'full' ? i * 0.03 : 0, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 border-t border-ink-soft/40" style={{ top: H }} />
        <div className="absolute inset-x-0 flex gap-[2px]" style={{ top: H + 6 }}>
          {bars.map((b) => (
            <span key={b.key} className={cn('flex-1 truncate text-center text-[11px] text-ink-soft', b.highlight && 'font-semibold text-ink')}>
              {b.label}
            </span>
          ))}
        </div>
        {active && (
          <div className="pointer-events-none absolute start-0 -top-9 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-soft">
            {active.tooltip}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>{headers[0]}</th>
            <th>{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <td>{b.tooltip.split(':')[0]}</td>
              <td>{b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
