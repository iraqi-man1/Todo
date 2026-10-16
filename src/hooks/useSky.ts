import { useEffect, useState } from 'react'
import { seasonOf, skyPhase, weatherFor, type Season, type SkyPhase, type Weather } from '@/lib/sky'
import { usePrefs } from '@/store/prefs'

/** Current sky phase, season and weather. Re-evaluated once a minute (and when the app returns). */
export function useSky(): { phase: SkyPhase; season: Season; weather: Weather } {
  const skyPref = usePrefs((s) => s.prefs.sky)
  const weatherPref = usePrefs((s) => s.prefs.weather)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 60_000)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  const season = seasonOf(now)
  return { phase: skyPref === 'live' ? skyPhase(now) : 'night', season, weather: weatherFor(weatherPref, season) }
}
