import { db, resetDbForTests } from '@/db/db'
import { addNote, deleteTask, setTaskCompleted, updateTask } from '@/domain/actions'
import { exportData, importData, parseBackup } from '@/domain/backup'
import { addShelfItem, deleteShelfItem, insertFromShelf, renameShelfItem, reorderShelf, ShelfDuplicateError, sortShelf } from '@/domain/shelf'
import { uInsertFromShelf } from '@/domain/undoable'
import { clearHistory, redo, undo } from '@/store/history'

const MON = '2026-10-19'
const WED = '2026-10-21'
beforeEach(async () => {
  await resetDbForTests()
  clearHistory()
})

describe('Task Shelf', () => {
  it('saves a title once, ignoring case and spacing', async () => {
    const a = await addShelfItem('  Go to the  gym ')
    expect(a.created).toBe(true)
    expect(a.item.title).toBe('Go to the gym')
    const b = await addShelfItem('go to the gym')
    expect(b.created).toBe(false)
    expect(b.item.id).toBe(a.item.id)
    expect(await db.shelf.count()).toBe(1)
    await expect(addShelfItem('   ')).rejects.toThrow()
  })

  it('reuses a template on different days as independent tasks', async () => {
    const { item } = await addShelfItem('Go to the gym')
    const mon = await addNote(MON, 'yellow')
    const wed = await addNote(WED, 'mint')
    const r1 = await insertFromShelf(MON, [item.id], { noteId: mon.id })
    const r2 = await insertFromShelf(WED, [item.id], { noteId: wed.id })
    const [m, w] = [r1.added[0], r2.added[0]]
    expect(m.id).not.toBe(w.id)
    expect(m.completed).toBe(false)
    await setTaskCompleted(m.id, true)
    expect((await db.tasks.get(w.id))!.completed).toBe(false)
    // editing a daily copy leaves the template alone, and vice versa
    await updateTask(w.id, { title: 'Gym (legs)' })
    expect((await db.shelf.get(item.id))!.title).toBe('Go to the gym')
    await renameShelfItem(item.id, 'Gym session')
    expect((await db.tasks.get(m.id))!.title).toBe('Go to the gym')
    // deleting either side never removes the other
    await deleteTask(m.id)
    expect(await db.shelf.get(item.id)).toBeDefined()
    await deleteShelfItem(item.id)
    expect(await db.tasks.get(w.id)).toBeDefined()
    // usage is tracked for "recently used"
    expect(r2.added).toHaveLength(1)
  })

  it('skips templates already on the note, but allows them on other days', async () => {
    const a = (await addShelfItem('Read 20 pages')).item
    const b = (await addShelfItem('Drink water')).item
    const mon = await addNote(MON, 'yellow')
    await insertFromShelf(MON, [a.id], { noteId: mon.id })
    const again = await insertFromShelf(MON, [a.id, b.id], { noteId: mon.id })
    expect(again.added.map((t) => t.title)).toEqual(['Drink water'])
    expect(again.skipped.map((s) => s.id)).toEqual([a.id])
    const other = await insertFromShelf(WED, [a.id])
    expect(other.added).toHaveLength(1)
    expect((await db.shelf.get(a.id))!.useCount).toBe(2)
  })

  it('adds several templates as one undoable step', async () => {
    const ids = [(await addShelfItem('A')).item.id, (await addShelfItem('B')).item.id]
    const res = await uInsertFromShelf(MON, ids)
    expect(res.added).toHaveLength(2)
    expect(new Set(res.added.map((t) => t.noteId)).size).toBe(1)
    await undo()
    expect(await db.tasks.where('date').equals(MON).count()).toBe(0)
    expect(await db.shelf.count()).toBe(2)
    await redo()
    expect(await db.tasks.where('date').equals(MON).count()).toBe(2)
  })

  it('refuses a rename that would duplicate another template', async () => {
    await addShelfItem('Gym')
    const { item } = await addShelfItem('Run')
    await expect(renameShelfItem(item.id, 'gym')).rejects.toBeInstanceOf(ShelfDuplicateError)
  })

  it('keeps manual order, offers recency, and survives a backup', async () => {
    const a = (await addShelfItem('A')).item
    const b = (await addShelfItem('B')).item
    const c = (await addShelfItem('C')).item
    expect(sortShelf(await db.shelf.toArray()).map((s) => s.title)).toEqual(['C', 'B', 'A'])
    await reorderShelf([a.id, b.id, c.id])
    expect(sortShelf(await db.shelf.toArray()).map((s) => s.title)).toEqual(['A', 'B', 'C'])
    await insertFromShelf(MON, [b.id])
    expect(sortShelf(await db.shelf.toArray(), 'recent')[0].title).toBe('B')
    const json = JSON.stringify(await exportData())
    await db.shelf.clear()
    await importData(parseBackup(json), 'replace')
    expect(sortShelf(await db.shelf.toArray()).map((s) => s.title)).toEqual(['A', 'B', 'C'])
  })
})
