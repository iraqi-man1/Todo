import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CalendarDays, Check, ChevronDown, Clock, Flag, Eye, EyeOff, MoreHorizontal, Palette, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { DoneStamp } from '@/components/paper/DoneStamp'
import { PaperPhysics } from '@/components/paper/PaperPhysics'
import { useEffects } from '@/hooks/useMotionLevel'
import { useCollection } from '@/hooks/useCollection'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Paper } from '@/components/paper/StickyNote'
import { ConfirmDialog } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { uAddTask, uReorder, uSetSubtask, uUpdateNote, uUpdateTask } from '@/domain/undoable'
import { playSound } from '@/lib/sound'
import { NOTE_HEX } from '@/domain/colors'
import { NOTE_COLORS, type Category, type DayNote, type Goal, type Task } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { parseQuickAdd } from '@/lib/quickAdd'
import { addDaysKey } from '@/lib/dates'
import { useToday } from '@/hooks/useToday'
import { toast } from 'sonner'
import { useUI } from '@/store/ui'
import { percent } from '@/domain/summary'
import { TaskItem } from './TaskItem'

export interface PlannerNoteHandle {
  nudge: () => void
  focusInput: () => void
}

interface Props {
  note: DayNote
  tasks: Task[]
  categories: Map<string, Category>
  goals: Map<string, Goal>
  editable: boolean
  level: MotionLevel
  canDelete: boolean
  onToggle: (t: Task) => void
  onDelete: (t: Task) => void
  onDeleteNote: (n: DayNote) => void
  onError: (e: unknown) => void
}

export const PlannerNote = forwardRef<PlannerNoteHandle, Props>(function PlannerNote(
  { note, tasks, categories, goals, editable, level, canDelete, onToggle, onDelete, onDeleteNote, onError },
  ref,
) {
  const { d, f } = useI18n()
  const fx = useEffects()
  const collection = useCollection()
  const openEditor = useUI((s) => s.openEditor)
  const hideCompleted = useUI((s) => s.hideCompleted)
  const setHideCompleted = useUI((s) => s.setHideCompleted)
  const [peek, setPeek] = useState(false)
  const controls = useAnimationControls()
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [order, setOrder] = useState(() => tasks.map((t) => t.id))
  const [title, setTitle] = useState(note.title)

  useEffect(() => setOrder(tasks.map((t) => t.id)), [tasks])
  useEffect(() => setTitle(note.title), [note.title])

  useImperativeHandle(ref, () => ({
    nudge: () => {
      if (level !== 'full') return
      void controls.start({
        rotate: [0, -0.7, 0.45, 0],
        y: [0, 2, -1, 0],
        transition: { duration: 0.5, ease: 'easeOut' },
      })
    },
    focusInput: () => inputRef.current?.focus(),
  }))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const byId = new Map(tasks.map((t) => [t.id, t]))
  const ordered = order.map((id) => byId.get(id)).filter((t): t is Task => !!t)

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const next = arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)))
    setOrder(next)
    uReorder(note.id, next).catch(onError)
  }

  const saveTitle = () => {
    if (title !== note.title) uUpdateNote(note.id, { title: title.trim() }).catch(onError)
  }

  const done = tasks.filter((t) => t.completed).length
  const pct = percent(done, tasks.length)
  const allDone = tasks.length > 0 && done === tasks.length
  const hiding = hideCompleted && !peek
  const visible = hiding ? ordered.filter((t) => !t.completed) : ordered
  const hiddenCount = ordered.length - visible.length

  // A soft stamp lands the moment this note's last task is checked.
  const wasDone = useRef(allDone)
  const [stampKey, setStampKey] = useState(0)
  useEffect(() => {
    if (allDone && !wasDone.current) {
      setStampKey((k) => k + 1)
      if (fx.celebration) setTimeout(() => playSound('pin'), level === 'full' ? 620 : 0)
    }
    wasDone.current = allDone
  }, [allDone, level, fx.celebration])

  return (
    <motion.section animate={controls} aria-label={note.title || d.today.untitledNote} className="relative">
      <PaperPhysics enabled={fx.physics} amp={fx.amp * 0.6}>
      <Paper color={note.color} className="px-3 pt-3 pb-4 transition-[background-color] duration-300 sm:px-5 sm:pt-4">
        <header className="flex items-center gap-2 ps-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            disabled={!editable}
            placeholder={d.today.untitledNote}
            aria-label={d.today.noteTitlePlaceholder}
            maxLength={60}
            className="font-hand min-w-0 flex-1 bg-transparent text-[26px] leading-tight text-[#302c28] placeholder:text-[#302c28]/35 focus:outline-none disabled:opacity-100"
          />
          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium tabular-nums text-[#302c28]/65">
            {f(d.today.progressShort, { done, total: tasks.length })}
          </span>
          {editable && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="grid size-9 shrink-0 place-items-center rounded-full text-[#302c28]/55 hover:bg-black/5"
                aria-label={d.today.noteMenu}
              >
                <MoreHorizontal className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <span className="flex items-center gap-1.5">
                    <Palette className="size-3.5" /> {d.today.noteColor}
                  </span>
                </DropdownMenuLabel>
                <div className="grid grid-cols-5 gap-1.5 px-2 pb-2" role="group" aria-label={d.today.noteColor}>
                  {NOTE_COLORS.map((c) => (
                    <DropdownMenuItem
                      key={c}
                      onSelect={() => uUpdateNote(note.id, { color: c }).catch(onError)}
                      aria-label={d.colors[c]}
                      title={d.colors[c]}
                      className="size-8 min-h-0 justify-center rounded-full p-0 ring-1 ring-black/10 data-[highlighted]:ring-2 data-[highlighted]:ring-accent"
                      style={{ background: NOTE_HEX[c] }}
                    >
                      {note.color === c && <Check className="text-[#302c28]" />}
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setHideCompleted(!hideCompleted)}>
                  {hideCompleted ? <Eye /> : <EyeOff />} {hideCompleted ? d.today.showCompleted : d.today.hideCompleted}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openEditor({ date: note.date, noteId: note.id })}>
                  <SlidersHorizontal /> {d.task.newTask}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem danger onSelect={() => (tasks.length ? setConfirmDelete(true) : onDeleteNote(note))}>
                    <Trash2 /> {d.today.deleteNote}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {tasks.length > 0 && (
          <div
            className="mx-1 mt-2 h-1 overflow-hidden rounded-full bg-black/[0.07]"
            role="progressbar"
            aria-label={note.title || d.today.untitledNote}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <motion.div
              className="h-full rounded-full bg-[#4F7A4A]/70"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={level === 'off' ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        )}
        <AnimatePresence>
          {allDone && (
            <motion.span
              key={stampKey}
              aria-hidden
              className="pointer-events-none absolute end-16 bottom-1 z-10"
              initial={stampKey && fx.celebration ? (level === 'full' ? { scale: 2.2, opacity: 0, rotate: -28 } : { opacity: 0 }) : false}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 16, delay: level === 'full' ? 0.55 : 0 }}
            >
              <DoneStamp size={74} label={d.stampCompleted} rotate={-10} variant={collection.stamp} />
            </motion.span>
          )}
        </AnimatePresence>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={visible.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="mt-2 flex flex-col">
              {visible.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  category={t.categoryId ? categories.get(t.categoryId) : undefined}
                  level={level}
                  editable={editable}
                  onToggle={onToggle}
                  onEdit={(task) => openEditor({ date: task.date, taskId: task.id })}
                  onRename={(task, title) => uUpdateTask(task.id, { title }).catch(onError)}
                  onSubtask={(task, subId, done) => uSetSubtask(task.id, subId, done).catch(onError)}
                  goal={t.goalId ? goals.get(t.goalId) : undefined}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {hideCompleted && done > 0 && (
          <button
            type="button"
            onClick={() => setPeek((v) => !v)}
            aria-expanded={peek}
            className="ms-9 mt-1 flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-[#302c28]/60 hover:bg-black/5 hover:text-[#302c28]"
          >
            <ChevronDown className={cn('size-4 transition-transform', peek && 'rotate-180')} />
            {f(peek ? d.today.hideDone : d.today.showDone, { n: peek ? done : hiddenCount })}
          </button>
        )}

        {editable && <AddTaskInput ref={inputRef} noteId={note.id} date={note.date} onError={onError} />}
      </Paper>
      </PaperPhysics>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={d.today.deleteNote}
        body={f(d.today.deleteNoteConfirm, { n: tasks.length })}
        confirmLabel={d.common.delete}
        danger
        onConfirm={() => onDeleteNote(note)}
      />
    </motion.section>
  )
})

const AddTaskInput = forwardRef<HTMLInputElement, { noteId: string; date: string; onError: (e: unknown) => void }>(
  function AddTaskInput({ noteId, date, onError }, ref) {
    const { d, f, date: fmtDate } = useI18n()
    const [value, setValue] = useState('')
    const openEditor = useUI((s) => s.openEditor)
    const navigate = useUI((s) => s.navigate)
    const today = useToday()
    const parsed = useMemo(() => (value.trim() ? parseQuickAdd(value, today) : null), [value, today])
    const dayLabel = (key: string) => (key === today ? d.quickAdd.today : key === addDaysKey(today, 1) ? d.quickAdd.tomorrow : fmtDate(key, 'medium'))
    const submit = async () => {
      const raw = value.trim()
      if (!raw) return
      const q = parseQuickAdd(raw, today)
      const target = q.date ?? date
      setValue('')
      try {
        const input = { title: q.title, ...(q.dueTime && { dueTime: q.dueTime }), ...(q.priority && { priority: q.priority }) }
        if (target === date) await uAddTask(date, input, { noteId })
        else {
          await uAddTask(target, input)
          toast.success(f(d.quickAdd.addedTo, { date: dayLabel(target) }), {
            action: { label: d.quickAdd.open, onClick: () => navigate({ name: 'today', date: target }) },
          })
        }
      } catch (e) {
        setValue(raw)
        onError(e)
      }
    }
    const chips = parsed && (parsed.date || parsed.dueTime || parsed.priority) && parsed.title !== value.trim()
    return (
      <>
      <form
        className="mt-1 flex items-center gap-1.5 ps-1"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <span className="grid size-7 shrink-0 place-items-center text-[#302c28]/40 ms-6">
          <Plus className="size-5" />
        </span>
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          placeholder={d.today.addPlaceholder}
          aria-label={d.today.addTask}
          aria-describedby={chips ? `qa-${noteId}` : undefined}
          title={d.quickAdd.hint}
          enterKeyHint="done"
          maxLength={200}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-[#302c28] placeholder:text-[#302c28]/45 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            openEditor({ date, noteId, title: value.trim() })
            setValue('')
          }}
          className={cn('grid size-9 shrink-0 place-items-center rounded-full text-[#302c28]/45 hover:bg-black/5 hover:text-[#302c28]/80')}
          aria-label={d.task.newTask}
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </form>
      {/* live preview of what the smart parser understood */}
      {chips && (
        <p id={`qa-${noteId}`} aria-live="polite" className="ms-[3.25rem] -mt-1 mb-1 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-[#302c28]/70">
          {parsed.date && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] px-2 py-0.5">
              <CalendarDays className="size-3.5" />
              {dayLabel(parsed.date)}
            </span>
          )}
          {parsed.dueTime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] px-2 py-0.5 tabular-nums">
              <Clock className="size-3.5" />
              {parsed.dueTime}
            </span>
          )}
          {parsed.priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C2453A]/12 px-2 py-0.5 text-[#9C2F25]">
              <Flag className="size-3.5" />
              {d.quickAdd.urgent}
            </span>
          )}
        </p>
      )}
      </>
    )
  },
)
