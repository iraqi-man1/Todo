import { useEffect } from 'react'
import { setAmbientVolume, startAmbient, stopAmbient } from '@/lib/ambient'
import { usePrefs } from '@/store/prefs'

/** Plays rain ambience while enabled. Browsers require a gesture, so we wait for the first one. */
export function useAmbientSound() {
  const on = usePrefs((s) => s.prefs.ambientSound)
  const volume = usePrefs((s) => s.prefs.ambientVolume)
  const intensity = usePrefs((s) => s.prefs.rainIntensity)
  useEffect(() => {
    if (!on) {
      stopAmbient()
      return
    }
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
