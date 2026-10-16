import { usePrefs } from '@/store/prefs'

const PATTERNS = {
  tap: 8,
  success: [14, 50, 22],
  pin: [24, 40, 12],
} satisfies Record<string, number | number[]>

export type Haptic = keyof typeof PATTERNS

/** A short vibration on devices that support it (Android browsers); a silent no-op elsewhere. */
export function haptic(kind: Haptic) {
  if (!usePrefs.getState().prefs.haptics) return
  try {
    navigator.vibrate?.(PATTERNS[kind])
  } catch {
    // some browsers throw when vibration is blocked by policy
  }
}

export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
