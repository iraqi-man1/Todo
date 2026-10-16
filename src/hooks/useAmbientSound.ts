import { useEffect } from 'react'
import { setAmbientVolume, setAmbientWeather, startAmbient, stopAmbient } from '@/lib/ambient'
import { useSky } from './useSky'
import { usePrefs } from '@/store/prefs'

/**
 * Plays the window's weather (rain, snow hush, wind in leaves, a clear night) while enabled; weather
 * changes crossfade. Browsers require a gesture, so we wait for the first one.
 */
export function useAmbientSound() {
  const on = usePrefs((s) => s.prefs.ambientSound)
  const volume = usePrefs((s) => s.prefs.ambientVolume)
  const intensity = usePrefs((s) => s.prefs.rainIntensity)
  const effects = usePrefs((s) => s.prefs.rain)
  const sky = useSky()
  // with weather effects off the window is just rainy-night glass, so keep the classic rain
  const weather = effects ? sky.weather : 'rain'
  useEffect(() => setAmbientWeather(weather), [weather])
  useEffect(() => {
    if (!on) {
      stopAmbient()
      return
    }
    // startAmbient picks up the weather last set by the effect above
    const start = () => startAmbient(volume, intensity)
    const onVis = () => (document.visibilityState === 'visible' ? start() : stopAmbient())
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [on, volume, intensity])
  useEffect(() => setAmbientVolume(volume, intensity), [volume, intensity])
  useEffect(() => () => stopAmbient(), [])
}
