import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChartColumn, CornerDownLeft, LayoutGrid, Moon, Plus, Search, Settings, SquareCheckBig, Sun, type LucideIcon } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { db } from '@/db/db'
import { NOTE_HEX } from '@/domain/colors'
import type { DateKey, NoteColor } from '@/domain/types'
import { goToToday } from '@/hooks/useShortcuts'
import { useToday } from '@/hooks/useToday'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI, type RouteName } from '@/store/ui'

interface Item {
  id: string
  group: 'actions' | 'tasks'
  label: string
  hint?: string
  icon?: LucideIcon
  color?: NoteColor
  done?: boolean
  run: () => void
}

/** Ctrl/⌘+K: jump anywhere, run common actions, and find any task — planned, finished or pinned. */
export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen)
  const setOpen = useUI((s) => s.setPaletteOpen)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dw-overlay fixed inset-0 z-50 bg-[rgb(10_14_24/0.45)] backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="dw-palette fixed inset-x-3 top-[max(12px,var(--safe-top))] z-50 mx-auto flex max-h-[min(560px,80dvh)] max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-lift outline-none sm:top-[14vh]"
        >
          {open && <PaletteBody onClose={() => setOpen(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const { d, date } = useI18n()
  const today = useToday()
  const ui = useUI.getState()
  const focusMode = usePrefs((s) => s.prefs.focusMode)
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q.trim().toLocaleLowerCase())
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Loaded once per open; filtered in memory so typing stays instant even with years of history.
  const data = useLiveQuery(async () => {
    const [tasks, archives, notes] = await Promise.all([db.tasks.toArray(), db.archives.toArray(), db.notes.toArray()])
    return { tasks, archives, noteColor: new Map(notes.map((n) => [n.id, n.color])) }
  }, [])

  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }
  const go = (name: RouteName) => run(() => ui.navigate({ name }))

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { id: 'a-today', group: 'actions', label: d.shortcuts.today, hint: 'T', icon: SquareCheckBig, run: run(() => goToToday(today)) },
      { id: 'a-new', group: 'actions', label: d.task.newTask, hint: 'N', icon: Plus, run: run(() => (ui.navigate({ name: 'today' }), ui.openEditor({ date: today }))) },
      { id: 'a-wall', group: 'actions', label: d.nav.wall, hint: '2', icon: LayoutGrid, run: go('wall') },
      { id: 'a-cal', group: 'actions', label: d.nav.calendar, hint: '3', icon: CalendarDays, run: go('calendar') },
      { id: 'a-stats', group: 'actions', label: d.nav.stats, hint: '4', icon: ChartColumn, run: go('stats') },
      { id: 'a-set', group: 'actions', label: d.nav.settings, hint: '5', icon: Settings, run: go('settings') },
      {
        id: 'a-focus',
        group: 'actions',
        label: focusMode ? d.focus.exit : d.settings.focusMode,
        hint: 'F',
        icon: focusMode ? Sun : Moon,
        run: run(() => usePrefs.getState().update({ focusMode: !focusMode })),
      },
    ]
    const shownActions = dq ? actions.filter((a) => a.label.toLocaleLowerCase().includes(dq)) : actions
    if (!dq || !data) return shownActions

    const openDay = (key: DateKey, pinned: boolean) =>
      run(() => (pinned ? ui.setInspect({ date: key }) : ui.navigate(key === today ? { name: 'today' } : { name: 'today', date: key })))
    const pinnedDates = new Set(data.archives.map((a) => a.date))
    const seen = new Set<string>()
    const tasks: Item[] = []
    const live = [...data.tasks].sort((a, b) => (a.date < b.date ? 1 : -1))
    for (const t of live) {
      if (tasks.length >= 40) break
      if (!t.title.toLocaleLowerCase().includes(dq) && !t.description.toLocaleLowerCase().includes(dq)) continue
      seen.add(t.id)
      const pinned = pinnedDates.has(t.date)
      tasks.push({
        id: t.id,
        group: 'tasks',
        label: t.title,
        hint: date(t.date, 'medium'),
        color: data.noteColor.get(t.noteId),
        done: t.completed,
        run: openDay(t.date, pinned),
      })
    }
    // Snapshot-only tasks (deleted from live data after pinning) are still findable.
    for (const a of data.archives)
      for (const t of a.tasks) {
        if (tasks.length >= 40 || seen.has(t.id) || !t.title.toLocaleLowerCase().includes(dq)) continue
        tasks.push({ id: `${a.id}-${t.id}`, group: 'tasks', label: t.title, hint: date(a.date, 'medium'), color: a.color, done: t.completed, run: openDay(a.date, true) })
      }
    return [...shownActions, ...tasks]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, data, d, today, focusMode])

  useEffect(() => setSel(0), [dq])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(items.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[sel]?.run()
    }
  }

  const groups: { key: Item['group']; title: string }[] = [
    { key: 'actions', title: d.palette.actions },
    { key: 'tasks', title: d.palette.tasks },
  ]

  return (
    <>
      <DialogPrimitive.Title className="sr-only">{d.shortcuts.palette}</DialogPrimitive.Title>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-5 shrink-0 text-ink-soft" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={d.palette.placeholder}
          aria-label={d.shortcuts.palette}
          role="combobox"
          aria-expanded
          aria-controls="dw-palette-list"
          aria-activedescendant={items[sel] ? `dw-pal-${items[sel].id}` : undefined}
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-soft/70 focus-visible:outline-none"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-soft sm:block">Esc</kbd>
      </div>
      <div ref={listRef} id="dw-palette-list" role="listbox" aria-label={d.shortcuts.palette} className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 && <p className="px-3 py-10 text-center text-sm text-ink-soft">{d.palette.empty.replace('{q}', q)}</p>}
        {groups.map((g) => {
          const rows = items.map((it, i) => ({ it, i })).filter(({ it }) => it.group === g.key)
          if (!rows.length) return null
          return (
            <div key={g.key} role="group" aria-label={g.title} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-soft uppercase">{g.title}</p>
              {rows.map(({ it, i }) => {
                const Icon = it.icon
                return (
                  <div
                    key={it.id}
                    id={`dw-pal-${it.id}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === sel}
                    onPointerMove={() => setSel(i)}
                    onClick={it.run}
                    className={cn('flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[14px]', i === sel ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                  >
                    {Icon ? (
                      <Icon className="size-[18px] shrink-0 text-ink-soft" />
                    ) : (
                      <span className="size-[18px] shrink-0 rounded-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.2)]" style={{ background: NOTE_HEX[it.color ?? 'yellow'] }} />
                    )}
                    <span className={cn('min-w-0 flex-1 truncate', it.done && 'text-ink-soft line-through decoration-ink-soft/50')}>{it.label}</span>
                    {it.hint && <span className="shrink-0 text-xs text-ink-soft tabular-nums">{it.hint}</span>}
                    {i === sel && <CornerDownLeft className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" />}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}
