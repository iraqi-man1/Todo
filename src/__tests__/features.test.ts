import { db, resetDbForTests } from '@/db/db'
import { addGoal, addTask, deleteGoal, goalProgress, setDayMeta, updateTask } from '@/domain/actions'
import { exportData, importData, parseBackup } from '@/domain/backup'
import { resolveCollection, unlockedPins, unlockedStamps } from '@/domain/collection'
import { moodStats } from '@/domain/stats'
import type { DaySummary } from '@/domain/summary'
import type { Mood } from '@/domain/types'
import { uSetSubtask } from '@/domain/undoable'
import { seasonOf, skyPhase, weatherFor } from '@/lib/sky'
import { clearHistory, undo } from '@/store/history'

const D = '2026-10-16'
beforeEach(async () => {
  await resetDbForTests()
  clearHistory()
})

describe('subtasks', () => {
  it('completes the parent when every step is done, and undoes as one step', async () => {
    const t = await addTask(D, { title: 'Trip', subtasks: [{ id: 'a', title: 'Book', done: false }, { id: 'b', title: 'Pack', done: false }] })
    await uSetSubtask(t.id, 'a', true)
    expect((await db.tasks.get(t.id))!.completed).toBe(false)
    await uSetSubtask(t.id, 'b', true)
    const done = (await db.tasks.get(t.id))!
    expect(done.completed).toBe(true)
    expect(done.subtasks!.every((s) => s.done)).toBe(true)
    await undo()
    const back = (await db.tasks.get(t.id))!
    expect(back.completed).toBe(false)
    expect(back.subtasks!.find((s) => s.id === 'b')!.done).toBe(false)
  })
})

describe('goals', () => {
  it('measures progress against a target or the linked tasks', () => {
    expect(goalProgress({ target: null }, [{ completed: true }, { completed: false }])).toMatchObject({ done: 1, target: 2, percentage: 50, achieved: false })
    expect(goalProgress({ target: 2 }, [{ completed: true }, { completed: true }, { completed: false }])).toMatchObject({ percentage: 100, achieved: true })
    expect(goalProgress({ target: null }, [])).toMatchObject({ percentage: 0, achieved: false })
  })
  it('links tasks and unlinks them when the goal is deleted', async () => {
    const g = await addGoal({ title: 'Read 12 books', description: '', color: 'mint', target: 12, dueDate: null })
    const t = await addTask(D, { title: 'Chapter 1', goalId: g.id })
    expect(await db.tasks.where('goalId').equals(g.id).count()).toBe(1)
    await deleteGoal(g.id)
    expect(await db.goals.count()).toBe(0)
    expect((await db.tasks.get(t.id))!.goalId).toBeNull()
  })
  it('survives a backup round trip', async () => {
    const g = await addGoal({ title: 'Run', description: '', color: 'peach', target: null, dueDate: null })
    const t = await addTask(D, { title: 'Jog' })
    await updateTask(t.id, { goalId: g.id })
    const json = JSON.stringify(await exportData())
    await db.goals.clear()
    await db.tasks.clear()
    await importData(parseBackup(json), 'replace')
    expect((await db.goals.toArray())[0].title).toBe('Run')
    expect((await db.tasks.get(t.id))!.goalId).toBe(g.id)
  })
})

describe('mood', () => {
  it('stores the day mood and correlates it with completion', async () => {
    await setDayMeta(D, { mood: 'great' })
    expect((await db.days.get(D))!.mood).toBe('great')
    const s = (percentage: number) => ({ total: 4, percentage }) as DaySummary
    const summaries = new Map([['a', s(100)], ['b', s(50)], ['c', s(0)], ['d', { total: 0, percentage: 0 } as DaySummary]])
    const moods = new Map<string, Mood>([['a', 'great'], ['b', 'great'], ['c', 'low'], ['d', 'low']])
    expect(moodStats(summaries, moods)).toEqual([
      { mood: 'great', days: 2, average: 75 },
      { mood: 'low', days: 1, average: 0 },
    ])
  })
})

describe('collection', () => {
  it('starts with the basic pins and stamp, and unlocks more with achievements', () => {
    const none = new Set<string>()
    expect(unlockedPins(none)).toEqual(expect.arrayContaining(['red', 'brass', 'walnut', 'sage']))
    expect(unlockedPins(none)).not.toContain('gold')
    expect(unlockedStamps(none)).toEqual(['classic'])
    const earned = new Set(['seven-streak'])
    expect(unlockedPins(earned)).toContain('gold')
    expect(unlockedStamps(earned)).toContain('laurel')
  })
  it('falls back when a chosen item is still locked, and picks pins deterministically', () => {
    const c = resolveCollection({ pinStyle: 'gold', stampStyle: 'moon' }, new Set())
    expect(c.stamp).toBe('classic')
    expect(c.pins).toContain(c.pinFor('2026-10-01'))
    expect(c.pinFor('2026-10-01')).toBe(c.pinFor('2026-10-01'))
    const fixed = resolveCollection({ pinStyle: 'gold', stampStyle: 'laurel' }, new Set(['seven-streak']))
    expect(fixed.pinFor('x')).toBe('gold')
    expect(fixed.stamp).toBe('laurel')
  })
})

describe('sky', () => {
  it('follows the time of day and the seasons', () => {
    const at = (m: number, h: number) => new Date(2026, m, 10, h, 0)
    expect(skyPhase(at(0, 6))).toBe('dawn')
    expect(skyPhase(at(0, 12))).toBe('day')
    expect(skyPhase(at(0, 18))).toBe('dusk')
    expect(skyPhase(at(0, 23))).toBe('night')
    expect(skyPhase(at(0, 3))).toBe('night')
    expect(seasonOf(at(0, 12))).toBe('winter')
    expect(seasonOf(at(3, 12))).toBe('spring')
    expect(seasonOf(at(7, 12))).toBe('summer')
    expect(seasonOf(at(9, 12))).toBe('autumn')
    expect(weatherFor('auto', 'winter')).toBe('snow')
    expect(weatherFor('auto', 'autumn')).toBe('leaves')
    expect(weatherFor('rain', 'winter')).toBe('rain')
  })
})

describe('first run', () => {
  it('shows the tour to new users only', async () => {
    const { migratePrefs } = await import('@/domain/types')
    expect(migratePrefs(undefined).onboarded).toBe(false)
    expect(migratePrefs({ theme: 'light' }).onboarded).toBe(true)
    expect(migratePrefs({ onboarded: false }).onboarded).toBe(false)
  })
})

describe('haptics', () => {
  it('vibrates only when enabled and supported', async () => {
    const { haptic } = await import('@/lib/haptics')
    const { usePrefs } = await import('@/store/prefs')
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    usePrefs.getState().update({ haptics: true })
    haptic('pin')
    expect(vibrate).toHaveBeenCalledTimes(1)
    usePrefs.getState().update({ haptics: false })
    haptic('pin')
    expect(vibrate).toHaveBeenCalledTimes(1)
  })
})
