import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRightToLine, Check, CircleDashed, Clock, LocateFixed, NotebookPen, Pin, PinOff, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { Paper } from '@/components/paper/StickyNote'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/fields'
import { db } from '@/db/db'
import { rescheduleUnfinished, setArchiveOffset, setDayMeta } from '@/domain/actions'
import { uPin } from '@/domain/undoable'
import { NOTE_INK } from '@/domain/colors'
import { percent } from '@/domain/summary'
import type { ArchivedTask, DateKey, NoteColor } from '@/domain/types'
import { dur, useMotionLevel } from '@/hooks/useMotionLevel'
import { useToday } from '@/hooks/useToday'
import { useCollection } from '@/hooks/useCollection'
import { reportError } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI, type InspectState } from '@/store/ui'

interface ViewModel {
  date: DateKey
  archived: boolean
  archivedAt: number | null
  stampPressure?: number
  moved: boolean
  color: NoteColor
  title: string
  personalNote: string
  notes: { id: string; title: string; color: NoteColor }[]
  tasks: (ArchivedTask & { moved?: boolean })[]
  total: number
  completed: number
}

/** Load either the frozen snapshot (pinned days) or live data (unpinned days) in one shape. */
function useViewModel(date: DateKey | undefined, fallback: NoteColor): ViewModel | undefined {
  return useLiveQuery(async () => {
    if (!date) return undefined
    const archive = await db.archives.where('date').equals(date).first()
    if (archive)
      return {
        date,
        archived: true,
        archivedAt: archive.archivedAt,
        stampPressure: archive.stampPressure,
        moved: !!archive.offset,
        color: archive.color,
        title: archive.title,
        personalNote: archive.personalNote,
        notes: archive.notes,
        tasks: archive.tasks,
        total: archive.total,
        completed: archive.completed,
      }
    const [tasks, notes, meta, categories] = await Promise.all([
      db.tasks.where('date').equals(date).toArray(),
      db.notes.where('date').equals(date).sortBy('order'),
      db.days.get(date),
      db.categories.toArray(),
    ])
    const cats = new Map(categories.map((c) => [c.id, c]))
    const order = new Map(notes.map((n, i) => [n.id, i]))
    tasks.sort((a, b) => (order.get(a.noteId) ?? 0) - (order.get(b.noteId) ?? 0) || a.order - b.order)
    return {
      date,
      archived: false,
      archivedAt: null,
      moved: false,
      color: notes[0]?.color ?? fallback,
      title: meta?.title ?? '',
      personalNote: meta?.personalNote ?? '',
      notes: notes.map((n) => ({ id: n.id, title: n.title, color: n.color })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueTime: t.dueTime,
        categoryName: t.categoryId ? (cats.get(t.categoryId)?.name ?? null) : null,
        categoryColor: t.categoryId ? (cats.get(t.categoryId)?.color ?? null) : null,
        completed: t.completed,
        completedAt: t.completedAt,
        noteId: t.noteId,
        subtasks: t.subtasks,
        moved: !!t.rescheduledTo,
      })),
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
    }
  }, [date, fallback])
}

/**
 * The note lifts off the wall toward the viewer (from the exact screen rect it was tapped at) and
 * opens into a readable card; closing plays it back to its spot.
 */
export function ArchivedNoteModal() {
  const inspect = useUI((s) => s.inspect)
  const setInspect = useUI((s) => s.setInspect)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<InspectState | null>(null)

  useEffect(() => {
    if (inspect) {
      setCurrent(inspect)
      setOpen(true)
    }
  }, [inspect])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <AnimatePresence
        onExitComplete={() => {
          setInspect(null)
          setCurrent(null)
        }}
      >
        {open && current && <ModalBody key={current.date} state={current} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}

function ModalBody({ state, onClose }: { state: InspectState; onClose: () => void }) {
  const level = useMotionLevel()
  const fallback = usePrefs((s) => s.prefs.defaultNoteColor)
  const vm = useViewModel(state.date, fallback)
  const { d, f, date, time } = useI18n()
  const today = useToday()
  const navigate = useUI((s) => s.navigate)
  const setJustPinned = useUI((s) => s.setJustPinned)
  const setUnpinning = useUI((s) => s.setUnpinning)
  const [editing, setEditing] = useState(false)
  const collection = useCollection()

  const W = Math.min(window.innerWidth - 32, 460)
  const o = state.origin
  const from =
    o && level === 'full'
      ? {
          x: o.x + o.width / 2 - window.innerWidth / 2,
          y: o.y + o.height / 2 - window.innerHeight / 2,
          scale: o.width / W,
          rotate: o.rotate,
          opacity: 1,
        }
      : { x: 0, y: level === 'off' ? 0 : 16, scale: level === 'full' ? 0.9 : 1, rotate: 0, opacity: 0 }

  const pct = vm ? percent(vm.completed, vm.total) : 0
  const done = vm?.tasks.filter((t) => t.completed) ?? []
  const notDone = vm?.tasks.filter((t) => !t.completed) ?? []
  const isPast = state.date < today
  const canPin = vm && !vm.archived && vm.total > 0 && vm.completed === vm.total
  const canMove = vm && !vm.archived && isPast && notDone.some((t) => !t.moved)

  const pinNow = async () => {
    const res = await uPin(state.date).catch(reportError)
    if (res && res.ok) {
      playSound('paper')
      onClose()
      setTimeout(() => setJustPinned(state.date), dur(level, 0.5) * 1000)
    }
  }

  return (
    <DialogPrimitive.Portal forceMount>
      <DialogPrimitive.Overlay asChild forceMount>
        <motion.div
          className="fixed inset-0 z-50 bg-[rgb(30_18_8/0.5)] backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur(level, 0.3) }}
        />
      </DialogPrimitive.Overlay>
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4" style={{ perspective: 1200 }}>
        <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
          <motion.div
            className="pointer-events-auto relative outline-none"
            style={{ width: W }}
            initial={from}
            animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
            exit={{ ...from, transition: level === 'full' ? { type: 'spring', stiffness: 320, damping: 32 } : { duration: dur(level, 0.15) } }}
            transition={level === 'full' ? { type: 'spring', stiffness: 210, damping: 24, mass: 0.9 } : { duration: dur(level, 0.2) }}
          >
            <Paper color={vm?.color ?? fallback} className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain shadow-[0_30px_80px_-20px_rgb(20_10_0/0.6)]">
              <div className="relative px-6 pt-7 pb-6 sm:px-8">
                <DialogPrimitive.Close
                  className="absolute end-3 top-3 grid size-10 place-items-center rounded-full text-[#302c28]/60 hover:bg-black/5 hover:text-[#302c28]"
                  aria-label={d.detail.close}
                >
                  <X className="size-5" />
                </DialogPrimitive.Close>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#302c28]/55 uppercase">{date(state.date, 'weekday')}</p>
                <DialogPrimitive.Title className="font-hand mt-1 pe-10 text-[38px] leading-[1] text-[#302c28]">
                  {vm?.title || date(state.date, 'long')}
                </DialogPrimitive.Title>
                {vm?.title && <p className="mt-1 text-sm text-[#302c28]/60">{date(state.date, 'long')}</p>}

                {vm && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                      <motion.div
                        className="h-full rounded-full bg-[#4F7A4A]"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: dur(level, 0.25), duration: dur(level, 0.6), ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-[#302c28]/75">
                      {vm.completed}/{vm.total} · {pct}%
                    </span>
                  </div>
                )}

                {vm?.archived && <DoneStamp size={78} label={d.stamp} variant={collection.stamp} seed={state.date} pressure={vm.stampPressure ?? 0.7} sub={date(state.date, 'short').toUpperCase()} className="absolute end-6 top-16 sm:end-8" />}

                {vm && (
                  <div className="mt-6">
                    <TaskGroup title={d.detail.completed} tasks={done} notes={vm.notes} />
                    {notDone.length > 0 && (
                      <>
                        <TaskGroup title={d.detail.incomplete} tasks={notDone} notes={vm.notes} className="mt-5" />
                        <p className="font-hand mt-4 text-xl text-[#302c28]/70">{d.detail.gentle}</p>
                      </>
                    )}
                  </div>
                )}

                {vm && (editing ? (
                  <MetaEditor date={state.date} title={vm.title} note={vm.personalNote} onDone={() => setEditing(false)} />
                ) : (
                  vm.personalNote && (
                    <div className="mt-6 border-t border-dashed border-[#302c28]/20 pt-4">
                      <p className="text-xs font-semibold tracking-wider text-[#302c28]/55 uppercase">{d.detail.personalNote}</p>
                      <p className="font-hand mt-1 text-[22px] leading-snug whitespace-pre-wrap text-[#302c28]/85">{vm.personalNote}</p>
                    </div>
                  )
                ))}

                {vm?.archived && vm.archivedAt && (
                  <p className="mt-6 text-xs text-[#302c28]/55">
                    {f(d.detail.archivedAt, { date: `${date(new Date(vm.archivedAt), 'medium')} · ${time(vm.archivedAt)}` })} — {d.detail.snapshot}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {!editing && (
                    <button type="button" onClick={() => setEditing(true)} className={paperBtn}>
                      <NotebookPen className="size-4" /> {d.detail.editNote}
                    </button>
                  )}
                  <button
                    type="button"
                    className={paperBtn}
                    onClick={() => {
                      onClose()
                      navigate(state.date === today ? { name: 'today' } : { name: 'today', date: state.date })
                    }}
                  >
                    {d.detail.openInPlanner}
                  </button>
                  {canMove && (
                    <button
                      type="button"
                      className={paperBtn}
                      onClick={async () => {
                        const n = await rescheduleUnfinished(state.date, today).catch(reportError)
                        if (n) toast(f(d.today.moved, { n }))
                      }}
                    >
                      <ArrowRightToLine className="size-4 rtl:rotate-180" /> {d.detail.moveToToday}
                    </button>
                  )}
                  {vm?.moved && (
                    <button type="button" className={paperBtn} onClick={() => void setArchiveOffset(state.date, undefined).catch(reportError)}>
                      <LocateFixed className="size-4" /> {d.detail.resetPosition}
                    </button>
                  )}
                  {vm?.archived && (
                    <button
                      type="button"
                      className={paperBtn}
                      onClick={() => {
                        onClose()
                        // let the card fly back to its slot first, then pull the pin there
                        setTimeout(() => setUnpinning(state.date), level === 'full' ? 520 : 60)
                      }}
                    >
                      <PinOff className="size-4" /> {d.detail.unpinFromWall}
                    </button>
                  )}
                  {canPin && (
                    <Button variant="primary" onClick={pinNow} className="bg-[#302c28] text-[#fffdf8]">
                      <Pin /> {d.detail.pinNow}
                    </Button>
                  )}
                </div>
              </div>
            </Paper>
          </motion.div>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  )
}

const paperBtn =
  'inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#302c28]/15 bg-white/35 px-3.5 text-sm font-medium text-[#302c28] hover:bg-white/60'

function TaskGroup({
  title,
  tasks,
  notes,
  className,
}: {
  title: string
  tasks: (ArchivedTask & { moved?: boolean })[]
  notes: ViewModel['notes']
  className?: string
}) {
  const { d, lang } = useI18n()
  if (!tasks.length) return null
  const multi = notes.length > 1
  const noteName = new Map(notes.map((n) => [n.id, n.title || d.today.untitledNote]))
  return (
    <section className={className}>
      <h3 className="text-xs font-semibold tracking-wider text-[#302c28]/55 uppercase">
        {title} · {tasks.length.toLocaleString(lang)}
      </h3>
      <ul className="mt-2 space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2.5">
            {t.completed ? (
              <Check className="mt-0.5 size-[18px] shrink-0 text-[#3D6B39]" strokeWidth={2.6} aria-label={d.detail.completed} />
            ) : (
              <CircleDashed className="mt-0.5 size-[18px] shrink-0 text-[#302c28]/45" aria-label={d.detail.incomplete} />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn('text-[15px] leading-snug text-[#302c28]', t.completed && 'text-[#302c28]/65 line-through decoration-[#302c28]/35')}>{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-[#302c28]/60">{t.description}</p>}
              {t.subtasks && t.subtasks.length > 0 && (
                <ul className="mt-1 space-y-0.5" aria-label={d.subtasks.title}>
                  {t.subtasks.map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5 text-[13px] text-[#302c28]/70">
                      {s.done ? <Check className="size-3.5 text-[#3D6B39]" strokeWidth={2.6} aria-label={d.detail.completed} /> : <CircleDashed className="size-3.5 text-[#302c28]/40" aria-label={d.detail.incomplete} />}
                      <span className={cn(s.done && 'line-through decoration-[#302c28]/35')}>{s.title}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(t.categoryName || t.dueTime || multi || t.priority !== 'none' || t.moved) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#302c28]/60">
                  {t.categoryName && (
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full" style={{ background: t.categoryColor ? NOTE_INK[t.categoryColor] : '#999' }} />
                      {t.categoryName}
                    </span>
                  )}
                  {t.priority !== 'none' && <span>{d.task.priorities[t.priority]}</span>}
                  {t.dueTime && (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="size-3" />
                      {t.dueTime}
                    </span>
                  )}
                  {multi && <span>{noteName.get(t.noteId)}</span>}
                  {t.moved && <span>↪</span>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function MetaEditor({ date, title, note, onDone }: { date: DateKey; title: string; note: string; onDone: () => void }) {
  const { d } = useI18n()
  const [t, setT] = useState(title)
  const [n, setN] = useState(note)
  return (
    <form
      className="mt-6 flex flex-col gap-2 border-t border-dashed border-[#302c28]/20 pt-4"
      onSubmit={async (e) => {
        e.preventDefault()
        await setDayMeta(date, { title: t.trim(), personalNote: n.trim() }).catch(reportError)
        onDone()
      }}
    >
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder={d.today.dayTitlePlaceholder} aria-label={d.today.dayTitlePlaceholder} maxLength={60} className="border-[#302c28]/20 bg-white/50 text-[#302c28] placeholder:text-[#302c28]/45" />
      <Textarea value={n} onChange={(e) => setN(e.target.value)} placeholder={d.today.personalNotePlaceholder} aria-label={d.detail.personalNote} rows={3} maxLength={1000} className="border-[#302c28]/20 bg-white/50 text-[#302c28] placeholder:text-[#302c28]/45" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={paperBtn}>
          {d.common.cancel}
        </button>
        <button type="submit" className={cn(paperBtn, 'bg-[#302c28] text-[#fffdf8] hover:bg-[#302c28]/90')}>
          {d.detail.saveNote}
        </button>
      </div>
    </form>
  )
}
