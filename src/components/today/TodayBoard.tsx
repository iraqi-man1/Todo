import { ArrowRightToLine, CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Pin, PinOff, Plus, Search } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'
import { Board } from '@/components/wall/Board'
import { FocusToggle } from '@/components/environment/FocusToggle'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Paper } from '@/components/paper/StickyNote'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/fields'
import {
  addNote,
  materializeRecurrences,
  nextNoteColor,
  rescheduleUnfinished,
  setDayMeta,
} from '@/domain/actions'
import { uDeleteNote, uDeleteTask, uPin, uToggleTask, uUnpin } from '@/domain/undoable'
import { toastWithUndo } from '@/lib/undoUi'
import { seededPick } from '@/domain/colors'
import { summarizeTasks } from '@/domain/summary'
import type { DateKey, DayNote, Task } from '@/domain/types'
import { useCategories, useDay } from '@/hooks/useData'
import { dur, useMotionLevel } from '@/hooks/useMotionLevel'
import { useToday } from '@/hooks/useToday'
import { addDaysKey, compareKeys } from '@/lib/dates'
import { reportError } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'
import { CompletionCelebration } from './CompletionCelebration'
import { DailyProgress } from './DailyProgress'
import { PlannerNote, type PlannerNoteHandle } from './PlannerNote'

export function TodayBoard({ date: routeDate }: { date?: DateKey }) {
  const today = useToday()
  const date = routeDate ?? today
  const isToday = date === today
  const isPast = compareKeys(date, today) < 0
  const day = useDay(date)
  const categories = useCategories()
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const level = useMotionLevel()
  const { d, f, date: fmt, time } = useI18n()
  const prefs = usePrefs((s) => s.prefs)
  const navigate = useUI((s) => s.navigate)
  const setWall = useUI((s) => s.setWall)
  const setJustPinned = useUI((s) => s.setJustPinned)
  const openEditor = useUI((s) => s.openEditor)
  const setPaletteOpen = useUI((s) => s.setPaletteOpen)
  const noteRefs = useRef(new Map<string, PlannerNoteHandle>())
  const [dismissed, setDismissed] = useState<DateKey | null>(null)
  const [flying, setFlying] = useState(false)
  const [confirmUnpin, setConfirmUnpin] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [activeNote, setActiveNote] = useState<string | null>(null)

  useEffect(() => {
    materializeRecurrences(date, today, prefs.defaultNoteColor).catch(reportError)
  }, [date, today, prefs.defaultNoteColor])

  const summary = day ? summarizeTasks(date, day.tasks) : null
  const archived = !!day?.archive && !flying
  const editable = !day?.archive
  const unfinished = day?.tasks.filter((t) => !t.completed && !t.rescheduledTo).length ?? 0

  const onToggle = async (t: Task) => {
    try {
      if (!t.completed) {
        playSound('tap')
        noteRefs.current.get(t.noteId)?.nudge()
      }
      await uToggleTask(t.id)
    } catch (e) {
      reportError(e)
    }
  }

  const onDelete = async (t: Task) => {
    try {
      const entry = await uDeleteTask(t.id)
      if (entry) toastWithUndo(d.task.deleted, entry, t.title)
    } catch (e) {
      reportError(e)
    }
  }

  const onDeleteNote = (n: DayNote) =>
    uDeleteNote(n.id).then((entry) => toastWithUndo(d.history.labels.noteDeleted, entry, n.title || undefined), reportError)

  const newNote = async () => {
    try {
      const color = nextNoteColor(day?.notes.map((n) => n.color) ?? [], prefs.defaultNoteColor)
      const note = await addNote(date, color)
      setTimeout(() => noteRefs.current.get(note.id)?.focusInput(), 60)
    } catch (e) {
      reportError(e)
    }
  }

  const ensureFirstNote = async () => {
    try {
      const note = await addNote(date, prefs.defaultNoteColor)
      setTimeout(() => noteRefs.current.get(note.id)?.focusInput(), 60)
    } catch (e) {
      reportError(e)
    }
  }

  const pin = async () => {
    try {
      const res = await uPin(date)
      if (!res.ok) return
      playSound('paper')
      setFlying(true)
      const wait = dur(level, 0.85) * 1000
      setTimeout(() => {
        setJustPinned(date)
        setWall({ wallView: 'month', wallAnchor: date })
        navigate({ name: 'wall' })
      }, wait)
    } catch (e) {
      setFlying(false)
      reportError(e)
    }
  }

  const moveToToday = async () => {
    try {
      const n = await rescheduleUnfinished(date, today)
      if (n) toast(f(d.today.moved, { n }), { action: { label: d.today.backToToday, onClick: () => navigate({ name: 'today' }) } })
    } catch (e) {
      reportError(e)
    }
  }

  const go = (n: number) => {
    const next = addDaysKey(date, n)
    navigate(next === today ? { name: 'today' } : { name: 'today', date: next })
  }

  const hour = new Date().getHours()
  const greeting =
    hour < 5 ? d.greeting.night : hour < 12 ? d.greeting.morning : hour < 18 ? d.greeting.afternoon : hour < 22 ? d.greeting.evening : d.greeting.night
  const motivation = seededPick(date, d.motivation)
  const focus = prefs.focusMode
  const currentNote =
    (activeNote && day?.notes.some((n) => n.id === activeNote) ? activeNote : null) ??
    day?.notes.find((n) => day.tasks.some((t) => t.noteId === n.id && !t.completed))?.id ??
    day?.notes[0]?.id
  const showCelebrate = !!summary?.complete && !day?.archive && dismissed !== date && !flying

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-[calc(1.25rem+var(--safe-top))] pb-32 sm:px-6 md:pt-10 md:pb-16">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {isToday ? (
              <>
                <p className="text-sm font-medium text-ink-soft">
                  {greeting}
                  {prefs.name ? `, ${prefs.name}` : ''}
                </p>
                <h1 className="mt-0.5 text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">{fmt(date, 'long')}</h1>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink-soft">{isPast ? d.today.pastDay : d.today.futureDay}</p>
                <h1 className="mt-0.5 text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">{fmt(date, 'long')}</h1>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <FocusToggle />
            <span data-dim className="flex items-center gap-1">
            <Tip label={d.palette.open} shortcut="Ctrl K">
              <Button variant="ghost" size="iconSm" className="md:hidden" onClick={() => setPaletteOpen(true)} aria-label={d.palette.open}>
                <Search />
              </Button>
            </Tip>
            <Tip label={d.today.prevDay}>
              <Button variant="ghost" size="iconSm" onClick={() => go(-1)} aria-label={d.today.prevDay}>
                <ChevronLeft className="rtl:rotate-180" />
              </Button>
            </Tip>
            {!isToday && (
              <Button variant="subtle" size="sm" onClick={() => navigate({ name: 'today' })}>
                <CalendarDays /> {d.today.backToToday}
              </Button>
            )}
            <Tip label={d.today.nextDay}>
              <Button variant="ghost" size="iconSm" onClick={() => go(1)} aria-label={d.today.nextDay}>
                <ChevronRight className="rtl:rotate-180" />
              </Button>
            </Tip>
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-3xl border border-line bg-surface px-4 py-3.5 shadow-soft">
          <DailyProgress done={summary?.completed ?? 0} total={summary?.total ?? 0} level={level} />
          {prefs.showMotivation && isToday && <p data-dim className="font-hand text-xl text-ink-soft sm:max-w-[16rem] sm:text-end">{motivation}</p>}
        </div>
      </header>

      {/* Past day with unfinished work */}
      {isPast && editable && unfinished > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-surface-2/60 px-4 py-3">
          <p className="text-sm text-ink-soft">
            {f(d.today.unfinishedCount, { n: unfinished })} · {d.detail.gentle}
          </p>
          <Button size="sm" variant="secondary" onClick={moveToToday}>
            <ArrowRightToLine className="rtl:rotate-180" /> {d.today.moveToToday}
          </Button>
        </div>
      )}

      <AnimatePresence>
        {showCelebrate && (
          <div className="mb-5">
            <CompletionCelebration date={date} level={level} busy={flying} onPin={pin} onDismiss={() => setDismissed(date)} />
          </div>
        )}
      </AnimatePresence>

      {archived && day?.archive && (
        <motion.div
          initial={level === 'off' ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:flex-row sm:items-center"
        >
          <DoneStamp size={64} className="shrink-0" label={d.stamp} />
          <div className="flex-1">
            <p className="font-semibold">{d.today.pinnedTitle}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{f(d.today.pinnedBody, { time: time(day.archive.archivedAt) })}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmUnpin(true)}>
              <PinOff /> {d.today.unpin}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setWall({ wallView: 'month', wallAnchor: date })
                navigate({ name: 'wall' })
              }}
            >
              <Pin /> {d.today.viewOnWall}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      {day && (
        <motion.div
          className="relative"
          style={{ transformPerspective: 900 }}
          animate={
            flying
              ? {
                  y: [0, -14, -460],
                  x: [0, 0, 120],
                  scale: [1, 1.03, 0.28],
                  rotate: [0, -1.5, -9],
                  rotateX: [0, 8, 22],
                  opacity: [1, 1, 0],
                }
              : { y: 0, x: 0, scale: 1, rotate: 0, rotateX: 0, opacity: 1 }
          }
          transition={flying ? { duration: dur(level, 0.85), times: [0, 0.3, 1], ease: [0.45, 0, 0.75, 0.4] } : { duration: 0 }}
        >
          {day.notes.length === 0 ? (
            <EmptyDay editable={editable} onStart={ensureFirstNote} />
          ) : (
            <FocusSurface on={focus}>
            <div className={cn('grid gap-5', day.notes.length > 1 && 'md:grid-cols-2')}>
              <AnimatePresence initial={false}>
                {day.notes.map((n) => (
                  <motion.div
                    key={n.id}
                    layout={level === 'full' ? 'position' : false}
                    initial={level === 'off' ? false : { opacity: 0, y: 16, rotate: -1 }}
                    animate={{ opacity: 1, y: 0, rotate: 0 }}
                    exit={level === 'off' ? undefined : { opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className={cn(day.notes.length > 1 && day.notes.length % 2 === 1 && n === day.notes[0] && 'md:col-span-2')}
                    data-note-idle={focus && day.notes.length > 1 && n.id !== currentNote ? '' : undefined}
                    onFocusCapture={() => setActiveNote(n.id)}
                    onPointerDownCapture={() => setActiveNote(n.id)}
                  >
                    <PlannerNote
                      ref={(h) => {
                        if (h) noteRefs.current.set(n.id, h)
                        else noteRefs.current.delete(n.id)
                      }}
                      note={n}
                      tasks={day.tasks.filter((t) => t.noteId === n.id)}
                      categories={catMap}
                      editable={editable}
                      level={level}
                      canDelete={editable}
                      onToggle={onToggle}
                      onDelete={onDelete}
                      onDeleteNote={onDeleteNote}
                      onError={reportError}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            </FocusSurface>
          )}
        </motion.div>
      )}

      {day && (
        <div data-dim className="mt-5 flex flex-wrap items-center gap-2">
          {editable && day.notes.length > 0 && (
            <Button variant="secondary" onClick={newNote}>
              <Plus /> {d.today.newNote}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
            <NotebookPen /> {d.today.dayDetails}
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showDetails && day && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur(level, 0.25) }}
            className="overflow-hidden"
          >
            <DayDetails key={date} date={date} title={day.meta?.title ?? ''} note={day.meta?.personalNote ?? ''} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile floating add button */}
      {editable && !flying && (
        <motion.button
          type="button"
          onClick={() => openEditor({ date })}
          aria-label={d.task.newTask}
          initial={false}
          whileTap={{ scale: 0.92 }}
          className="fixed end-5 bottom-[calc(5.5rem+var(--safe-bottom))] z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lift md:hidden"
        >
          <Plus className="size-6" />
        </motion.button>
      )}

      <ConfirmDialog
        open={confirmUnpin}
        onOpenChange={setConfirmUnpin}
        title={d.today.unpinConfirmTitle}
        body={d.today.unpinConfirmBody}
        confirmLabel={d.today.unpin}
        onConfirm={() => uUnpin(date).then((entry) => toastWithUndo(d.history.labels.dayUnpinned, entry), reportError)}
      />
    </div>
  )
}

function EmptyDay({ editable, onStart }: { editable: boolean; onStart: () => void }) {
  const { d } = useI18n()
  const prefs = usePrefs((s) => s.prefs)
  return (
    <Paper color={prefs.defaultNoteColor} className="px-6 pt-8 pb-10 text-center">
      <p className="font-hand text-[34px] leading-none">{d.today.emptyTitle}</p>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#302c28]/70">{d.today.emptyBody}</p>
      {editable && (
        <button
          type="button"
          onClick={onStart}
          className="mx-auto mt-6 flex h-12 items-center gap-2 rounded-full bg-[#302c28] px-6 text-[15px] font-medium text-[#fffdf8] shadow-soft transition active:scale-[0.97]"
        >
          <Plus className="size-5" /> {d.today.addTask}
        </button>
      )}
    </Paper>
  )
}

function DayDetails({ date, title, note }: { date: DateKey; title: string; note: string }) {
  const { d } = useI18n()
  const [t, setT] = useState(title)
  const [n, setN] = useState(note)
  const save = () => {
    if (t !== title || n !== note) setDayMeta(date, { title: t.trim(), personalNote: n.trim() }).catch(reportError)
  }
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
      <Input value={t} onChange={(e) => setT(e.target.value)} onBlur={save} placeholder={d.today.dayTitlePlaceholder} aria-label={d.today.dayTitlePlaceholder} maxLength={60} />
      <Textarea value={n} onChange={(e) => setN(e.target.value)} onBlur={save} placeholder={d.today.personalNotePlaceholder} aria-label={d.today.personalNotePlaceholder} maxLength={1000} rows={3} />
    </div>
  )
}

/** In Focus Mode the notes are pinned up on a small section of the wooden wall. */
function FocusSurface({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>
  return (
    <Board padding={18} className="sm:!p-7">
      {children}
    </Board>
  )
}
