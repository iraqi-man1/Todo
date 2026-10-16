import { addMonths, addWeeks, addYears } from 'date-fns'
import { CalendarCheck, ChevronLeft, ChevronRight, Filter, Maximize2, Minus, Plus, Search } from 'lucide-react'
import { AnimatePresence, motion, useTransform, type MotionValue } from 'motion/react'
import { Tip } from '@/components/ui/tooltip'
import { setArchiveOffset } from '@/domain/actions'
import { record } from '@/store/history'
import { goToToday } from '@/hooks/useShortcuts'
import { WallGestureContext, type Offset, type WallGesture } from './drag'
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

  const [dirn, setDirn] = useState(0)
  const wallFocus = useUI((s) => s.wallFocus)
  const shift = (n: number) => {
    setDirn(n)
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

  // "Go to today" and other focus requests: centre that date's note once its board is on screen.
  useEffect(() => {
    if (!ready || !wallFocus) return
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-date="${wallFocus.date}"]`)
      if (el) vp.current?.focusElement(el, { minScreenWidth: narrow ? 110 : 170 })
    }, 120)
    return () => clearTimeout(t)
  }, [ready, wallFocus, narrow])

  const onMoveNote = useCallback((key: DateKey, offset: Offset | undefined) => {
    const before = archives.get(key)?.offset
    void setArchiveOffset(key, offset)
    record({ label: 'noteMoved', undo: () => setArchiveOffset(key, before), redo: () => setArchiveOffset(key, offset) })
  }, [archives])

  const gesture = useMemo<WallGesture>(() => ({ cancelPan: () => vp.current?.cancelGesture(), scale: () => vp.current?.scale() ?? 1 }), [])

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
        onPickMonth: (m) => {
          setDirn(0)
          setWall({ wallView: 'month', wallAnchor: m })
        },
        onMoveNote,
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
          onChange={(v) => {
            setDirn(0)
            setWall({ wallView: v })
          }}
          size="sm"
          options={views.map((v) => ({ value: v, label: d.wall.views[v] }))}
          className="order-3 w-full sm:order-none sm:w-auto [&>button]:flex-1"
        />
        <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:flex-none">
          <Tip label={d.wall.prev}>
            <Button variant="ghost" size="iconSm" onClick={() => shift(-1)} aria-label={d.wall.prev}>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
          </Tip>
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
          <Tip label={d.wall.next}>
            <Button variant="ghost" size="iconSm" onClick={() => shift(1)} aria-label={d.wall.next}>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </Tip>
        </div>
        <div className="ms-auto flex items-center gap-1">
          {anchor !== today && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                setDirn(anchor < today ? 1 : -1)
                goToToday(today)
              }}
            >
              {d.wall.today}
            </Button>
          )}
          <DropdownMenu>
            <Tip label={`${d.wall.filter}: ${d.wall.filters[filter]}`}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="iconSm" aria-label={`${d.wall.filter}: ${d.wall.filters[filter]}`} className={cn(filter !== 'all' && 'bg-note-yellow text-[#302c28]')}>
                  <Filter />
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end">
              {filters.map((fl) => (
                <DropdownMenuItem key={fl} onSelect={() => setWall({ wallFilter: fl })} aria-checked={filter === fl} role="menuitemradio">
                  <span className={cn('size-2 rounded-full', filter === fl ? 'bg-accent' : 'bg-transparent')} />
                  {d.wall.filters[fl]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tip label={d.wall.search} shortcut="/">
            <Button variant="ghost" size="iconSm" onClick={() => setSearchOpen(true)} aria-label={d.wall.search}>
              <Search />
            </Button>
          </Tip>
        </div>
      </div>

      {/* Wall */}
      <div className="relative min-h-0 flex-1">
        {boardProps && (
          <WallGestureContext.Provider value={gesture}>
            <WallViewport
              ref={vp}
              persist
              fitKey={fitKey}
              fit={(view === 'year' || view === 'month') && narrow ? 'width' : 'contain'}
              level={level}
              label={`${d.wall.title}: ${periodLabel}`}
              overlay={(scale) => (
                <ZoomControls
                  scale={scale}
                  onZoom={(k) => vp.current?.zoomBy(k)}
                  onFit={() => vp.current?.reset()}
                  onToday={() => {
                    setDirn(anchor < today ? 1 : anchor > today ? -1 : 0)
                    goToToday(today)
                  }}
                />
              )}
            >
              <AnimatePresence mode="popLayout" initial={false} custom={dirn}>
                <motion.div
                  key={fitKey}
                  custom={dirn}
                  variants={{
                    enter: (dn: number) => (level === 'off' ? {} : { opacity: 0, x: level === 'full' ? dn * 70 : 0, scale: dn || level !== 'full' ? 1 : 0.97 }),
                    center: { opacity: 1, x: 0, scale: 1 },
                    exit: (dn: number) => (level === 'off' ? {} : { opacity: 0, x: level === 'full' ? dn * -70 : 0, transition: { duration: 0.16 } }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: dur(level, 0.32), ease: [0.22, 1, 0.36, 1] }}
                >
                  {view === 'month' && <MonthBoard {...boardProps} />}
                  {view === 'week' && <WeekBoard {...boardProps} />}
                  {view === 'year' && <YearBoard {...boardProps} />}
                  {view === 'day' && <DayBoard {...boardProps} />}
                </motion.div>
              </AnimatePresence>
            </WallViewport>
          </WallGestureContext.Provider>
        )}

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

/** Zoom in/out, a live zoom readout, fit-to-screen and jump-to-today. Reads scale without re-rendering the wall. */
function ZoomControls({ scale, onZoom, onFit, onToday }: { scale: MotionValue<number>; onZoom: (k: number) => void; onFit: () => void; onToday: () => void }) {
  const { d } = useI18n()
  const pct = useTransform(scale, (v) => `${Math.round(v * 100)}%`)
  const btn = 'grid size-11 place-items-center text-ink transition-colors hover:bg-surface-2 active:scale-95'
  return (
    <div className="pointer-events-auto absolute end-3 bottom-3 flex flex-col items-center overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-soft backdrop-blur-md">
      <Tip label={d.wall.zoomIn} side="left" shortcut="+">
        <button type="button" className={btn} onClick={() => onZoom(1.3)} aria-label={d.wall.zoomIn}>
          <Plus className="size-5" />
        </button>
      </Tip>
      <motion.span aria-hidden className="w-full border-y border-line py-1 text-center text-[11px] font-semibold tabular-nums text-ink-soft">
        {pct}
      </motion.span>
      <Tip label={d.wall.zoomOut} side="left" shortcut="−">
        <button type="button" className={btn} onClick={() => onZoom(1 / 1.3)} aria-label={d.wall.zoomOut}>
          <Minus className="size-5" />
        </button>
      </Tip>
      <span className="h-px w-full bg-line" />
      <Tip label={d.wall.reset} side="left" shortcut="0">
        <button type="button" className={btn} onClick={onFit} aria-label={d.wall.reset}>
          <Maximize2 className="size-[18px]" />
        </button>
      </Tip>
      <Tip label={d.shortcuts.today} side="left" shortcut="T">
        <button type="button" className={btn} onClick={onToday} aria-label={d.shortcuts.today}>
          <CalendarCheck className="size-[18px]" />
        </button>
      </Tip>
    </div>
  )
}
