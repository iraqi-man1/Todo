/**
 * The Task Shelf: a hand-curated library of reusable task templates. Nothing here schedules anything;
 * a template only becomes a task when the user adds it to a day, and then as an independent copy.
 */
import { db } from '@/db/db'
import { addTask } from './actions'
import { uid } from './ids'
import type { DateKey, ShelfItem, Task } from './types'

const now = () => Date.now()

/** Titles compare case- and space-insensitively, so "Go to the gym " and "go to the gym" are one. */
export const shelfKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export async function findShelfItem(title: string): Promise<ShelfItem | undefined> {
  const key = shelfKey(title)
  return db.shelf.filter((s) => shelfKey(s.title) === key).first()
}

/** Save a title to the shelf. Returns the existing item instead of making a duplicate. */
export async function addShelfItem(title: string): Promise<{ item: ShelfItem; created: boolean }> {
  const clean = title.trim().replace(/\s+/g, ' ')
  if (!clean) throw new Error('Saved task title is required')
  return db.transaction('rw', db.shelf, async () => {
    const existing = await findShelfItem(clean)
    if (existing) return { item: existing, created: false }
    const all = await db.shelf.toArray()
    const item: ShelfItem = {
      id: uid(),
      title: clean,
      // new items go to the top of the shelf
      order: all.length ? Math.min(...all.map((s) => s.order)) - 1 : 0,
      lastUsedAt: null,
      useCount: 0,
      createdAt: now(),
      updatedAt: now(),
    }
    await db.shelf.add(item)
    return { item, created: true }
  })
}

export class ShelfDuplicateError extends Error {}

/** Rename a template. Tasks already added to days keep their own titles. */
export async function renameShelfItem(id: string, title: string) {
  const clean = title.trim().replace(/\s+/g, ' ')
  if (!clean) throw new Error('Saved task title is required')
  const dup = await findShelfItem(clean)
  if (dup && dup.id !== id) throw new ShelfDuplicateError('Already on the shelf')
  await db.shelf.update(id, { title: clean, updatedAt: now() })
}

/** Remove a template. Returns it so the deletion can be undone. Daily tasks are untouched. */
export async function deleteShelfItem(id: string): Promise<ShelfItem | undefined> {
  const item = await db.shelf.get(id)
  await db.shelf.delete(id)
  return item
}

export async function restoreShelfItem(item: ShelfItem) {
  await db.shelf.put(item)
}

export async function reorderShelf(orderedIds: string[]) {
  await db.transaction('rw', db.shelf, async () => {
    await Promise.all(orderedIds.map((id, i) => db.shelf.update(id, { order: i })))
  })
}

/** Manual order, which is what the user arranged; recency is offered as a separate view. */
export function sortShelf(items: ShelfItem[], by: 'manual' | 'recent' = 'manual'): ShelfItem[] {
  return [...items].sort((a, b) =>
    by === 'recent' ? (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.order - b.order : a.order - b.order || a.createdAt - b.createdAt,
  )
}

export interface InsertResult {
  added: Task[]
  /** Templates skipped because the note already has a task with that title. */
  skipped: ShelfItem[]
}

/**
 * Copy templates into a day's note as fresh, incomplete tasks. Each copy is independent: no link to
 * the template is kept, so completing, editing or deleting either side never touches the other.
 * By default a template already present in the note (same title) is skipped.
 */
export async function insertFromShelf(
  date: DateKey,
  ids: string[],
  opts: { noteId?: string | null; allowDuplicates?: boolean } = {},
): Promise<InsertResult> {
  const items = (await db.shelf.bulkGet(ids)).filter((i): i is ShelfItem => !!i)
  const existing = opts.noteId ? await db.tasks.where('noteId').equals(opts.noteId).toArray() : await db.tasks.where('date').equals(date).toArray()
  const present = new Set(existing.map((t) => shelfKey(t.title)))
  const result: InsertResult = { added: [], skipped: [] }
  for (const item of items) {
    const key = shelfKey(item.title)
    if (!opts.allowDuplicates && present.has(key)) {
      result.skipped.push(item)
      continue
    }
    // later tasks join the note the first one created when no note was given
    const noteId = opts.noteId ?? result.added[0]?.noteId ?? existing[0]?.noteId ?? null
    result.added.push(await addTask(date, { title: item.title }, { noteId }))
    present.add(key)
  }
  if (result.added.length) {
    const t = now()
    await db.transaction('rw', db.shelf, async () => {
      for (const item of items) if (!result.skipped.includes(item)) await db.shelf.update(item.id, { lastUsedAt: t, useCount: (item.useCount ?? 0) + 1 })
    })
  }
  return result
}
