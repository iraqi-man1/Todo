import { db, resetDbForTests } from '@/db/db'
import { addNote, setTaskCompleted } from '@/domain/actions'
import { uAddTask, uDeleteNote, uDeleteTask, uPin, uReorder, uToggleTask, uUnpin, uUpdateNote } from '@/domain/undoable'
import { clearHistory, redo, undo, undoEntry, useHistory } from '@/store/history'
import { resolveOffset } from '@/components/wall/drag'

const D = '2026-10-16'
beforeEach(async () => {
  await resetDbForTests()
  clearHistory()
})

describe('undo / redo', () => {
  it('undoes and redoes completion, add and delete', async () => {
    const { task } = await uAddTask(D, { title: 'A' })
    await uToggleTask(task.id)
    expect((await db.tasks.get(task.id))!.completed).toBe(true)
    await undo()
    expect((await db.tasks.get(task.id))!.completed).toBe(false)
    await redo()
    expect((await db.tasks.get(task.id))!.completed).toBe(true)
    await uDeleteTask(task.id)
    expect(await db.tasks.get(task.id)).toBeUndefined()
    await undo()
    expect((await db.tasks.get(task.id))!.title).toBe('A')
    await undo() // completion
    await undo() // add
    expect(await db.tasks.count()).toBe(0)
    await redo()
    expect(await db.tasks.count()).toBe(1)
  })

  it('a new action clears the redo stack', async () => {
    const { task } = await uAddTask(D, { title: 'A' })
    await uToggleTask(task.id)
    await undo()
    expect(useHistory.getState().future).toHaveLength(1)
    await uAddTask(D, { title: 'B' })
    expect(useHistory.getState().future).toHaveLength(0)
  })

  it('restores a deleted note with all of its tasks', async () => {
    const note = await addNote(D, 'mint', 'Errands')
    await uAddTask(D, { title: 'x' }, { noteId: note.id })
    await uAddTask(D, { title: 'y' }, { noteId: note.id })
    await uUpdateNote(note.id, { color: 'coral' })
    await uDeleteNote(note.id)
    expect(await db.notes.count()).toBe(0)
    await undo()
    expect((await db.notes.get(note.id))!.color).toBe('coral')
    expect(await db.tasks.where('noteId').equals(note.id).count()).toBe(2)
    await undo()
    expect((await db.notes.get(note.id))!.color).toBe('mint')
  })

  it('restores order after a reorder', async () => {
    const note = await addNote(D, 'yellow')
    const a = (await uAddTask(D, { title: 'a' }, { noteId: note.id })).task
    const b = (await uAddTask(D, { title: 'b' }, { noteId: note.id })).task
    await uReorder(note.id, [b.id, a.id])
    await undo()
    const sorted = (await db.tasks.toArray()).sort((x, y) => x.order - y.order)
    expect(sorted.map((t) => t.title)).toEqual(['a', 'b'])
  })

  it('undoing an unpin puts back the exact same snapshot', async () => {
    const { task } = await uAddTask(D, { title: 'x' })
    await setTaskCompleted(task.id, true)
    const res = await uPin(D)
    expect(res.ok).toBe(true)
    const original = await db.archives.where('date').equals(D).first()
    await uUnpin(D)
    expect(await db.archives.count()).toBe(0)
    await undo()
    expect(await db.archives.where('date').equals(D).first()).toEqual(original)
  })

  it('drops an entry whose undo is no longer possible instead of looping on it', async () => {
    const { task } = await uAddTask(D, { title: 'x' })
    await setTaskCompleted(task.id, true)
    const entry = useHistory.getState().past[0]
    await uPin(D) // day is now locked
    await undo() // undo the pin -> unlocked
    await expect(undoEntry(entry)).resolves.toBeTruthy()
    expect(await db.tasks.count()).toBe(0)
  })
})

describe('wall note repositioning', () => {
  const home = { x: 0, y: 0, w: 140, h: 150 }
  const limit = { x: 72, y: 77 }
  it('snaps to the grid and clamps to the slot radius', () => {
    expect(resolveOffset({ x: 13, y: -5 }, { x: 0, y: 0 }, home, [], limit)).toEqual({ x: 16, y: -8 })
    expect(resolveOffset({ x: 500, y: 0 }, { x: 0, y: 0 }, home, [], limit)).toEqual({ x: 72, y: 0 })
  })
  it('never overlaps a neighbouring note', () => {
    const neighbour = { x: 162, y: 0, w: 140, h: 150 }
    const o = resolveOffset({ x: 70, y: 0 }, { x: 0, y: 0 }, home, [neighbour], limit)
    expect(home.x + o.x + home.w + 6).toBeLessThanOrEqual(neighbour.x)
  })
  it('moves freely into an empty neighbouring slot', () => {
    expect(resolveOffset({ x: 64, y: 40 }, { x: 0, y: 0 }, home, [], limit)).toEqual({ x: 64, y: 40 })
  })
})
