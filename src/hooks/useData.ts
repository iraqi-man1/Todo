import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '@/db/db'
import { buildDaySummaries, type DaySummary } from '@/domain/summary'
import { MOODS, type Archive, type DateKey, type Mood, type ShelfItem } from '@/domain/types'

export function useDay(date: DateKey) {
  const data = useLiveQuery(async () => {
    const [notes, tasks, meta, archive] = await Promise.all([
      db.notes.where('date').equals(date).sortBy('order'),
      db.tasks.where('date').equals(date).toArray(),
      db.days.get(date),
      db.archives.where('date').equals(date).first(),
    ])
    tasks.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    return { notes, tasks, meta, archive, date }
  }, [date])
  // Ignore results still belonging to a previous date while the new query loads.
  return data && data.date === date ? data : undefined
}

export function useArchives(): Archive[] | undefined {
  return useLiveQuery(() => db.archives.orderBy('archivedAt').toArray(), [])
}

export function useSummaries(): Map<DateKey, DaySummary> | undefined {
  const raw = useLiveQuery(async () => {
    const [tasks, archives] = await Promise.all([db.tasks.toArray(), db.archives.toArray()])
    return { tasks, archives }
  }, [])
  return useMemo(() => (raw ? buildDaySummaries(raw.tasks, raw.archives) : undefined), [raw])
}

export function useCategories() {
  return useLiveQuery(() => db.categories.orderBy('id').toArray().then((c) => c.sort((a, b) => a.createdAt - b.createdAt)), []) ?? []
}

export function useRecurrences() {
  return useLiveQuery(() => db.recurrences.toArray().then((r) => r.sort((a, b) => a.createdAt - b.createdAt)), []) ?? []
}

export function useAchievementRecords() {
  return useLiveQuery(() => db.achievements.toArray(), []) ?? []
}

export function useGoals() {
  return useLiveQuery(() => db.goals.orderBy('createdAt').toArray(), []) ?? []
}

/** Mood per day (only days that have one). */
export function useMoods(): Map<DateKey, Mood> {
  const rows = useLiveQuery(() => db.days.filter((d) => !!d.mood && (MOODS as readonly string[]).includes(d.mood)).toArray(), [])
  return useMemo(() => new Map((rows ?? []).map((r) => [r.date, r.mood as Mood])), [rows])
}

/** Task Shelf templates in manual order. */
export function useShelf(): ShelfItem[] | undefined {
  return useLiveQuery(() => db.shelf.orderBy('order').toArray(), [])
}
