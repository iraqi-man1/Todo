import { addMonths, addWeeks, addYears } from 'date-fns'
import { ChevronLeft, ChevronRight, Filter, LocateFixed, Minus, Plus, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Segmented } from '@/components/ui/fields'
import type { Archive, DateKey } from '@/domain/types'
import { useArchives, useSummaries } from '@/hooks/useData'
import { dur, useMotionLevel } from '@/hooks/useMotionLevel'
import { useToday } from '@/hooks/useToday'
import { addDaysKey, fromKey, isoWeek, toKey, weekDays } from '@/lib/dates'
import { useI18n } from '@/lib/i18n'
import { cn, isTypingTarget } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI, type WallFilter, type WallView } from '@/store/ui'
import { DayBoard, MonthBoard, WeekBoard, YearBoard, type BoardProps } from './Boards'
import { WallSearch } from './WallSearch'
import { WallViewport, type WallViewportHandle } from './WallViewport'

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return narrow
}

export function WoodenWall() {
  const { d, f, date } = useI18n()
  const today = useToday()
  const level = useMotionLevel()
  const narrow = useNarrow()
  const prefs = usePrefs((s) => s.prefs)
  const view = useUI((s) => s.wallView)
  const anchorState = useUI((s) => s.wallAnchor)
  const filter = useUI((s) => s.wallFilter)
  const setWall = useUI((s) => s.setWall)
  const justPinned = useUI((s) => s.justPinned)
  const setJustPinned = useUI((s) => s.setJustPinned)
  const inspect = useUI((s) => s.inspect)
  const setInspect = useUI((s) => s.setInspect)
  const navigate = useUI((s) => s.navigate)
  const searchOpen = useUI((s) => s.searchOpen)
  const setSearchOpen = useUI((s) => s.setSearchOpen)
  const anchor = anchorState ?? today
  const archivesList = useArchives()
  const summaries = useSummaries()
  const archives = useMemo(() => new Map<DateKey, Archive>((archivesList ?? []).map((a) => [a.date, a])), [archivesList])
  const vp = useRef<WallViewportHandle>(null)
  const dateInput = useRef<HTMLInputElement>(null)
  const ready = !!archivesList && !!summaries

  const shift = (n: number) => {
    const a = fromKey(anchor)
    const next =
      view === 'day' ? addDaysKey(anchor, n) : toKey(view === 'week' ? addWeeks(a, n) : view === 'month' ? addMonths(a, n) : addYears(a, n))
    setWall({ wallAnchor: next })
  }

  const periodLabel =
    view === 'day'
      ? date(anchor, 'medium')
      : view === 'week'
        ? `${f(d.wall.week, { n: isoWeek(anchor) })} · ${date(weekDays(anchor, prefs.weekStartsOn)[0], 'short')}`
        : view === 'month'
          ? date(anchor, 'monthYear')
          : date(anchor, 'year')

  const periodKey =
    view === 'day' ? anchor : view === 'week' ? weekDays(anchor, prefs.weekStartsOn)[0] : view === 'month' ? anchor.slice(0, 7) : anchor.slice(0, 4)
  const fitKey = `${view}|${periodKey}|${narrow}`

  // Zoom toward a freshly pinned note once the board is laid out.
  useEffect(() => {
    if (!ready || !justPinned) return
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-date="${justPinned}"]`)
      if (el) vp.current?.focusElement(el, { minScreenWidth: narrow ? 120 : 180 })
    }, 80)
    return () => clearTimeout(t)
  }, [ready, justPinned, narrow])

  const onOpen = useCallback(
    (key: DateKey, el: HTMLElement, rotate: number) => {
      const summary = summaries?.get(key)
      if (!summary?.total && key === today) {
        navigate({ name: 'today' })
        return
      }
      const r = el.getBoundingClientRect()
      const s = vp.current?.scale() ?? 1
      const w = el.offsetWidth * s
      const h = el.offsetHeight * s
      setInspect({ date: key, origin: { x: r.left + r.width / 2 - w / 2, y: r.top + r.height / 2 - h / 2, width: w, height: h, rotate } })
    },
    [navigate, setInspect, summaries, today],
  )

  const onArrived = useCallback(() => setJustPinned(null), [setJustPinned])

  // Keyboard: arrows pan, +/- zoom, 0 resets.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || document.querySelector('[role="dialog"]')) return
      const step = 80
      const map: Record<string, () => void> = {
        ArrowLeft: () => vp.current?.pan(step, 0),
        ArrowRight: () => vp.current?.pan(-step, 0),
        ArrowUp: () => vp.current?.pan(0, step),
        ArrowDown: () => vp.current?.pan(0, -step),
        '+': () => vp.current?.zoomBy(1.25),
        '=': () => vp.current?.zoomBy(1.25),
        '-': () => vp.current?.zoomBy(0.8),
        '0': () => vp.current?.reset(),
      }
      const fn = map[e.key]
      if (fn && !(e.target instanceof HTMLButtonElement && e.key.startsWith('Arrow') && e.target.closest('[role="radiogroup"]'))) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const boardProps: BoardProps | null = ready
    ? {
        anchor,
        today,
        summaries: summaries!,
        archives,
        level,
        filter,
        weekStartsOn: prefs.weekStartsOn,
        narrow,
        fallbackColor: prefs.defaultNoteColor,
        justPinned,
        inspecting: inspect?.date ?? null,
        onOpen,
        onArrived,
        onPickMonth: (m) => setWall({ wallView: 'month', wallAnchor: m }),
      }
    : null

  const views: WallView[] = ['day', 'week', 'month', 'year']
  const filters: WallFilter[] = ['all', 'complete', 'incomplete']

  return (
    <div className="relative flex h-full flex-col pb-[calc(4rem+var(--safe-bottom))] md:pb-0">
      {/* Toolbar */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-line bg-surface/85 px-3 pt-[calc(0.6rem+var(--safe-top))] pb-2.5 backdrop-blur-xl sm:px-5">
        <h1 className="me-1 hidden text-lg font-semibold tracking-tight lg:block">{d.wall.title}</h1>
        <Segmented
          label={d.wall.viewLabel}
          value={view}
          onChange={(v) => setWall({ wallView: v })}
          size="sm"
          options={views.map((v) => ({ value: v, label: d.wall.views[v] }))}
          className="order-3 w-full sm:order-none sm:w-auto [&>button]:flex-1"
        />
        <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:flex-none">
          <Button variant="ghost" size="iconSm" onClick={() => shift(-1)} aria-label={d.wall.prev}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <button
            type="button"
            className="relative min-w-0 truncate rounded-lg px-2 py-1.5 text-[15px] font-semibold hover:bg-surface-2"
            onClick={() => {
              const i = dateInput.current
              if (!i) return
              try {
                i.showPicker()
              } catch {
                i.focus()
              }
            }}
          >
            {periodLabel}
            <input
              ref={dateInput}
              type="date"
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0"
              value={anchor}
              onChange={(e) => e.target.value && setWall({ wallAnchor: e.target.value })}
            />
          </button>
          <Button variant="ghost" size="iconSm" onClick={() => shift(1)} aria-label={d.wall.next}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
        <div className="ms-auto flex items-center gap-1">
          {anchor !== today && (
            <Button variant="subtle" size="sm" onClick={() => setWall({ wallAnchor: null })}>
              {d.wall.today}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="iconSm" aria-label={`${d.wall.filter}: ${d.wall.filters[filter]}`} className={cn(filter !== 'all' && 'bg-note-yellow text-[#302c28]')}>
                <Filter />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {filters.map((fl) => (
                <DropdownMenuItem key={fl} onSelect={() => setWall({ wallFilter: fl })} aria-checked={filter === fl} role="menuitemradio">
                  <span className={cn('size-2 rounded-full', filter === fl ? 'bg-accent' : 'bg-transparent')} />
                  {d.wall.filters[fl]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="iconSm" onClick={() => setSearchOpen(true)} aria-label={d.wall.search}>
            <Search />
          </Button>
        </div>
      </div>

      {/* Wall */}
      <div className="relative min-h-0 flex-1">
        {boardProps && (
          <WallViewport ref={vp} fitKey={fitKey} fit={view === 'year' && narrow ? 'width' : view === 'month' && narrow ? 'width' : 'contain'} level={level} label={`${d.wall.title}: ${periodLabel}`}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={fitKey}
                initial={level === 'off' ? false : { opacity: 0, scale: level === 'full' ? 0.97 : 1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={level === 'off' ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: dur(level, 0.3) }}
              >
                {view === 'month' && <MonthBoard {...boardProps} />}
                {view === 'week' && <WeekBoard {...boardProps} />}
                {view === 'year' && <YearBoard {...boardProps} />}
                {view === 'day' && <DayBoard {...boardProps} />}
              </motion.div>
            </AnimatePresence>
          </WallViewport>
        )}

        {/* Zoom controls */}
        <div className="absolute end-3 bottom-3 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-soft backdrop-blur-md">
          <button type="button" className="grid size-11 place-items-center hover:bg-surface-2" onClick={() => vp.current?.zoomBy(1.3)} aria-label={d.wall.zoomIn}>
            <Plus className="size-5" />
          </button>
          <button type="button" className="grid size-11 place-items-center border-y border-line hover:bg-surface-2" onClick={() => vp.current?.zoomBy(1 / 1.3)} aria-label={d.wall.zoomOut}>
            <Minus className="size-5" />
          </button>
          <button type="button" className="grid size-11 place-items-center hover:bg-surface-2" onClick={() => vp.current?.reset()} aria-label={d.wall.reset}>
            <LocateFixed className="size-5" />
          </button>
        </div>
        <p className="pointer-events-none absolute start-3 bottom-3 hidden rounded-full bg-surface/80 px-3 py-1.5 text-xs text-ink-soft backdrop-blur sm:block">{d.wall.hint}</p>
      </div>

      <WallSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        archives={archivesList ?? []}
        onPick={(key) => {
          setSearchOpen(false)
          setWall({ wallAnchor: key, wallView: view === 'year' ? 'month' : view })
          setTimeout(() => setInspect({ date: key }), 150)
        }}
      />
    </div>
  )
}
