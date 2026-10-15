import { useEffect, useState } from 'react'
import { msUntilMidnight, todayKey } from '@/lib/dates'

/** Current local date key; rolls over at midnight and re-checks when the app returns to the foreground. */
export function useToday() {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const check = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()))
    const schedule = () => {
      timer = setTimeout(() => {
        check()
        schedule()
      }, msUntilMidnight())
    }
    schedule()
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', check)
    }
  }, [])
  return today
}
