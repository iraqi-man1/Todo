import { useReducedMotion } from 'motion/react'
import { usePrefs } from '@/store/prefs'

export type MotionLevel = 'full' | 'reduced' | 'off'

/** Whether reduced motion is in effect: the user's explicit choice, else the OS preference. */
export function useReduce(): boolean {
  const pref = usePrefs((s) => s.prefs.reducedMotion)
  const system = useReducedMotion() ?? false
  return pref === 'on' || (pref === 'system' && system)
}

/** One coarse level most animations key off. Subtle intensity or reduced motion → 'reduced'. */
export function useMotionLevel(): MotionLevel {
  const intensity = usePrefs((s) => s.prefs.intensity)
  const reduce = useReduce()
  if (intensity === 'off') return 'off'
  if (reduce || intensity === 'subtle') return 'reduced'
  return 'full'
}

/** The same level outside React (event handlers, undo toasts). */
export function currentMotionLevel(): MotionLevel {
  const { intensity, reducedMotion } = usePrefs.getState().prefs
  const system = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (intensity === 'off') return 'off'
  if (reducedMotion === 'on' || (reducedMotion === 'system' && system) || intensity === 'subtle') return 'reduced'
  return 'full'
}

export interface Effects {
  level: MotionLevel
  /** 1 = lively, 0.5 = subtle, 0 = none */
  amp: number
  physics: boolean
  completion: boolean
  celebration: boolean
  parallax: boolean
}

/** Every optional effect in one place, already resolved against intensity and reduced motion. */
export function useEffects(): Effects {
  const prefs = usePrefs((s) => s.prefs)
  const reduce = useReduce()
  const level = useMotionLevel()
  const amp = prefs.intensity === 'off' || reduce ? 0 : prefs.intensity === 'subtle' ? 0.5 : 1
  return {
    level,
    amp,
    physics: prefs.notePhysics && amp > 0,
    completion: prefs.completionEffects && level !== 'off',
    celebration: prefs.celebration && level !== 'off',
    parallax: prefs.parallax && amp > 0,
  }
}

/** Scale a duration (seconds) by motion level. */
export function dur(level: MotionLevel, seconds: number) {
  return level === 'off' ? 0 : level === 'reduced' ? Math.min(seconds, 0.2) : seconds
}
