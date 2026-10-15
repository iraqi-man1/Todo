import { db } from '@/db/db'
import { compareKeys, fromKey } from '@/lib/dates'
import { uid } from './ids'
import { summarizeTasks } from './summary'
import type {
  Archive,
  Category,
  DateKey,
  DayMeta,
  DayNote,
  NoteColor,
  Prefs,
  Priority,
  Recurrence,
  Task,
} from './types'
import { DEFAULT_PREFS, NOTE_COLORS } from './types'

const now = () => Date.now()

export class ArchivedDayError extends Error {
  constructor(public date: DateKey) {
    super(`Day ${date} is pinned to the wall. Unpin it to make changes.`)
  }
}

async function assertEditable(date: DateKey) {
  if (await db.archives.where('date').equals(date).count()) throw new ArchivedDayError(date)
}

// ---------------- Notes ----------------

export async function addNote(date: DateKey, color: NoteColor, title = ''): Promise<DayNote> {
  await assertEditable(date)
  const existing = await db.notes.where('date').equals(date).toArray()
  const note: DayNote = {
    id: uid(),
    date,
    title,
    color,
    order: existing.length ? Math.max(...existing.map((n) => n.order)) + 1 : 0,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.notes.add(note)
  return note
}

async function ensureNote(date: DateKey, color: NoteColor): Promise<DayNote> {
  const notes = await db.notes.where('date').equals(date).sortBy('order')
  return notes[0] ?? addNote(date, color)
}

export async function updateNote(id: string, patch: Partial<Pick<DayNote, 'title' | 'color'>>) {
  const note = await db.notes.get(id)
  if (!note) return
  await assertEditable(note.date)
  await db.notes.update(id, { ...patch, updatedAt: now() })
}

export async function deleteNote(id: string) {
  const note = await db.notes.get(id)
  if (!note) return
  await assertEditable(note.date)
  await db.transaction('rw', db.notes, db.tasks, async () => {
    await db.tasks.where('noteId').equals(id).delete()
    await db.notes.delete(id)
  })
}

// ---------------- Tasks ----------------

export interface TaskInput {
  title: string
  description?: string
  priority?: Priority
  dueTime?: string | null
  categoryId?: string | null
  recurrenceId?: string | null
}

export async function addTask(
  date: DateKey,
  input: TaskInput,
  opts: { noteId?: string | null; color?: NoteColor } = {},
): Promise<Task> {
  const title = input.title.trim()
  if (!title) throw new Error('Task title is required')
  await assertEditable(date)
  const note = opts.noteId ? await db.notes.get(opts.noteId) : await ensureNote(date, opts.color ?? 'yellow')
  if (!note || note.date !== date) throw new Error('Note not found for date')
  const siblings = await db.tasks.where('noteId').equals(note.id).toArray()
  const task: Task = {
    id: uid(),
    date,
    noteId: note.id,
    title,
    description: input.description?.trim() ?? '',
    priority: input.priority ?? 'none',
    dueTime: input.dueTime || null,
    categoryId: input.categoryId ?? null,
    completed: false,
    completedAt: null,
    order: siblings.length ? Math.max(...siblings.map((t) => t.order)) + 1 : 0,
    recurrenceId: input.recurrenceId ?? null,
    rescheduledTo: null,
    rescheduledFrom: null,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'dueTime' | 'categoryId' | 'noteId'>>,
) {
  const task = await db.tasks.get(id)
  if (!task) return
  await assertEditable(task.date)
  const clean = { ...patch }
  if (clean.title !== undefined) {
    clean.title = clean.title.trim()
    if (!clean.title) throw new Error('Task title is required')
  }
  if (clean.noteId && clean.noteId !== task.noteId) {
    const target = await db.notes.get(clean.noteId)
    if (!target || target.date !== task.date) throw new Error('Note not found for date')
    const siblings = await db.tasks.where('noteId').equals(clean.noteId).toArray()
    Object.assign(clean, { order: siblings.length ? Math.max(...siblings.map((t) => t.order)) + 1 : 0 })
  }
  await db.tasks.update(id, { ...clean, updatedAt: now() })
}

export async function setTaskCompleted(id: string, completed: boolean) {
  const task = await db.tasks.get(id)
  if (!task) return
  await assertEditable(task.date)
  await db.tasks.update(id, { completed, completedAt: completed ? now() : null, updatedAt: now() })
}

export async function toggleTask(id: string) {
  const task = await db.tasks.get(id)
  if (task) await setTaskCompleted(id, !task.completed)
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  const task = await db.tasks.get(id)
  if (!task) return
  await assertEditable(task.date)
  await db.tasks.delete(id)
  return task
}

/** Undo a delete. Recreates the note if it was removed meanwhile. */
export async function restoreTask(task: Task) {
  await assertEditable(task.date)
  const note = await db.notes.get(task.noteId)
  if (!note) {
    const fallback = await ensureNote(task.date, 'yellow')
    task = { ...task, noteId: fallback.id }
  }
  await db.tasks.put({ ...task, updatedAt: now() })
}

export async function reorderTasks(noteId: string, orderedIds: string[]) {
  const note = await db.notes.get(noteId)
  if (!note) return
  await assertEditable(note.date)
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(orderedIds.map((id, order) => db.tasks.update(id, { order, noteId })))
  })
}

// ---------------- Day meta ----------------

export async function setDayMeta(date: DateKey, patch: Partial<Pick<DayMeta, 'title' | 'personalNote'>>) {
  const existing = await db.days.get(date)
  await db.days.put({ date, title: '', personalNote: '', ...existing, ...patch, updatedAt: now() })
  // Metadata is not part of the task history, so it may be edited on an archived snapshot too.
  const archive = await db.archives.where('date').equals(date).first()
  if (archive) await db.archives.update(archive.id, { ...patch, updatedAt: now() })
}

// ---------------- Archiving ----------------

export type ArchiveResult =
  | { ok: true; archive: Archive; created: boolean }
  | { ok: false; reason: 'empty' | 'incomplete' }

/**
 * Pin a fully-completed day to the wall. Idempotent: a second attempt returns the existing archive.
 * Runs in one transaction so concurrent taps can never create two snapshots.
 */
export async function archiveDay(date: DateKey): Promise<ArchiveResult> {
  return db.transaction('rw', [db.archives, db.tasks, db.notes, db.days, db.categories], async () => {
    const existing = await db.archives.where('date').equals(date).first()
    if (existing) return { ok: true as const, archive: existing, created: false }
    const [tasks, notes, meta, categories] = await Promise.all([
      db.tasks.where('date').equals(date).toArray(),
      db.notes.where('date').equals(date).sortBy('order'),
      db.days.get(date),
      db.categories.toArray(),
    ])
    const summary = summarizeTasks(date, tasks)
    if (summary.total === 0) return { ok: false as const, reason: 'empty' as const }
    if (!summary.complete) return { ok: false as const, reason: 'incomplete' as const }
    const cats = new Map(categories.map((c) => [c.id, c]))
    const noteOrder = new Map(notes.map((n, i) => [n.id, i]))
    const sorted = [...tasks].sort(
      (a, b) => (noteOrder.get(a.noteId) ?? 99) - (noteOrder.get(b.noteId) ?? 99) || a.order - b.order,
    )
    const archive: Archive = {
      id: uid(),
      date,
      title: meta?.title ?? '',
      personalNote: meta?.personalNote ?? '',
      color: notes[0]?.color ?? 'yellow',
      notes: notes.map((n) => ({ id: n.id, title: n.title, color: n.color })),
      tasks: sorted.map((t) => {
        const c = t.categoryId ? cats.get(t.categoryId) : undefined
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          dueTime: t.dueTime,
          categoryName: c?.name ?? null,
          categoryColor: c?.color ?? null,
          completed: t.completed,
          completedAt: t.completedAt,
          noteId: t.noteId,
        }
      }),
      total: summary.total,
      completed: summary.completed,
      percentage: summary.percentage,
      archivedAt: now(),
      updatedAt: now(),
    }
    await db.archives.add(archive)
    return { ok: true as const, archive, created: true }
  })
}

/** Explicitly take a day off the wall so its tasks can be edited again. Live tasks are untouched. */
export async function unarchiveDay(date: DateKey) {
  await db.archives.where('date').equals(date).delete()
}

// ---------------- Rescheduling ----------------

/**
 * Carry unfinished tasks from a past day forward. The original stays in history (marked as moved),
 * and a fresh copy appears on the target day.
 */
export async function rescheduleUnfinished(from: DateKey, to: DateKey): Promise<number> {
  await assertEditable(to)
  return db.transaction('rw', db.tasks, db.notes, db.archives, async () => {
    const open = (await db.tasks.where('date').equals(from).toArray()).filter((t) => !t.completed && !t.rescheduledTo)
    if (!open.length) return 0
    const sourceNotes = new Map((await db.notes.where('date').equals(from).toArray()).map((n) => [n.id, n]))
    const target = await ensureNote(to, sourceNotes.get(open[0].noteId)?.color ?? 'yellow')
    let order = (await db.tasks.where('noteId').equals(target.id).toArray()).reduce((m, t) => Math.max(m, t.order + 1), 0)
    for (const t of open.sort((a, b) => a.order - b.order)) {
      await db.tasks.add({
        ...t,
        id: uid(),
        date: to,
        noteId: target.id,
        order: order++,
        recurrenceId: null,
        rescheduledFrom: from,
        rescheduledTo: null,
        createdAt: now(),
        updatedAt: now(),
      })
      await db.tasks.update(t.id, { rescheduledTo: to, updatedAt: now() })
    }
    return open.length
  })
}

// ---------------- Categories ----------------

export async function addCategory(name: string, color: NoteColor): Promise<Category> {
  const c: Category = { id: uid(), name: name.trim(), color, createdAt: now(), updatedAt: now() }
  if (!c.name) throw new Error('Category name is required')
  await db.categories.add(c)
  return c
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>) {
  await db.categories.update(id, { ...patch, updatedAt: now() })
}

export async function deleteCategory(id: string) {
  await db.transaction('rw', db.categories, db.tasks, db.recurrences, async () => {
    await db.tasks.toCollection().modify((t) => {
      if (t.categoryId === id) t.categoryId = null
    })
    await db.recurrences.toCollection().modify((r) => {
      if (r.categoryId === id) r.categoryId = null
    })
    await db.categories.delete(id)
  })
}

// ---------------- Recurrence ----------------

export function recurrenceMatches(r: Recurrence, date: DateKey): boolean {
  if (!r.active || compareKeys(date, r.startDate) < 0) return false
  const wd = fromKey(date).getDay()
  if (r.frequency === 'daily') return true
  if (r.frequency === 'weekdays') return wd >= 1 && wd <= 5
  return r.weekdays.includes(wd)
}

export async function createRecurrence(
  input: Omit<Recurrence, 'id' | 'createdAt' | 'updatedAt' | 'active'>,
  existingTaskId?: string,
): Promise<Recurrence> {
  const r: Recurrence = { ...input, id: uid(), active: true, createdAt: now(), updatedAt: now() }
  await db.recurrences.add(r)
  if (existingTaskId) {
    const task = await db.tasks.get(existingTaskId)
    if (task) {
      await db.tasks.update(task.id, { recurrenceId: r.id })
      await db.recurrenceRuns.put({ key: `${r.id}|${task.date}`, recurrenceId: r.id, date: task.date })
    }
  }
  return r
}

export async function setRecurrenceActive(id: string, active: boolean) {
  await db.recurrences.update(id, { active, updatedAt: now() })
}

export async function deleteRecurrence(id: string) {
  await db.transaction('rw', db.recurrences, db.recurrenceRuns, db.tasks, async () => {
    await db.recurrences.delete(id)
    await db.recurrenceRuns.where('recurrenceId').equals(id).delete()
    await db.tasks.where('recurrenceId').equals(id).modify({ recurrenceId: null })
  })
}

/**
 * Create today's (or a future day's) instances of recurring tasks. Never back-fills past days, so
 * history only ever contains days the user actually planned.
 */
export async function materializeRecurrences(date: DateKey, today: DateKey, color: NoteColor = 'yellow'): Promise<number> {
  if (compareKeys(date, today) < 0) return 0
  if (await db.archives.where('date').equals(date).count()) return 0
  const recs = (await db.recurrences.toArray()).filter((r) => recurrenceMatches(r, date))
  let created = 0
  for (const r of recs) {
    const key = `${r.id}|${date}`
    const done = await db.transaction('rw', db.recurrenceRuns, db.tasks, db.notes, db.archives, async () => {
      if (await db.recurrenceRuns.get(key)) return false
      await db.recurrenceRuns.put({ key, recurrenceId: r.id, date })
      await addTask(
        date,
        {
          title: r.title,
          description: r.description,
          priority: r.priority,
          categoryId: r.categoryId,
          dueTime: r.dueTime,
          recurrenceId: r.id,
        },
        { color },
      )
      return true
    })
    if (done) created++
  }
  return created
}

// ---------------- Preferences ----------------

export async function loadPrefs(): Promise<Prefs> {
  const p = await db.prefs.get('prefs')
  return { ...DEFAULT_PREFS, ...p }
}

export async function savePrefs(patch: Partial<Omit<Prefs, 'id'>>) {
  const current = await loadPrefs()
  await db.prefs.put({ ...current, ...patch, id: 'prefs', updatedAt: now() })
}

export function nextNoteColor(used: NoteColor[], preferred: NoteColor): NoteColor {
  if (!used.includes(preferred)) return preferred
  return NOTE_COLORS.find((c) => !used.includes(c)) ?? preferred
}

export async function clearAllData() {
  await db.transaction(
    'rw',
    [db.tasks, db.notes, db.days, db.archives, db.categories, db.recurrences, db.recurrenceRuns, db.achievements],
    async () => {
      await Promise.all(
        [db.tasks, db.notes, db.days, db.archives, db.categories, db.recurrences, db.recurrenceRuns, db.achievements].map(
          (t) => t.clear(),
        ),
      )
    },
  )
}
