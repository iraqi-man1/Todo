import Dexie, { type Table } from 'dexie'
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
  Wallpaper,
} from '@/domain/types'

export class DoneWallDB extends Dexie {
  tasks!: Table<Task, string>
  notes!: Table<DayNote, string>
  days!: Table<DayMeta, string>
  archives!: Table<Archive, string>
  categories!: Table<Category, string>
  recurrences!: Table<Recurrence, string>
  recurrenceRuns!: Table<RecurrenceRun, string>
  achievements!: Table<AchievementRecord, string>
  prefs!: Table<Prefs, string>
  wallpapers!: Table<Wallpaper, string>

  constructor(name = 'donewall', deps?: { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange }) {
    super(name, deps)
    // Schema v1. Add new `this.version(n)` blocks (with `.upgrade()`) for migrations; never edit old ones.
    this.version(1).stores({
      tasks: 'id, date, noteId, recurrenceId, updatedAt',
      notes: 'id, date',
      days: 'date',
      archives: 'id, &date, archivedAt',
      categories: 'id',
      recurrences: 'id',
      recurrenceRuns: 'key, recurrenceId, date',
      achievements: 'id',
      prefs: 'id',
    })
    // v2: locally stored custom wallpapers. Additive; existing data is untouched.
    this.version(2).stores({
      wallpapers: 'id, hash, createdAt',
    })
  }
}

export let db = new DoneWallDB()

/** Fires after any committed write, so the UI can show a calm "saved" state. */
type WriteListener = () => void
const writeListeners = new Set<WriteListener>()
export function onWrite(fn: WriteListener) {
  writeListeners.add(fn)
  return () => writeListeners.delete(fn)
}
function watchWrites(target: DoneWallDB) {
  for (const table of target.tables) {
    const notify = (trans: { on: (e: 'complete', fn: () => void) => void }) => trans.on('complete', () => writeListeners.forEach((f) => f()))
    table.hook('creating', function (_k, _o, trans) {
      notify(trans)
    })
    table.hook('updating', function (_m, _k, _o, trans) {
      notify(trans)
    })
    table.hook('deleting', function (_k, _o, trans) {
      notify(trans)
    })
  }
}
watchWrites(db)

export type StorageStatus = 'persistent' | 'ok' | 'memory'
let status: StorageStatus = 'ok'
export const storageStatus = () => status

/**
 * Open the database. If IndexedDB is unavailable (some private modes, blocked storage, corruption),
 * fall back to an in-memory store so the app still works for the session, and report it.
 */
export async function initDb(): Promise<StorageStatus> {
  try {
    await db.open()
    try {
      if (navigator.storage?.persist) {
        status = (await navigator.storage.persisted()) || (await navigator.storage.persist()) ? 'persistent' : 'ok'
      }
    } catch {
      status = 'ok'
    }
  } catch (err) {
    console.error('DoneWall: IndexedDB unavailable, using in-memory storage', err)
    const fake = await import('fake-indexeddb')
    db = new DoneWallDB('donewall-memory', { indexedDB: fake.indexedDB, IDBKeyRange: fake.IDBKeyRange })
    watchWrites(db)
    await db.open()
    status = 'memory'
  }
  return status
}

/** Test helper: point the module at a fresh database. */
export async function resetDbForTests(): Promise<void> {
  db.close()
  await Dexie.delete(db.name)
  db = new DoneWallDB(db.name)
  watchWrites(db)
  await db.open()
}
