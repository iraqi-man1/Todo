import type { Archive, DateKey, Task } from './types'

export interface DaySummary {
  date: DateKey
  total: number
  completed: number
  percentage: number
  archived: boolean
  /** Fully completed: at least one task and every task done. Zero-task days never count. */
  complete: boolean
}

export function percent(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((completed / total) * 100)
}

export function summarizeTasks(date: DateKey, tasks: Pick<Task, 'completed'>[], archived = false): DaySummary {
  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  return { date, total, completed, percentage: percent(completed, total), archived, complete: total > 0 && completed === total }
}

/**
 * One summary per date that has any record. Archived days use their frozen snapshot, so later edits to
 * live data (or deleted tasks) never rewrite history; other days use live tasks.
 */
export function buildDaySummaries(tasks: Task[], archives: Archive[]): Map<DateKey, DaySummary> {
  const byDate = new Map<DateKey, Task[]>()
  for (const t of tasks) {
    const list = byDate.get(t.date)
    if (list) list.push(t)
    else byDate.set(t.date, [t])
  }
  const out = new Map<DateKey, DaySummary>()
  for (const [date, list] of byDate) out.set(date, summarizeTasks(date, list))
  for (const a of archives) {
    out.set(a.date, {
      date: a.date,
      total: a.total,
      completed: a.completed,
      percentage: a.percentage,
      archived: true,
      complete: a.total > 0 && a.completed === a.total,
    })
  }
  return out
}
