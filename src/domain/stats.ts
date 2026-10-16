import { addDaysKey, compareKeys, fromKey, monthDays, monthKey, weekDays, type WeekStart } from '@/lib/dates'
import { percent, type DaySummary } from './summary'
import { MOODS, type DateKey, type Mood } from './types'

/**
 * Streak of consecutive fully-completed days ending today, or ending yesterday if today is still in
 * progress (an unfinished today never breaks a streak before the day is over).
 */
export function currentStreak(summaries: Map<DateKey, DaySummary>, today: DateKey): number {
  let day = summaries.get(today)?.complete ? today : addDaysKey(today, -1)
  let n = 0
  while (summaries.get(day)?.complete) {
    n++
    day = addDaysKey(day, -1)
  }
  return n
}

export function longestStreak(summaries: Map<DateKey, DaySummary>): number {
  const days = [...summaries.values()].filter((s) => s.complete).map((s) => s.date).sort(compareKeys)
  let best = 0
  let run = 0
  let prev: DateKey | null = null
  for (const d of days) {
    run = prev && addDaysKey(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export interface RangeStats {
  completedTasks: number
  totalTasks: number
  completedDays: number
  activeDays: number
  percentage: number
}

export function rangeStats(summaries: Map<DateKey, DaySummary>, dates: DateKey[]): RangeStats {
  let completedTasks = 0
  let totalTasks = 0
  let completedDays = 0
  let activeDays = 0
  for (const d of dates) {
    const s = summaries.get(d)
    if (!s || s.total === 0) continue
    activeDays++
    completedTasks += s.completed
    totalTasks += s.total
    if (s.complete) completedDays++
  }
  return { completedTasks, totalTasks, completedDays, activeDays, percentage: percent(completedTasks, totalTasks) }
}

export interface MonthTrend extends RangeStats {
  month: string // yyyy-MM
}

export function monthlyTrend(summaries: Map<DateKey, DaySummary>, today: DateKey, months = 12): MonthTrend[] {
  const out: MonthTrend[] = []
  const anchor = fromKey(today)
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    out.push({ month: monthKey(key), ...rangeStats(summaries, monthDays(key)) })
  }
  return out
}

/** Completed tasks per weekday (0 = Sunday). */
export function weekdayTotals(summaries: Map<DateKey, DaySummary>): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0]
  for (const s of summaries.values()) totals[fromKey(s.date).getDay()] += s.completed
  return totals
}

export function mostProductiveWeekday(summaries: Map<DateKey, DaySummary>): number | null {
  const totals = weekdayTotals(summaries)
  const max = Math.max(...totals)
  if (max <= 0) return null
  return totals.indexOf(max)
}

export interface OverallStats {
  totalCompletedTasks: number
  totalTasks: number
  completedDays: number
  currentStreak: number
  longestStreak: number
  week: RangeStats
  month: RangeStats
  mostProductiveWeekday: number | null
  archivedNotes: number
  bestMonthCompletedDays: number
}

export function overallStats(
  summaries: Map<DateKey, DaySummary>,
  today: DateKey,
  weekStartsOn: WeekStart,
): OverallStats {
  let totalCompletedTasks = 0
  let totalTasks = 0
  let completedDays = 0
  let archivedNotes = 0
  const perMonth = new Map<string, number>()
  for (const s of summaries.values()) {
    totalCompletedTasks += s.completed
    totalTasks += s.total
    if (s.archived) archivedNotes++
    if (s.complete) {
      completedDays++
      const m = monthKey(s.date)
      perMonth.set(m, (perMonth.get(m) ?? 0) + 1)
    }
  }
  return {
    totalCompletedTasks,
    totalTasks,
    completedDays,
    currentStreak: currentStreak(summaries, today),
    longestStreak: longestStreak(summaries),
    week: rangeStats(summaries, weekDays(today, weekStartsOn)),
    month: rangeStats(summaries, monthDays(today)),
    mostProductiveWeekday: mostProductiveWeekday(summaries),
    archivedNotes,
    bestMonthCompletedDays: Math.max(0, ...perMonth.values()),
  }
}

export interface MoodStat {
  mood: Mood
  days: number
  /** Average completion % on days with this mood (days with tasks only). */
  average: number
}

/** How completion relates to mood. Only days that have both a mood and at least one task count. */
export function moodStats(summaries: Map<DateKey, DaySummary>, moods: Map<DateKey, Mood>): MoodStat[] {
  const acc = new Map<Mood, { sum: number; n: number }>()
  for (const [date, mood] of moods) {
    const s = summaries.get(date)
    if (!s || s.total === 0) continue
    const a = acc.get(mood) ?? { sum: 0, n: 0 }
    a.sum += s.percentage
    a.n++
    acc.set(mood, a)
  }
  return MOODS.filter((m) => acc.has(m)).map((m) => {
    const a = acc.get(m)!
    return { mood: m, days: a.n, average: Math.round(a.sum / a.n) }
  })
}
