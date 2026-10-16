/**
 * User-facing mutations that can be undone. Each one snapshots the affected rows before and after,
 * so undo/redo restore exact states rather than re-deriving them.
 */
import { db } from '@/db/db'
import { record, type HistoryEntry } from '@/store/history'
import {
  addTask,
  applyNoteSnapshot,
  applyTaskSnapshot,
  applyTaskSnapshots,
  archiveDay,
  deleteNote,
  deleteTask,
  reorderTasks,
  setSubtaskDone,
  restoreArchive,
  toggleTask,
  unarchiveDay,
  updateNote,
  updateTask,
  type TaskInput,
} from './actions'
import { insertFromShelf } from './shelf'
import type { DateKey, DayNote, NoteColor, Task } from './types'

export type UndoLabel =
  | 'taskAdded'
  | 'taskCompleted'
  | 'taskReopened'
  | 'taskDeleted'
  | 'taskEdited'
  | 'tasksReordered'
  | 'noteDeleted'
  | 'noteChanged'
  | 'dayUnpinned'
  | 'dayPinned'
  | 'noteMoved'
  | 'shelfInserted'

function taskEntry(label: UndoLabel, id: string, before: Task | undefined, after: Task | undefined): HistoryEntry {
  const e = { label, undo: () => applyTaskSnapshot(id, before), redo: () => applyTaskSnapshot(id, after) }
  record(e)
  return e
}

export async function uAddTask(date: DateKey, input: TaskInput, opts: { noteId?: string | null; color?: NoteColor } = {}) {
  const t = await addTask(date, input, opts)
  return { task: t, entry: taskEntry('taskAdded', t.id, undefined, t) }
}

export async function uToggleTask(id: string) {
  const before = await db.tasks.get(id)
  await toggleTask(id)
  const after = await db.tasks.get(id)
  return taskEntry(after?.completed ? 'taskCompleted' : 'taskReopened', id, before, after)
}

export async function uUpdateTask(id: string, patch: Parameters<typeof updateTask>[1]) {
  const before = await db.tasks.get(id)
  await updateTask(id, patch)
  const after = await db.tasks.get(id)
  return taskEntry('taskEdited', id, before, after)
}

export async function uDeleteTask(id: string) {
  const before = await deleteTask(id)
  return before ? taskEntry('taskDeleted', id, before, undefined) : null
}

export async function uReorder(noteId: string, orderedIds: string[]) {
  const before = await db.tasks.where('noteId').equals(noteId).toArray()
  await reorderTasks(noteId, orderedIds)
  const after = await db.tasks.where('noteId').equals(noteId).toArray()
  const e = { label: 'tasksReordered' as const, undo: () => applyTaskSnapshots(before), redo: () => applyTaskSnapshots(after) }
  record(e)
  return e
}

export async function uUpdateNote(id: string, patch: Partial<Pick<DayNote, 'title' | 'color'>>) {
  const before = await db.notes.get(id)
  if (!before) return
  await updateNote(id, patch)
  const after = await db.notes.get(id)
  const tasks = () => db.tasks.where('noteId').equals(id).toArray()
  const e = {
    label: 'noteChanged' as const,
    undo: async () => applyNoteSnapshot(id, before, await tasks()),
    redo: async () => applyNoteSnapshot(id, after, await tasks()),
  }
  record(e)
  return e
}

export async function uDeleteNote(id: string) {
  const note = await db.notes.get(id)
  if (!note) return null
  const tasks = await db.tasks.where('noteId').equals(id).toArray()
  await deleteNote(id)
  const e = { label: 'noteDeleted' as const, undo: () => applyNoteSnapshot(id, note, tasks), redo: () => applyNoteSnapshot(id, undefined, []) }
  record(e)
  return e
}

export async function uUnpin(date: DateKey) {
  const archive = await db.archives.where('date').equals(date).first()
  if (!archive) return null
  await unarchiveDay(date)
  const e = { label: 'dayUnpinned' as const, undo: () => restoreArchive(archive), redo: () => unarchiveDay(date) }
  record(e)
  return e
}

export async function uPin(date: DateKey, opts: { stampPressure?: number } = {}) {
  const res = await archiveDay(date, opts)
  if (res.ok && res.created) {
    const archive = res.archive
    record({ label: 'dayPinned', undo: () => unarchiveDay(date), redo: () => restoreArchive(archive) })
  }
  return res
}

export async function uSetSubtask(taskId: string, subId: string, done: boolean) {
  const before = await db.tasks.get(taskId)
  await setSubtaskDone(taskId, subId, done)
  const after = await db.tasks.get(taskId)
  return taskEntry(after?.completed && !before?.completed ? 'taskCompleted' : 'taskEdited', taskId, before, after)
}

/** Add Task Shelf templates to a day as one undoable step. */
export async function uInsertFromShelf(date: DateKey, ids: string[], opts: { noteId?: string | null } = {}) {
  const res = await insertFromShelf(date, ids, opts)
  if (res.added.length) {
    const added = res.added
    record({
      label: 'shelfInserted',
      undo: async () => {
        for (const t of added) await applyTaskSnapshot(t.id, undefined)
      },
      redo: () => applyTaskSnapshots(added),
    })
  }
  return res
}
