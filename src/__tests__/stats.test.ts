import { buildDaySummaries, percent, summarizeTasks } from '@/domain/summary'
import { currentStreak, longestStreak, mostProductiveWeekday, overallStats } from '@/domain/stats'
import { earnedAchievements } from '@/domain/achievements'
import type { Archive, Task } from '@/domain/types'

let n = 0
function task(date: string, completed: boolean): Task {
  return {
    id: `t${n++}`, date, noteId: 'n', title: 'x', description: '', priority: 'none', dueTime: null, categoryId: null,
    completed, completedAt: completed ? 1 : null, order: 0, recurrenceId: null, rescheduledTo: null, rescheduledFrom: null, createdAt: 0, updatedAt: 0,
  }
}
const day = (date: string, done: number, total: number) => Array.from({ length: total }, (_, i) => task(date, i < done))

describe('completion percentage', () => {
  it('rounds and handles empty days', () => {
    expect(percent(4, 6)).toBe(67)
    expect(percent(0, 0)).toBe(0)
    expect(summarizeTasks('2026-10-15', day('2026-10-15', 6, 6)).complete).toBe(true)
  })
  it('never counts a zero-task day as complete', () => {
    expect(summarizeTasks('2026-10-15', []).complete).toBe(false)
  })
})

describe('streaks', () => {
  const tasks = [
    ...day('2026-10-10', 2, 2),
    ...day('2026-10-11', 3, 3),
    ...day('2026-10-12', 1, 2), // breaks
    ...day('2026-10-13', 1, 1),
    ...day('2026-10-14', 2, 2),
    ...day('2026-10-15', 0, 3), // today, in progress
  ]
  const s = buildDaySummaries(tasks, [])
  it('counts back from yesterday while today is unfinished', () => {
    expect(currentStreak(s, '2026-10-15')).toBe(2)
  })
  it('includes today once complete', () => {
    const s2 = buildDaySummaries([...tasks.filter((t) => t.date !== '2026-10-15'), ...day('2026-10-15', 1, 1)], [])
    expect(currentStreak(s2, '2026-10-15')).toBe(3)
  })
  it('breaks on a missing day', () => {
    expect(currentStreak(s, '2026-10-17')).toBe(0)
  })
  it('finds the longest run', () => {
    expect(longestStreak(s)).toBe(2)
  })
  it('finds the most productive weekday', () => {
    expect(mostProductiveWeekday(s)).toBe(0) // Sunday 2026-10-11 had 3
    expect(mostProductiveWeekday(new Map())).toBeNull()
  })
})

describe('archived snapshots win over live data', () => {
  it('uses the snapshot even if live tasks change later', () => {
    const archive = { id: 'a', date: '2026-10-10', total: 3, completed: 3, percentage: 100 } as Archive
    const s = buildDaySummaries(day('2026-10-10', 0, 5), [archive])
    expect(s.get('2026-10-10')).toMatchObject({ total: 3, completed: 3, archived: true, complete: true })
  })
})

describe('achievements', () => {
  it('unlocks only what is earned', () => {
    const tasks = [...day('2026-10-13', 1, 1), ...day('2026-10-14', 1, 1), ...day('2026-10-15', 1, 1)]
    const archive = { id: 'a', date: '2026-10-13', total: 1, completed: 1, percentage: 100 } as Archive
    const stats = overallStats(buildDaySummaries(tasks, [archive]), '2026-10-15', 1)
    expect(earnedAchievements(stats).sort()).toEqual(['first-note', 'three-days'])
  })
})
