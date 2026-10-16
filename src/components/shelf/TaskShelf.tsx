import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bookmark, Check, GripVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/dialog'
import { db } from '@/db/db'
import { addShelfItem, deleteShelfItem, renameShelfItem, reorderShelf, restoreShelfItem, shelfKey, ShelfDuplicateError, sortShelf } from '@/domain/shelf'
import type { ShelfItem } from '@/domain/types'
import { uInsertFromShelf } from '@/domain/undoable'
import { useShelf } from '@/hooks/useData'
import { useMedia } from '@/hooks/useMedia'
import { useMotionLevel, type MotionLevel } from '@/hooks/useMotionLevel'
import { reportError } from '@/lib/errors'
import { haptic } from '@/lib/haptics'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'
import { findShelfAnchor } from './ShelfButton'

const PANEL_W = 344
const PANEL_H = 460
const INK = '#302c28'

/**
 * Little paper strips that fly from the shelf rows into the note, one after another. Pure DOM +
 * Web Animations, so React never re-renders for them; skipped entirely when motion is off.
 */
function flyStrips(strips: { title: string; from: DOMRect }[], to: DOMRect, level: MotionLevel) {
  if (level === 'off' || typeof document === 'undefined' || !document.body.animate) return
  strips.forEach(({ title, from }, i) => {
    const el = document.createElement('div')
    el.textContent = title
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      position: 'fixed',
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${Math.min(from.width, 260)}px`,
      height: '34px',
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
      font: '500 14px/1 Inter Variable, sans-serif',
      color: INK,
      background: '#FFF6D6',
      borderRadius: '4px',
      boxShadow: '0 6px 16px -6px rgb(40 25 10 / 0.45), 0 1px 2px rgb(40 25 10 / 0.2)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      zIndex: '80',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>)
    document.body.appendChild(el)
    const dx = to.left + 24 - from.left
    const dy = to.top + to.height / 2 - 17 - from.top
    const full = level === 'full'
    const anim = el.animate(
      full
        ? [
            { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 26}px) rotate(${i % 2 ? 3 : -3}deg) scale(1.03)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(0.86)`, opacity: 0 },
          ]
        : [
            { transform: 'translate(0,0)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
          ],
      { duration: full ? 620 : 260, delay: i * (full ? 80 : 30), easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'backwards' },
    )
    anim.onfinish = () => el.remove()
    anim.oncancel = () => el.remove()
  })
}

function Row({
  item,
  active,
  selected,
  onNote,
  sortable,
  renaming,
  domId,
  onToggle,
  onAdd,
  onRename,
  onStartRename,
  onCancelRename,
  onDelete,
  onHover,
}: {
  item: ShelfItem
  active: boolean
  selected: boolean
  onNote: boolean
  sortable: boolean
  renaming: boolean
  domId: string
  onToggle: () => void
  onAdd: (el: HTMLElement) => void
  onRename: (title: string) => void
  onStartRename: () => void
  onCancelRename: () => void
  onDelete: () => void
  onHover: () => void
}) {
  const { d, f } = useI18n()
  const s = useSortable({ id: item.id, disabled: !sortable || renaming })
  const rowRef = useRef<HTMLLIElement | null>(null)
  const [draft, setDraft] = useState(item.title)
  useEffect(() => setDraft(item.title), [item.title, renaming])
  return (
    <li
      ref={(el) => {
        s.setNodeRef(el)
        rowRef.current = el
      }}
      id={domId}
      role="option"
      aria-selected={selected}
      data-shelf-row={item.id}
      onMouseEnter={onHover}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition, zIndex: s.isDragging ? 2 : undefined }}
      className={cn(
        'group/row relative flex min-h-11 items-center gap-1.5 rounded-lg ps-1 pe-1 transition-[background-color,box-shadow,translate] duration-150',
        'hover:-translate-y-px hover:bg-white/55 hover:shadow-[0_3px_8px_-4px_rgb(40_25_10/0.35)]',
        active && 'bg-white/55 shadow-[0_3px_8px_-4px_rgb(40_25_10/0.35)]',
        s.isDragging && 'bg-white/80 shadow-[0_10px_20px_-8px_rgb(40_25_10/0.45)]',
      )}
    >
      {sortable ? (
        <button
          type="button"
          {...s.attributes}
          {...s.listeners}
          aria-label={f(d.shelf.reorder, { title: item.title })}
          className="grid h-9 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-[#302c28]/25 hover:text-[#302c28]/60 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : (
        <span className="w-1 shrink-0" />
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={onNote || selected}
        aria-label={f(d.shelf.select, { title: item.title })}
        disabled={onNote}
        onClick={onToggle}
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors',
          onNote ? 'border-[#4F7A4A]/50 bg-[#4F7A4A]/10 text-[#3D6B39]/70' : selected ? 'border-[#8C5A2E] bg-[#C89A55] text-white' : 'border-[#302c28]/35 bg-white/50 hover:border-[#302c28]/60',
        )}
      >
        {(selected || onNote) && <Check className="size-3" strokeWidth={3} />}
      </button>
      {renaming ? (
        <input
          autoFocus
          value={draft}
          aria-label={d.shelf.renameLabel}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') onRename(draft)
            if (e.key === 'Escape') onCancelRename()
          }}
          onBlur={() => (draft.trim() && draft.trim() !== item.title ? onRename(draft) : onCancelRename())}
          className="h-9 min-w-0 flex-1 rounded-md bg-white/80 px-2 text-[14px] text-[#302c28] shadow-[inset_0_0_0_1px_rgb(48_44_40/0.2)] outline-none focus:shadow-[inset_0_0_0_1.5px_#C89A55]"
        />
      ) : (
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          onDoubleClick={onStartRename}
          disabled={onNote}
          className="min-w-0 flex-1 py-2 text-start disabled:cursor-default"
        >
          <span className={cn('block truncate text-[14px] leading-snug text-[#302c28]', onNote && 'text-[#302c28]/55')}>{item.title}</span>
          {onNote && <span className="block text-[11px] font-medium text-[#3D6B39]/80">{d.shelf.onNote}</span>}
        </button>
      )}
      {!renaming && (
        <span className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
          <button type="button" onClick={onStartRename} aria-label={`${d.shelf.rename}: ${item.title}`} className="grid size-8 place-items-center rounded-full text-[#302c28]/45 hover:bg-black/5 hover:text-[#302c28]">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={onDelete} aria-label={`${d.shelf.delete}: ${item.title}`} className="grid size-8 place-items-center rounded-full text-[#302c28]/45 hover:bg-[#C2453A]/10 hover:text-[#9C2F25]">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      )}
      {!renaming && (
        <button
          type="button"
          disabled={onNote}
          onClick={() => rowRef.current && onAdd(rowRef.current)}
          aria-label={f(d.shelf.add, { title: item.title })}
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full transition-[transform,background-color] active:scale-90',
            onNote ? 'text-[#3D6B39]/60' : 'bg-[#302c28] text-[#FFF8EA] shadow-[0_2px_4px_rgb(40_25_10/0.3)] hover:bg-[#4A3F35]',
          )}
        >
          {onNote ? <Check className="size-4" /> : <Plus className="size-4" />}
        </button>
      )}
    </li>
  )
}

/**
 * The Task Shelf: a compact paper panel beside a note's "Add a task" field. Search, save, select and
 * add reusable tasks; rename, delete and reorder them. Templates are copied, never linked.
 */
export function TaskShelfHost() {
  const shelf = useUI((s) => s.shelf)
  const setShelf = useUI((s) => s.setShelf)
  const route = useUI((s) => s.route)
  // the shelf belongs to the day on screen; navigating anywhere closes it
  useEffect(() => setShelf(null), [route, setShelf])
  const close = useCallback(() => setShelf(null), [setShelf])
  // keep the last target while the panel animates out
  const last = useRef(shelf)
  if (shelf) last.current = shelf
  const target = shelf ?? last.current
  return <TaskShelf open={!!shelf} onClose={close} date={target?.date ?? ''} noteId={target?.noteId ?? null} onNoteCreated={(noteId) => shelf && setShelf({ ...shelf, noteId })} />
}

function TaskShelf({ open, onClose, date, noteId, onNoteCreated }: { open: boolean; onClose: () => void; date: string; noteId: string | null; onNoteCreated: (noteId: string) => void }) {
  const { d, f } = useI18n()
  const level = useMotionLevel()
  const narrow = useMedia('(max-width: 639px)')
  const items = useShelf()
  const noteTasks = useLiveQuery(
    () => (noteId ? db.tasks.where('noteId').equals(noteId).toArray() : db.tasks.where('date').equals(date).toArray()),
    [noteId, date],
  )
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [sort, setSort] = useState<'manual' | 'recent'>(() => {
    try {
      return localStorage.getItem('dw-shelf-sort') === 'recent' ? 'recent' : 'manual'
    } catch {
      return 'manual'
    }
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [active, setActive] = useState(0)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ShelfItem | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean; max: number } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const listBox = useRef<HTMLDivElement>(null)
  const listId = useId()
  // the bookmark this panel belongs to; looked up live because an empty day's button is replaced by
  // the new note's own once the first task lands
  const getAnchor = useCallback(() => (date ? findShelfAnchor(date, noteId) : null), [date, noteId])
  const anchorRef = useRef<HTMLElement | null>(null)
  if (open) anchorRef.current = getAnchor() ?? anchorRef.current

  const present = useMemo(() => new Set((noteTasks ?? []).map((t) => shelfKey(t.title))), [noteTasks])
  const visible = useMemo(() => {
    const q = shelfKey(query)
    const list = sortShelf(items ?? [], sort)
    return q ? list.filter((i) => shelfKey(i.title).includes(q)) : list
  }, [items, sort, query])
  const exactMatch = useMemo(() => !!query.trim() && (items ?? []).some((i) => shelfKey(i.title) === shelfKey(query)), [items, query])
  const canReorder = sort === 'manual' && !query.trim()
  const chosen = [...selected].filter((id) => visible.some((v) => v.id === id) || items?.some((v) => v.id === id))

  // reset transient state on open, and put focus in the search field
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(new Set())
    setActive(0)
    setRenaming(null)
    const t = setTimeout(() => search.current?.focus({ preventScroll: true }), 30)
    return () => clearTimeout(t)
  }, [open])

  // give focus back to the bookmark button when the shelf closes
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) (getAnchor() ?? anchorRef.current)?.focus()
    wasOpen.current = open
  }, [open, getAnchor])

  useEffect(() => setActive((a) => Math.min(a, Math.max(0, visible.length - 1))), [visible.length])

  // position beside the anchor (desktop); phones get a bottom sheet
  useLayoutEffect(() => {
    if (!open || narrow) return
    const place = () => {
      const anchor = getAnchor()
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const below = vh - r.bottom - 20
      const aboveSpace = r.top - 20
      // open where there's room for the whole panel, else on the roomier side, never past the edge
      const above = below < PANEL_H && aboveSpace > below
      const left = Math.min(Math.max(12, r.right - PANEL_W), vw - PANEL_W - 12)
      const top = above ? r.top - 8 : r.bottom + 8
      const max = Math.max(240, Math.min(PANEL_H, above ? aboveSpace : below))
      setPos((p) => (p && p.left === left && p.top === top && p.above === above && p.max === max ? p : { left, top, above, max }))
    }
    place()
    // scrolling inside the panel's own list must not move it
    const onScroll = (e: Event) => !panel.current?.contains(e.target as Node) && place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, narrow, getAnchor, noteTasks?.length])

  // close on outside press (but not while the delete confirmation is up)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || (t as Element).closest?.('[data-shelf-button]')) return
      if ((t as Element).closest?.('[role="dialog"],[role="alertdialog"],[data-sonner-toaster]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onClose])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const insert = async (ids: string[], fromEls: HTMLElement[]) => {
    if (!ids.length) return
    const rects = fromEls.map((el) => el.getBoundingClientRect())
    try {
      const res = await uInsertFromShelf(date, ids, { noteId })
      // a blank day just got its first note: keep adding to that one
      if (!noteId && res.added[0]) onNoteCreated(res.added[0].noteId)
      const addedTitles = new Set(res.added.map((t) => shelfKey(t.title)))
      const strips = ids
        .map((id, i) => ({ item: items?.find((x) => x.id === id), from: rects[i] }))
        .filter((s): s is { item: ShelfItem; from: DOMRect } => !!s.item && !!s.from && addedTitles.has(shelfKey(s.item.title)))
      // wait a frame so a freshly created note is laid out before measuring where the strips land
      requestAnimationFrame(() => {
        const to = getAnchor() ?? anchorRef.current
        if (to?.isConnected) flyStrips(strips.map((s) => ({ title: s.item.title, from: s.from })), to.getBoundingClientRect(), level)
      })
      if (res.added.length) haptic('tap')
      setSelected(new Set())
      if (res.added.length === 1 && !res.skipped.length) toast.success(f(d.shelf.addedOne, { title: res.added[0].title }), { duration: 1800 })
      else if (res.added.length) toast.success(f(d.shelf.added, { n: res.added.length }), { description: res.skipped.length ? f(d.shelf.skipped, { n: res.skipped.length }) : undefined, duration: 2200 })
      else if (res.skipped.length) toast(f(d.shelf.skipped, { n: res.skipped.length }), { duration: 1800 })
    } catch (e) {
      reportError(e)
    }
  }

  const rowEl = (id: string) => panel.current?.querySelector<HTMLElement>(`[data-shelf-row="${id}"]`) ?? null
  const addOne = (item: ShelfItem, el?: HTMLElement | null) => insert([item.id], [el ?? rowEl(item.id)].filter((x): x is HTMLElement => !!x))
  const addSelected = () => {
    const ids = sortShelf((items ?? []).filter((i) => selected.has(i.id)), sort).map((i) => i.id)
    void insert(ids, ids.map(rowEl).filter((x): x is HTMLElement => !!x))
  }

  const save = async (title: string) => {
    if (!title.trim()) return
    try {
      const { created } = await addShelfItem(title)
      if (created) haptic('tap')
      else toast(d.shelf.alreadySaved, { duration: 1600 })
      setDraft('')
    } catch (e) {
      reportError(e)
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id || !items) return
    const ids = sortShelf(items).map((i) => i.id)
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)))
    void reorderShelf(next)
  }

  // keyboard: the search field drives the list (listbox with an active row)
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const item = visible[active]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if ((e.metaKey || e.ctrlKey) && selected.size) addSelected()
      else if (item && !present.has(shelfKey(item.title))) void addOne(item)
      else if (!visible.length && query.trim()) void save(query).then(() => setQuery(''))
    } else if (e.key === ' ' && item && (e.currentTarget.value === '' || e.altKey)) {
      e.preventDefault()
      if (!present.has(shelfKey(item.title))) toggle(item.id)
    }
  }

  // keep the active row in view by scrolling the list only (scrollIntoView would also scroll the
  // page under this fixed panel and make it chase its anchor)
  useEffect(() => {
    const id = visible[active]?.id
    const row = id ? rowEl(id) : null
    const box = listBox.current
    if (!row || !box) return
    const top = row.offsetTop - box.offsetTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight
  }, [active, visible])

  const sortLabel = (k: 'manual' | 'recent') => d.shelf.sorts[k]
  const setSortPersist = (k: 'manual' | 'recent') => {
    setSort(k)
    try {
      localStorage.setItem('dw-shelf-sort', k)
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  const spring = level === 'off' ? { duration: 0 } : level === 'full' ? { type: 'spring' as const, stiffness: 420, damping: 32 } : { duration: 0.15 }
  const placeStyle: React.CSSProperties = narrow
    ? { left: 0, right: 0, bottom: 0, maxHeight: '78dvh' }
    : pos
      ? { left: pos.left, width: PANEL_W, maxHeight: pos.max, ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }
      : { visibility: 'hidden' }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {narrow && (
            <motion.div
              key="scrim"
              className="fixed inset-0 z-[60] bg-[rgb(30_20_10/0.32)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: level === 'off' ? 0 : 0.18 }}
            />
          )}
          <motion.div
            key="panel"
            ref={panel}
            role="dialog"
            aria-modal={narrow || undefined}
            aria-label={d.shelf.title}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !confirm) {
                e.stopPropagation()
                if (renaming) setRenaming(null)
                else onClose()
              }
            }}
            className={cn(
              'paper fixed z-[61] flex flex-col overflow-hidden text-[#302c28]',
              narrow ? 'rounded-t-[22px] pb-[var(--safe-bottom)]' : 'rounded-[14px]',
            )}
            style={{
              // inline: the shared .paper rule sets position: relative, which would beat the utility
              position: 'fixed',
              ['--note-bg' as string]: '#FBF3DF',
              boxShadow: '0 24px 48px -18px rgb(30 18 8 / 0.55), 0 2px 6px rgb(30 18 8 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.6)',
              transformOrigin: narrow ? 'bottom center' : pos?.above ? 'bottom right' : 'top right',
              ...placeStyle,
            }}
            initial={narrow ? { y: '100%' } : { opacity: 0, scale: 0.94, y: pos?.above ? 8 : -8 }}
            animate={narrow ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={narrow ? { y: '100%' } : { opacity: 0, scale: 0.96, y: pos?.above ? 6 : -6, transition: { duration: level === 'off' ? 0 : 0.12 } }}
            transition={spring}
          >
            {narrow && <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[#302c28]/15" />}
            {/* header */}
            <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
              <span className="grid size-7 place-items-center rounded-md bg-[#C89A55]/20 text-[#8C5A2E]">
                <Bookmark className="size-4" fill="currentColor" />
              </span>
              <h2 className="font-hand text-[24px] leading-none">{d.shelf.title}</h2>
              <div role="radiogroup" aria-label={d.shelf.sort} className="ms-auto flex rounded-full bg-[#302c28]/[0.07] p-0.5 text-[11.5px] font-medium">
                {(['manual', 'recent'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={sort === k}
                    onClick={() => setSortPersist(k)}
                    className={cn('rounded-full px-2.5 py-1 transition-colors', sort === k ? 'bg-[#FFFDF6] text-[#302c28] shadow-[0_1px_2px_rgb(0_0_0/0.15)]' : 'text-[#302c28]/60 hover:text-[#302c28]')}
                  >
                    {sortLabel(k)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={onClose} aria-label={d.common.close} className="grid size-8 place-items-center rounded-full text-[#302c28]/50 hover:bg-black/5 hover:text-[#302c28]">
                <X className="size-4" />
              </button>
            </div>
            {/* search */}
            <div className="relative px-3">
              <Search className="pointer-events-none absolute start-6 top-1/2 size-4 -translate-y-1/2 text-[#302c28]/40" />
              <input
                ref={search}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onSearchKey}
                placeholder={d.shelf.search}
                aria-label={d.shelf.search}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={visible[active] ? `${listId}-${visible[active].id}` : undefined}
                className="h-10 w-full rounded-lg bg-white/60 ps-9 pe-3 text-[14px] text-[#302c28] shadow-[inset_0_0_0_1px_rgb(48_44_40/0.14)] outline-none placeholder:text-[#302c28]/40 focus:shadow-[inset_0_0_0_1.5px_#C89A55]"
              />
            </div>
            {/* list */}
            <div ref={listBox} className="relative mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-2 pb-1">
              {items && items.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-7 text-center">
                  {/* a tiny empty shelf with one tag waiting */}
                  <svg viewBox="0 0 120 70" className="h-16 w-28" aria-hidden>
                    <rect x="8" y="46" width="104" height="8" rx="2" fill="#B9824A" />
                    <rect x="8" y="54" width="104" height="3" rx="1.5" fill="#8C5A2E" opacity="0.6" />
                    <path d="M20 57 v8 M100 57 v8" stroke="#8C5A2E" strokeWidth="3" strokeLinecap="round" />
                    <g transform="rotate(-8 60 30)">
                      <rect x="42" y="16" width="36" height="26" rx="2" fill="#FFF6D6" stroke="#302c28" strokeOpacity="0.15" />
                      <path d="M48 25 h22 M48 31 h15" stroke="#302c28" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
                    </g>
                    <path d="M86 20 v18 l5 -4 l5 4 v-18z" fill="#C4553F" />
                  </svg>
                  <p className="font-hand mt-2 text-[22px] leading-none">{d.shelf.emptyTitle}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#302c28]/65">{d.shelf.emptyBody}</p>
                </div>
              ) : (
                <>
                  {query.trim() && !exactMatch && (
                    <button
                      type="button"
                      onClick={() => void save(query).then(() => setQuery(''))}
                      className="mb-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-start text-[13.5px] font-medium text-[#8C5A2E] hover:bg-white/55"
                    >
                      <Bookmark className="size-4 shrink-0" />
                      <span className="truncate">{f(d.shelf.saveQuery, { title: query.trim() })}</span>
                    </button>
                  )}
                  {visible.length === 0 && query.trim() && <p className="px-3 py-4 text-center text-[13px] text-[#302c28]/60">{f(d.shelf.noMatch, { q: query.trim() })}</p>}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                    <SortableContext items={visible.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                      <motion.ul id={listId} role="listbox" aria-multiselectable aria-label={d.shelf.title} className="space-y-0.5" layout={level === 'full'}>
                        {visible.map((item, i) => (
                          <Row
                            key={item.id}
                            domId={`${listId}-${item.id}`}
                            item={item}
                            active={i === active}
                            selected={selected.has(item.id)}
                            onNote={present.has(shelfKey(item.title))}
                            sortable={canReorder}
                            renaming={renaming === item.id}
                            onHover={() => setActive(i)}
                            onToggle={() => toggle(item.id)}
                            onAdd={(el) => void addOne(item, el)}
                            onStartRename={() => setRenaming(item.id)}
                            onCancelRename={() => setRenaming(null)}
                            onRename={async (title) => {
                              try {
                                await renameShelfItem(item.id, title)
                                setRenaming(null)
                              } catch (e) {
                                if (e instanceof ShelfDuplicateError) toast.error(d.shelf.duplicate)
                                else reportError(e)
                                setRenaming(null)
                              }
                            }}
                            onDelete={() => setConfirm(item)}
                          />
                        ))}
                      </motion.ul>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>
            {/* create + bulk add */}
            <div className="border-t border-[#302c28]/10 px-3 pt-2.5 pb-3">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save(draft)
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={d.shelf.newPlaceholder}
                  aria-label={d.shelf.newPlaceholder}
                  maxLength={200}
                  className="h-10 min-w-0 flex-1 rounded-lg bg-white/60 px-3 text-[14px] text-[#302c28] shadow-[inset_0_0_0_1px_rgb(48_44_40/0.14)] outline-none placeholder:text-[#302c28]/40 focus:shadow-[inset_0_0_0_1.5px_#C89A55]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label={d.shelf.saveNew}
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#C89A55]/25 text-[#6B4A24] transition-colors hover:bg-[#C89A55]/40 disabled:opacity-40"
                >
                  <Bookmark className="size-4" />
                </button>
              </form>
              <button
                type="button"
                disabled={!chosen.length}
                onClick={addSelected}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#302c28] text-[14px] font-medium text-[#FFF8EA] shadow-[0_2px_6px_rgb(40_25_10/0.3)] transition-[opacity,transform] active:scale-[0.98] disabled:opacity-35"
              >
                <Plus className="size-4" />
                {chosen.length ? f(d.shelf.addSelectedN, { n: chosen.length }) : d.shelf.addSelected}
              </button>
              {!narrow && <p className="mt-1.5 text-center text-[10.5px] text-[#302c28]/45">{d.shelf.hint}</p>}
            </div>
          </motion.div>
          <ConfirmDialog
            key="confirm"
            open={!!confirm}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={confirm ? f(d.shelf.deleteTitle, { title: confirm.title }) : ''}
            body={d.shelf.deleteBody}
            confirmLabel={d.common.delete}
            danger
            onConfirm={async () => {
              if (!confirm) return
              const removed = await deleteShelfItem(confirm.id)
              setSelected((s) => {
                const n = new Set(s)
                n.delete(confirm.id)
                return n
              })
              if (removed) toast(d.shelf.deleted, { action: { label: d.task.undo, onClick: () => void restoreShelfItem(removed) }, duration: 4000 })
              setTimeout(() => search.current?.focus({ preventScroll: true }), 50)
            }}
          />
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
