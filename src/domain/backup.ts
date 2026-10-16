import { db } from '@/db/db'
import { isValidKey } from '@/lib/dates'
import type {
  AchievementRecord,
  Archive,
  Category,
  DayMeta,
  DayNote,
  Prefs,
  Recurrence,
  RecurrenceRun,
  Task,
  Goal,
} from './types'

export const BACKUP_FORMAT = 'donewall-backup'
export const BACKUP_VERSION = 1

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: {
    tasks: Task[]
    notes: DayNote[]
    days: DayMeta[]
    archives: Archive[]
    categories: Category[]
    recurrences: Recurrence[]
    recurrenceRuns: RecurrenceRun[]
    achievements: AchievementRecord[]
    prefs: Prefs[]
    goals?: Goal[]
  }
}

export async function exportData(): Promise<Backup> {
  const [tasks, notes, days, archives, categories, recurrences, recurrenceRuns, achievements, prefs, goals] = await Promise.all([
    db.tasks.toArray(),
    db.notes.toArray(),
    db.days.toArray(),
    db.archives.toArray(),
    db.categories.toArray(),
    db.recurrences.toArray(),
    db.recurrenceRuns.toArray(),
    db.achievements.toArray(),
    db.prefs.toArray(),
    db.goals.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { tasks, notes, days, archives, categories, recurrences, recurrenceRuns, achievements, prefs, goals },
  }
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/** Validate shape strictly enough that a bad file can never corrupt the database. */
export function parseBackup(raw: unknown): Backup {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      throw new BackupError('not-json')
    }
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT || !isObj(raw.data)) throw new BackupError('not-backup')
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) throw new BackupError('newer-version')
  const d = raw.data
  const arr = (k: string) => {
    const v = d[k] ?? []
    if (!Array.isArray(v)) throw new BackupError('invalid')
    return v.filter(isObj)
  }
  const tasks = arr('tasks').filter(
    (t) => isStr(t.id) && isValidKey(t.date) && isStr(t.noteId) && isStr(t.title) && typeof t.completed === 'boolean',
  ) as unknown as Task[]
  const notes = arr('notes').filter((n) => isStr(n.id) && isValidKey(n.date)) as unknown as DayNote[]
  const days = arr('days').filter((x) => isValidKey(x.date)) as unknown as DayMeta[]
  const archives = arr('archives').filter(
    (a) => isStr(a.id) && isValidKey(a.date) && Array.isArray(a.tasks) && typeof a.total === 'number',
  ) as unknown as Archive[]
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
    data: {
      tasks,
      notes,
      days,
      archives,
      categories: arr('categories').filter((c) => isStr(c.id) && isStr(c.name)) as unknown as Category[],
      recurrences: arr('recurrences').filter((r) => isStr(r.id) && isStr(r.title)) as unknown as Recurrence[],
      recurrenceRuns: arr('recurrenceRuns').filter((r) => isStr(r.key)) as unknown as RecurrenceRun[],
      achievements: arr('achievements').filter((a) => isStr(a.id)) as unknown as AchievementRecord[],
      prefs: arr('prefs').filter((p) => p.id === 'prefs') as unknown as Prefs[],
      goals: arr('goals').filter((g) => isStr(g.id) && isStr(g.title)) as unknown as Goal[],
    },
  }
}

export interface ImportReport {
  added: number
  updated: number
  skipped: number
  archiveConflicts: number
}

type Stamped = { updatedAt?: number }

/**
 * `replace` wipes local data first. `merge` keeps whichever copy of a record is newer, and never lets a
 * backup overwrite an existing wall snapshot for the same date with a different one (the conflict is
 * counted and the local snapshot kept, so the wall can't silently change).
 */
export async function importData(backup: Backup, mode: 'merge' | 'replace'): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skipped: 0, archiveConflicts: 0 }
  const tables = [
    db.tasks,
    db.notes,
    db.days,
    db.archives,
    db.categories,
    db.recurrences,
    db.recurrenceRuns,
    db.achievements,
    db.prefs,
    db.goals,
  ]
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') await Promise.all(tables.map((t) => t.clear()))

    async function mergeTable<T extends Stamped>(table: import('dexie').Table<T, string>, rows: T[], key: (r: T) => string) {
      for (const row of rows) {
        const existing = await table.get(key(row))
        if (!existing) {
          await table.put(row)
          report.added++
        } else if ((row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
          await table.put(row)
          report.updated++
        } else report.skipped++
      }
    }

    const d = backup.data
    await mergeTable(db.tasks, d.tasks, (r) => r.id)
    await mergeTable(db.notes, d.notes, (r) => r.id)
    await mergeTable(db.days, d.days, (r) => r.date)
    await mergeTable(db.categories, d.categories, (r) => r.id)
    await mergeTable(db.recurrences, d.recurrences, (r) => r.id)
    await mergeTable(db.prefs, d.prefs, (r) => r.id)
    await mergeTable(db.goals, d.goals ?? [], (r) => r.id)

    for (const a of d.archives) {
      const sameDate = await db.archives.where('date').equals(a.date).first()
      if (!sameDate) {
        await db.archives.put(a)
        report.added++
      } else if (sameDate.id === a.id) {
        if ((a.updatedAt ?? 0) > (sameDate.updatedAt ?? 0)) {
          await db.archives.put(a)
          report.updated++
        } else report.skipped++
      } else {
        report.archiveConflicts++
      }
    }
    for (const r of d.recurrenceRuns) await db.recurrenceRuns.put(r)
    for (const a of d.achievements) {
      const existing = await db.achievements.get(a.id)
      if (!existing || a.unlockedAt < existing.unlockedAt) await db.achievements.put(a)
    }
  })
  return report
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `donewall-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`
}
