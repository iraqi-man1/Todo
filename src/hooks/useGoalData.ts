import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { db } from '@/db/db'
import { goalProgress, updateGoal, type GoalProgress } from '@/domain/actions'
import type { Goal, Task } from '@/domain/types'
import { useI18n } from '@/lib/i18n'
import { playSound } from '@/lib/sound'

export interface GoalWithProgress {
  goal: Goal
  tasks: Task[]
  progress: GoalProgress
}

/** Goals with their linked tasks and progress, newest first. */
export function useGoalsWithProgress(): GoalWithProgress[] | undefined {
  const data = useLiveQuery(async () => {
    const [goals, tasks] = await Promise.all([db.goals.orderBy('createdAt').toArray(), db.tasks.where('goalId').above('').toArray()])
    return { goals, tasks }
  }, [])
  return useMemo(() => {
    if (!data) return undefined
    const by = new Map<string, Task[]>()
    for (const t of data.tasks) {
      const list = by.get(t.goalId!)
      if (list) list.push(t)
      else by.set(t.goalId!, [t])
    }
    return data.goals.map((goal) => {
      const tasks = (by.get(goal.id) ?? []).sort((a, b) => (a.date < b.date ? 1 : -1))
      return { goal, tasks, progress: goalProgress(goal, tasks) }
    })
  }, [data])
}

/** Marks goals achieved (or not) as their progress changes, and celebrates the moment once. */
export function useGoalWatcher() {
  const goals = useGoalsWithProgress()
  const { d, f } = useI18n()
  const seeded = useRef(false)
  useEffect(() => {
    if (!goals) return
    const first = !seeded.current
    seeded.current = true
    for (const { goal, progress } of goals) {
      if (progress.achieved && !goal.achievedAt) {
        void updateGoal(goal.id, { achievedAt: Date.now() })
        if (!first) {
          playSound('chime')
          toast(f(d.goals.reached, { title: goal.title }), { icon: '🎯' })
        }
      } else if (!progress.achieved && goal.achievedAt) void updateGoal(goal.id, { achievedAt: null })
    }
  }, [goals, d, f])
}
