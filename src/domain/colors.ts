import type { NoteColor } from './types'

export const NOTE_HEX: Record<NoteColor, string> = {
  yellow: '#FFF0A8',
  pink: '#F8C9CE',
  mint: '#D4EBCB',
  lavender: '#DDD4F8',
  peach: '#FFD9BD',
  blue: '#CFE5F5',
  sand: '#EFE1C6',
  coral: '#F9C6B4',
  aqua: '#C8EAE4',
  rose: '#EDCDE4',
}

/** Deeper ink versions, used for small indicators on light surfaces. */
export const NOTE_INK: Record<NoteColor, string> = {
  yellow: '#C9A227',
  pink: '#D47A86',
  mint: '#6FA563',
  lavender: '#8C7AD6',
  peach: '#E0915A',
  blue: '#5E9BC8',
  sand: '#B89A62',
  coral: '#D9775A',
  aqua: '#4FA69A',
  rose: '#B76CA2',
}

/** Deterministic small rotation for a date so notes look hand-placed but never shuffle between renders. */
export function noteRotation(seed: string, max = 3.2): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const unit = ((h >>> 0) % 1000) / 1000
  return Math.round((unit * 2 - 1) * max * 10) / 10
}

export function seededPick<T>(seed: string, items: readonly T[]): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return items[Math.abs(h) % items.length]
}
