import type { OverallStats } from './stats'
import type { AchievementId } from './types'

export interface AchievementDef {
  id: AchievementId
  icon: 'sticky' | 'three' | 'flame' | 'calendar' | 'hundred' | 'moon'
  earned: (s: OverallStats) => boolean
  progress: (s: OverallStats) => [number, number]
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-note', icon: 'sticky', earned: (s) => s.archivedNotes >= 1, progress: (s) => [Math.min(s.archivedNotes, 1), 1] },
  { id: 'three-days', icon: 'three', earned: (s) => s.completedDays >= 3, progress: (s) => [Math.min(s.completedDays, 3), 3] },
  { id: 'seven-streak', icon: 'flame', earned: (s) => s.longestStreak >= 7, progress: (s) => [Math.min(s.longestStreak, 7), 7] },
  { id: 'thirty-days', icon: 'calendar', earned: (s) => s.completedDays >= 30, progress: (s) => [Math.min(s.completedDays, 30), 30] },
  { id: 'hundred-tasks', icon: 'hundred', earned: (s) => s.totalCompletedTasks >= 100, progress: (s) => [Math.min(s.totalCompletedTasks, 100), 100] },
  { id: 'first-month', icon: 'moon', earned: (s) => s.bestMonthCompletedDays >= 20, progress: (s) => [Math.min(s.bestMonthCompletedDays, 20), 20] },
]

export function earnedAchievements(stats: OverallStats): AchievementId[] {
  return ACHIEVEMENTS.filter((a) => a.earned(stats)).map((a) => a.id)
}
