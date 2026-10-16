import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { DateKey } from '@/domain/types'

const KEY_FORMAT = 'yyyy-MM-dd'
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export type WeekStart = 0 | 1 | 6

/** Local date key. Timezone changes never alter a stored key; keys are calendar days, not instants. */
export function toKey(date: Date): DateKey {
  return format(date, KEY_FORMAT)
}

/** Parse a key as local midnight. */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isValidKey(key: unknown): key is DateKey {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return false
  const d = parse(key, KEY_FORMAT, new Date())
  return isValid(d) && toKey(d) === key
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now)
}

export function addDaysKey(key: DateKey, n: number): DateKey {
  return toKey(addDays(fromKey(key), n))
}

export function addMonthsKey(key: DateKey, n: number): DateKey {
  return toKey(addMonths(fromKey(key), n))
}

export function diffDays(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromKey(a), fromKey(b))
}

export function compareKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function weekDays(key: DateKey, weekStartsOn: WeekStart): DateKey[] {
  const d = fromKey(key)
  return eachDayOfInterval({
    start: startOfWeek(d, { weekStartsOn }),
    end: endOfWeek(d, { weekStartsOn }),
  }).map(toKey)
}

export function monthDays(key: DateKey): DateKey[] {
  const d = fromKey(key)
  return eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) }).map(toKey)
}

/** Calendar grid for a month: leading/trailing nulls so rows are full weeks. */
export function monthGrid(key: DateKey, weekStartsOn: WeekStart): (DateKey | null)[] {
  const days = monthDays(key)
  const first = fromKey(days[0]).getDay()
  const lead = (first - weekStartsOn + 7) % 7
  const cells: (DateKey | null)[] = [...Array(lead).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  return cells
}

/** Weekday indices (0 = Sunday) in display order. */
export function weekdayOrder(weekStartsOn: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7)
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7)
}

export function isoWeek(key: DateKey): number {
  return getISOWeek(fromKey(key))
}

/** Milliseconds until the next local midnight. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50)
  return next.getTime() - now.getTime()
}
