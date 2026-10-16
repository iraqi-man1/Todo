import { db, resetDbForTests } from '@/db/db'
import {
  addNote, addTask, archiveDay, ArchivedDayError, createRecurrence, deleteTask, materializeRecurrences,
  reorderTasks, rescheduleUnfinished, restoreTask, setTaskCompleted, toggleTask, unarchiveDay, updateTask,
} from '@/domain/actions'

const D = '2026-10-15'
beforeEach(async () => {
  await resetDbForTests()
})

describe('tasks', () => {
  it('creates a task and its note on demand', async () => {
    const t = await addTask(D, { title: '  Buy milk  ' })
    expect(t.title).toBe('Buy milk')
    expect(await db.notes.where('date').equals(D).count()).toBe(1)
  })
  it('rejects empty titles', async () => {
    await expect(addTask(D, { title: '   ' })).rejects.toThrow()
  })
  it('edits, completes, undoes, and deletes with restore', async () => {
    const t = await addTask(D, { title: 'A' })
    await updateTask(t.id, { title: 'B', priority: 'high', dueTime: '09:30' })
    expect(await db.tasks.get(t.id)).toMatchObject({ title: 'B', priority: 'high', dueTime: '09:30' })
    await toggleTask(t.id)
    expect((await db.tasks.get(t.id))!.completed).toBe(true)
    await toggleTask(t.id)
    expect((await db.tasks.get(t.id))!.completedAt).toBeNull()
    const removed = await deleteTask(t.id)
    expect(await db.tasks.get(t.id)).toBeUndefined()
    await restoreTask(removed!)
    expect(await db.tasks.get(t.id)).toBeDefined()
  })
  it('reorders tasks', async () => {
    const note = await addNote(D, 'mint')
    const a = await addTask(D, { title: 'a' }, { noteId: note.id })
    const b = await addTask(D, { title: 'b' }, { noteId: note.id })
    await reorderTasks(note.id, [b.id, a.id])
    const sorted = (await db.tasks.where('noteId').equals(note.id).toArray()).sort((x, y) => x.order - y.order)
    expect(sorted.map((t) => t.title)).toEqual(['b', 'a'])
  })
  it('handles hundreds of tasks', async () => {
    for (let i = 0; i < 300; i++) await addTask(D, { title: `t${i}` })
    expect(await db.tasks.where('date').equals(D).count()).toBe(300)
  })
})

describe('archiving', () => {
  it('refuses empty and incomplete days', async () => {
    expect(await archiveDay(D)).toEqual({ ok: false, reason: 'empty' })
    const t = await addTask(D, { title: 'x' })
    expect(await archiveDay(D)).toEqual({ ok: false, reason: 'incomplete' })
    await setTaskCompleted(t.id, true)
    expect((await archiveDay(D)).ok).toBe(true)
  })
  it('never creates duplicates, even on concurrent attempts', async () => {
    const t = await addTask(D, { title: 'x' })
    await setTaskCompleted(t.id, true)
    const results = await Promise.all([archiveDay(D), archiveDay(D), archiveDay(D)])
    expect(results.every((r) => r.ok)).toBe(true)
    expect(await db.archives.where('date').equals(D).count()).toBe(1)
    expect(results.filter((r) => r.ok && r.created)).toHaveLength(1)
  })
  it('keeps a historically accurate snapshot and locks the day', async () => {
    const t = await addTask(D, { title: 'Original' })
    await setTaskCompleted(t.id, true)
    await archiveDay(D)
    await expect(updateTask(t.id, { title: 'Changed' })).rejects.toBeInstanceOf(ArchivedDayError)
    await expect(addTask(D, { title: 'more' })).rejects.toBeInstanceOf(ArchivedDayError)
    // even a direct DB edit can't change the snapshot
    await db.tasks.update(t.id, { title: 'Sneaky' })
    const a = await db.archives.where('date').equals(D).first()
    expect(a!.tasks[0].title).toBe('Original')
    expect(a).toMatchObject({ total: 1, completed: 1, percentage: 100 })
  })
  it('can be unpinned explicitly to allow editing again', async () => {
    const t = await addTask(D, { title: 'x' })
    await setTaskCompleted(t.id, true)
    await archiveDay(D)
    await unarchiveDay(D)
    await addTask(D, { title: 'after unpin' })
    expect(await db.tasks.where('date').equals(D).count()).toBe(2)
  })
})

describe('rescheduling', () => {
  it('copies unfinished work forward and marks the original as moved', async () => {
    const a = await addTask('2026-10-14', { title: 'done' })
    await addTask('2026-10-14', { title: 'open' })
    await setTaskCompleted(a.id, true)
    expect(await rescheduleUnfinished('2026-10-14', D)).toBe(1)
    const moved = await db.tasks.where('date').equals(D).toArray()
    expect(moved).toHaveLength(1)
    expect(moved[0]).toMatchObject({ title: 'open', rescheduledFrom: '2026-10-14', completed: false })
    const original = (await db.tasks.where('date').equals('2026-10-14').toArray()).find((t) => t.title === 'open')
    expect(original!.rescheduledTo).toBe(D)
    expect(await rescheduleUnfinished('2026-10-14', D)).toBe(0) // idempotent
  })
})

describe('recurrence', () => {
  it('materialises once per day and never back-fills the past', async () => {
    await createRecurrence({ title: 'Stretch', description: '', priority: 'none', categoryId: null, dueTime: null, frequency: 'daily', weekdays: [], startDate: '2026-10-01' })
    expect(await materializeRecurrences(D, D)).toBe(1)
    expect(await materializeRecurrences(D, D)).toBe(0)
    expect(await materializeRecurrences('2026-10-10', D)).toBe(0)
    const [t] = await db.tasks.where('date').equals(D).toArray()
    await deleteTask(t.id)
    expect(await materializeRecurrences(D, D)).toBe(0) // deleted instance stays deleted
  })
})
