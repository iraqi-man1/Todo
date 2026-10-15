/** Local calendar date in `yyyy-MM-dd` form. Assigned from the device's local time when created. */
export type DateKey = string

export const NOTE_COLORS = ['yellow', 'pink', 'mint', 'lavender', 'peach', 'blue'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export interface Task {
  id: string
  date: DateKey
  noteId: string
  title: string
  description: string
  priority: Priority
  /** `HH:mm`, local */
  dueTime: string | null
  categoryId: string | null
  completed: boolean
  completedAt: number | null
  order: number
  recurrenceId: string | null
  /** When unfinished work was carried forward, the date it moved to. */
  rescheduledTo: DateKey | null
  rescheduledFrom: DateKey | null
  createdAt: number
  updatedAt: number
}

export interface DayNote {
  id: string
  date: DateKey
  title: string
  color: NoteColor
  order: number
  createdAt: number
  updatedAt: number
}

export interface DayMeta {
  date: DateKey
  title: string
  personalNote: string
  updatedAt: number
}

export interface ArchivedTask {
  id: string
  title: string
  description: string
  priority: Priority
  dueTime: string | null
  categoryName: string | null
  categoryColor: NoteColor | null
  completed: boolean
  completedAt: number | null
  noteId: string
}

/** A frozen snapshot of a day, pinned to the wall. One per date. */
export interface Archive {
  id: string
  date: DateKey
  title: string
  personalNote: string
  color: NoteColor
  notes: { id: string; title: string; color: NoteColor }[]
  tasks: ArchivedTask[]
  total: number
  completed: number
  percentage: number
  archivedAt: number
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  color: NoteColor
  createdAt: number
  updatedAt: number
}

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly'

export interface Recurrence {
  id: string
  title: string
  description: string
  priority: Priority
  categoryId: string | null
  dueTime: string | null
  frequency: RecurrenceFrequency
  /** 0 = Sunday … 6 = Saturday; used by `weekly` */
  weekdays: number[]
  startDate: DateKey
  active: boolean
  createdAt: number
  updatedAt: number
}

/** Marks that a recurrence was materialised for a date, so deleting an instance never resurrects it. */
export interface RecurrenceRun {
  key: string
  recurrenceId: string
  date: DateKey
}

export type AchievementId =
  | 'first-note'
  | 'three-days'
  | 'seven-streak'
  | 'thirty-days'
  | 'hundred-tasks'
  | 'first-month'

export interface AchievementRecord {
  id: AchievementId
  unlockedAt: number
}

export type ThemePref = 'system' | 'light' | 'dark'
export type WoodTheme = 'light-oak' | 'natural-oak' | 'dark-walnut'
export type MotionPref = 'auto' | 'full' | 'reduced' | 'off'
export type Language = 'en' | 'ar'
export type DateFormatPref = 'friendly' | 'dmy' | 'mdy' | 'iso'

export interface Prefs {
  id: 'prefs'
  name: string
  theme: ThemePref
  wood: WoodTheme
  motion: MotionPref
  sound: boolean
  volume: number
  weekStartsOn: 0 | 1 | 6
  language: Language
  dateFormat: DateFormatPref
  defaultNoteColor: NoteColor
  showMotivation: boolean
  remindersEnabled: boolean
  reminderTime: string
  updatedAt: number
}

export const DEFAULT_PREFS: Prefs = {
  id: 'prefs',
  name: '',
  theme: 'system',
  wood: 'natural-oak',
  motion: 'auto',
  sound: false,
  volume: 0.5,
  weekStartsOn: 1,
  language: 'en',
  dateFormat: 'friendly',
  defaultNoteColor: 'yellow',
  showMotivation: true,
  remindersEnabled: false,
  reminderTime: '20:00',
  updatedAt: 0,
}
