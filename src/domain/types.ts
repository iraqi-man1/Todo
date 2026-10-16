/** Local calendar date in `yyyy-MM-dd` form. Assigned from the device's local time when created. */
export type DateKey = string

export const NOTE_COLORS = ['yellow', 'pink', 'mint', 'lavender', 'peach', 'blue', 'sand', 'coral', 'aqua', 'rose'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export const MOODS = ['great', 'good', 'okay', 'low', 'tired'] as const
export type Mood = (typeof MOODS)[number]
export const MOOD_EMOJI: Record<Mood, string> = { great: '😄', good: '🙂', okay: '😐', low: '😔', tired: '😴' }

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
  /** Small checklist inside a task. */
  subtasks?: Subtask[]
  /** Big goal this task contributes to. */
  goalId?: string | null
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
  mood?: Mood | null
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
  subtasks?: Subtask[]
  goalId?: string | null
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
  /** User nudge of the note inside its wall slot, in board pixels (snapped). */
  offset?: { x: number; y: number }
  mood?: Mood | null
  /** How hard the DONE stamp was pressed when pinning (0–1); older snapshots don't have it. */
  stampPressure?: number
}

/**
 * A reusable task on the Task Shelf. A template only: adding it to a day copies the title into a new,
 * independent task, so templates and daily tasks never affect each other.
 */
export interface ShelfItem {
  id: string
  title: string
  /** Manual order on the shelf (ascending). */
  order: number
  /** Last time it was added to a day, for "recently used". */
  lastUsedAt: number | null
  useCount: number
  createdAt: number
  updatedAt: number
}

/** A bigger goal that daily tasks feed into. */
export interface Goal {
  id: string
  title: string
  description: string
  color: NoteColor
  /** Number of linked tasks to finish; null = all linked tasks. */
  target: number | null
  dueDate: DateKey | null
  achievedAt: number | null
  createdAt: number
  updatedAt: number
}

export const PIN_STYLES = ['red', 'brass', 'walnut', 'sage', 'gold', 'copper', 'crystal', 'star', 'heart'] as const
export type PinStyle = (typeof PIN_STYLES)[number]
export const STAMP_STYLES = ['classic', 'star', 'laurel', 'heart', 'moon'] as const
export type StampStyle = (typeof STAMP_STYLES)[number]
export type WeatherPref = 'auto' | 'rain' | 'snow' | 'leaves' | 'clear'
export type SkyPref = 'live' | 'night'

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

export type ThemePref = 'night' | 'system' | 'light' | 'dark'
export type WoodTheme = 'light-oak' | 'natural-oak' | 'dark-walnut'
/** @deprecated replaced by `intensity` + `reducedMotion`; kept so old saved prefs can be migrated. */
export type MotionPref = 'auto' | 'full' | 'reduced' | 'off'
export type Intensity = 'off' | 'subtle' | 'lively'
export type ReducedMotionPref = 'system' | 'on' | 'off'
export type WallpaperMode = 'fill' | 'fit' | 'center'
export type Language = 'en' | 'ar'
export type DateFormatPref = 'friendly' | 'dmy' | 'mdy' | 'iso'

export interface Prefs {
  id: 'prefs'
  name: string
  theme: ThemePref
  wood: WoodTheme
  motion: MotionPref
  sound: boolean
  /** Sound effects volume */
  volume: number
  /** Rain ambience volume, independent of effects */
  ambientVolume: number
  weekStartsOn: 0 | 1 | 6
  language: Language
  dateFormat: DateFormatPref
  defaultNoteColor: NoteColor
  showMotivation: boolean
  remindersEnabled: boolean
  reminderTime: string
  /** Cozy Night environment */
  rain: boolean
  rainIntensity: number
  ambient: boolean
  lamp: number
  showWindow: boolean
  ambientSound: boolean
  focusMode: boolean
  /** Motion & Effects */
  intensity: Intensity
  reducedMotion: ReducedMotionPref
  notePhysics: boolean
  completionEffects: boolean
  celebration: boolean
  parallax: boolean
  /** Active custom wallpapers (ids in the wallpapers table); null = the original DoneWall scene. */
  wallpaperWorkspace: string | null
  wallpaperWindow: string | null
  /** Collection */
  pinStyle: 'mixed' | PinStyle
  stampStyle: StampStyle
  /** Window weather and sky */
  weather: WeatherPref
  sky: SkyPref
  /** The first-run tour has been seen (or skipped). */
  onboarded: boolean
  /** Short vibrations on phones for checks and pins. */
  haptics: boolean
  printPaper: 'A4' | 'A3'
  updatedAt: number
}

/** A user wallpaper, stored locally. Image bytes are kept once; settings travel with the image. */
export interface Wallpaper {
  id: string
  name: string
  /** SHA-256 of the original file, used to avoid storing the same image twice. */
  hash: string
  type: string
  data: ArrayBuffer
  thumb: ArrayBuffer
  width: number
  height: number
  mode: WallpaperMode
  /** Focal point, 0–100 % */
  posX: number
  posY: number
  /** Crop zoom, ≥ 1 */
  zoom: number
  brightness: number
  blur: number
  opacity: number
  overlay: number
  parallax: number
  createdAt: number
  updatedAt: number
}

export const DEFAULT_PREFS: Prefs = {
  id: 'prefs',
  name: '',
  theme: 'night',
  wood: 'natural-oak',
  motion: 'auto',
  sound: false,
  volume: 0.5,
  ambientVolume: 0.4,
  weekStartsOn: 1,
  language: 'en',
  dateFormat: 'friendly',
  defaultNoteColor: 'yellow',
  showMotivation: true,
  remindersEnabled: false,
  reminderTime: '20:00',
  rain: true,
  rainIntensity: 0.5,
  ambient: true,
  lamp: 0.7,
  showWindow: true,
  ambientSound: false,
  focusMode: false,
  intensity: 'lively',
  reducedMotion: 'system',
  notePhysics: true,
  completionEffects: true,
  celebration: true,
  parallax: true,
  wallpaperWorkspace: null,
  wallpaperWindow: null,
  pinStyle: 'mixed',
  stampStyle: 'classic',
  weather: 'auto',
  sky: 'live',
  onboarded: false,
  haptics: true,
  printPaper: 'A4',
  updatedAt: 0,
}

/** Map preferences saved by older versions onto the current shape. Pure, so it can be tested. */
export function migratePrefs(raw: Partial<Prefs> | undefined): Prefs {
  const p = { ...DEFAULT_PREFS, ...raw }
  if (raw && raw.intensity === undefined && raw.motion) {
    const map: Record<MotionPref, Pick<Prefs, 'intensity' | 'reducedMotion'>> = {
      auto: { intensity: 'lively', reducedMotion: 'system' },
      full: { intensity: 'lively', reducedMotion: 'off' },
      reduced: { intensity: 'subtle', reducedMotion: 'system' },
      off: { intensity: 'off', reducedMotion: 'system' },
    }
    Object.assign(p, map[raw.motion] ?? {})
  }
  // People who used the app before the tour existed don't need it.
  if (raw && raw.onboarded === undefined) p.onboarded = true
  return p
}
