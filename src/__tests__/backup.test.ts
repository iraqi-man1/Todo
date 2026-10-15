import { db, resetDbForTests } from '@/db/db'
import { addTask, archiveDay, setTaskCompleted } from '@/domain/actions'
import { BackupError, exportData, importData, parseBackup } from '@/domain/backup'

beforeEach(async () => {
  await resetDbForTests()
})

async function pinned(date: string, title: string) {
  const t = await addTask(date, { title })
  await setTaskCompleted(t.id, true)
  await archiveDay(date)
}

describe('backup', () => {
  it('round-trips through JSON with replace', async () => {
    await pinned('2026-10-14', 'Walk')
    await addTask('2026-10-15', { title: 'Open' })
    const json = JSON.stringify(await exportData())
    await db.tasks.clear()
    await db.archives.clear()
    const r = await importData(parseBackup(json), 'replace')
    expect(r.added).toBeGreaterThan(0)
    expect(await db.tasks.count()).toBe(2)
    expect((await db.archives.toArray())[0].tasks[0].title).toBe('Walk')
  })
  it('rejects garbage and future versions', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup({ hello: 1 })).toThrow(BackupError)
    expect(() => parseBackup({ format: 'donewall-backup', version: 99, data: {} })).toThrow('newer-version')
  })
  it('drops malformed records instead of corrupting the database', () => {
    const b = parseBackup({ format: 'donewall-backup', version: 1, data: { tasks: [{ id: 1 }, { id: 'ok', date: 'bad' }] } })
    expect(b.data.tasks).toHaveLength(0)
  })
  it('merge keeps the local wall note when a backup has a different one for the same date', async () => {
    await pinned('2026-10-14', 'Local')
    const backup = await exportData()
    backup.data.archives[0] = { ...backup.data.archives[0], id: 'other', tasks: [{ ...backup.data.archives[0].tasks[0], title: 'Remote' }] }
    const r = await importData(backup, 'merge')
    expect(r.archiveConflicts).toBe(1)
    const archives = await db.archives.toArray()
    expect(archives).toHaveLength(1)
    expect(archives[0].tasks[0].title).toBe('Local')
  })
  it('merge prefers newer records', async () => {
    const t = await addTask('2026-10-15', { title: 'Old' })
    const backup = await exportData()
    backup.data.tasks[0] = { ...backup.data.tasks[0], title: 'New', updatedAt: t.updatedAt + 1000 }
    await importData(backup, 'merge')
    expect((await db.tasks.get(t.id))!.title).toBe('New')
  })
})
