import type { WeatherPref } from '@/domain/types'

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export type Weather = 'rain' | 'snow' | 'leaves' | 'clear'

/** Local time of day → sky phase. Dawn 5–7, day 7–17, dusk 17–19:30, night otherwise. */
export function skyPhase(d: Date): SkyPhase {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 5 && h < 7) return 'dawn'
  if (h >= 7 && h < 17) return 'day'
  if (h >= 17 && h < 19.5) return 'dusk'
  return 'night'
}

/** Northern-hemisphere meteorological seasons. */
export function seasonOf(d: Date): Season {
  const m = d.getMonth()
  if (m === 11 || m <= 1) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'autumn'
}

const BY_SEASON: Record<Season, Weather> = { winter: 'snow', spring: 'rain', summer: 'clear', autumn: 'leaves' }

export function weatherFor(pref: WeatherPref, season: Season): Weather {
  return pref === 'auto' ? BY_SEASON[season] : pref
}
