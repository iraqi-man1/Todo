import { seededPick } from './colors'
import type { AchievementId, PinStyle, Prefs, StampStyle } from './types'

/** What unlocks each pin and stamp. `null` = available from the start. */
export const PIN_UNLOCKS: Record<PinStyle, AchievementId | null> = {
  red: null,
  brass: null,
  walnut: null,
  sage: null,
  heart: 'three-days',
  gold: 'seven-streak',
  copper: 'hundred-tasks',
  crystal: 'thirty-days',
  star: 'first-month',
}

export const STAMP_UNLOCKS: Record<StampStyle, AchievementId | null> = {
  classic: null,
  star: 'first-note',
  heart: 'three-days',
  laurel: 'seven-streak',
  moon: 'thirty-days',
}

export function unlockedPins(earned: Set<string>): PinStyle[] {
  return (Object.keys(PIN_UNLOCKS) as PinStyle[]).filter((p) => !PIN_UNLOCKS[p] || earned.has(PIN_UNLOCKS[p]!))
}

export function unlockedStamps(earned: Set<string>): StampStyle[] {
  return (Object.keys(STAMP_UNLOCKS) as StampStyle[]).filter((s) => !STAMP_UNLOCKS[s] || earned.has(STAMP_UNLOCKS[s]!))
}

/** Items newly made available by an achievement (for the unlock toast). */
export function itemsUnlockedBy(id: AchievementId): { pins: PinStyle[]; stamps: StampStyle[] } {
  return {
    pins: (Object.keys(PIN_UNLOCKS) as PinStyle[]).filter((p) => PIN_UNLOCKS[p] === id),
    stamps: (Object.keys(STAMP_UNLOCKS) as StampStyle[]).filter((s) => STAMP_UNLOCKS[s] === id),
  }
}

export interface Collection {
  pins: PinStyle[]
  stamps: StampStyle[]
  stamp: StampStyle
  /** Pin for a given note: the chosen one, or a stable pick from unlocked pins when "mixed". */
  pinFor: (seed: string) => PinStyle
}

/** Pure: resolve the user's choices against what they've unlocked (a locked choice falls back safely). */
export function resolveCollection(prefs: Pick<Prefs, 'pinStyle' | 'stampStyle'>, earned: Set<string>): Collection {
  const pins = unlockedPins(earned)
  const stamps = unlockedStamps(earned)
  const stamp = stamps.includes(prefs.stampStyle) ? prefs.stampStyle : 'classic'
  const fixed = prefs.pinStyle !== 'mixed' && pins.includes(prefs.pinStyle) ? prefs.pinStyle : null
  return { pins, stamps, stamp, pinFor: (seed) => fixed ?? seededPick(seed, pins) }
}
