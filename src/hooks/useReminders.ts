import { useEffect } from 'react'
import { db } from '@/db/db'
import { DICTS } from '@/lib/i18n'
import { todayKey } from '@/lib/dates'
import { usePrefs } from '@/store/prefs'

/**
 * Daily reminder while the app is open (or alive in the background). Browsers don't offer reliable
 * scheduled notifications for closed web apps, so we never promise that.
 */
export function useReminders() {
  const enabled = usePrefs((s) => s.prefs.remindersEnabled)
  const time = usePrefs((s) => s.prefs.reminderTime)
  const lang = usePrefs((s) => s.prefs.language)
  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const [h, m] = time.split(':').map(Number)
    const nextFire = () => {
      const now = new Date()
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
      if (at <= now) at.setDate(at.getDate() + 1)
      return at.getTime() - now.getTime()
    }
    let timer: ReturnType<typeof setTimeout>
    const fire = async () => {
      const key = todayKey()
      const sentKey = `dw-reminded-${key}`
      try {
        if (localStorage.getItem(sentKey)) return
      } catch {
        /* ignore */
      }
      const tasks = await db.tasks.where('date').equals(key).toArray()
      const archived = await db.archives.where('date').equals(key).count()
      const open = tasks.filter((t) => !t.completed).length
      if (!archived && open > 0) {
        const d = DICTS[lang]
        const body = d.reminderBody.replace('{n}', String(open))
        const reg = await navigator.serviceWorker?.getRegistration()
        if (reg) await reg.showNotification(d.appName, { body, icon: '/pwa-192x192.png', tag: 'dw-daily' })
        else new Notification(d.appName, { body, icon: '/pwa-192x192.png', tag: 'dw-daily' })
        try {
          localStorage.setItem(sentKey, '1')
        } catch {
          /* ignore */
        }
      }
    }
    const schedule = () => {
      timer = setTimeout(() => {
        void fire().finally(schedule)
      }, nextFire())
    }
    schedule()
    return () => clearTimeout(timer)
  }, [enabled, time, lang])
}
