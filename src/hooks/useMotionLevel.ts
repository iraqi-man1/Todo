import { useReducedMotion } from 'motion/react'
import { usePrefs } from '@/store/prefs'

export type MotionLevel = 'full' | 'reduced' | 'off'

export function useMotionLevel(): MotionLevel {
  const pref = usePrefs((s) => s.prefs.motion)
  const systemReduce = useReducedMotion()
  if (pref === 'auto') return systemReduce ? 'reduced' : 'full'
  return pref
}

/** Scale a duration (seconds) by motion level. */
export function dur(level: MotionLevel, seconds: number) {
  return level === 'off' ? 0 : level === 'reduced' ? Math.min(seconds, 0.2) : seconds
}
