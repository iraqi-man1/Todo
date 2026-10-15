import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { db } from '@/db/db'
import { earnedAchievements } from '@/domain/achievements'
import { overallStats } from '@/domain/stats'
import { useI18n } from '@/lib/i18n'
import { playSound } from '@/lib/sound'
import { usePrefs } from '@/store/prefs'
import { useSummaries } from './useData'
import { useToday } from './useToday'

/** Unlocks achievements as they are earned. Unlocks are permanent, even if history is edited later. */
export function useAchievementWatcher() {
  const summaries = useSummaries()
  const today = useToday()
  const weekStartsOn = usePrefs((s) => s.prefs.weekStartsOn)
  const { d } = useI18n()
  const first = useRef(true)
  useEffect(() => {
    if (!summaries) return
    const earned = earnedAchievements(overallStats(summaries, today, weekStartsOn))
    const silent = first.current
    first.current = false
    void (async () => {
      const have = new Set((await db.achievements.toArray()).map((a) => a.id))
      const fresh = earned.filter((id) => !have.has(id))
      if (!fresh.length) return
      await db.achievements.bulkPut(fresh.map((id) => ({ id, unlockedAt: Date.now() })))
      if (silent) return
      fresh.forEach((id, i) =>
        setTimeout(() => {
          playSound('chime')
          toast(d.achievements.unlocked, { description: d.achievements[id].name, icon: '🏅' })
        }, 1600 + i * 900),
      )
    })()
  }, [summaries, today, weekStartsOn, d])
}
