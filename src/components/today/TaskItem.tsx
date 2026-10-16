import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bookmark, BookmarkCheck, ChevronDown, Clock, Flag, GripVertical, ListChecks, MoreHorizontal, Pencil, Repeat, Target, Trash2, Undo2 } from 'lucide-react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { memo, useRef, useState } from 'react'
import { HandCheck } from '@/components/paper/HandCheck'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NOTE_INK } from '@/domain/colors'
import type { Category, Goal, Task } from '@/domain/types'
import { playSound } from '@/lib/sound'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useEffects } from '@/hooks/useMotionLevel'

const PRIORITY_COLOR = { none: '', low: '#6FA563', medium: '#D99A3A', high: '#C4553F' } as const

export interface TaskItemProps {
  task: Task
  category?: Category
  level: MotionLevel
  editable: boolean
  sortable?: boolean
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  /** Quick inline rename; when absent, clicking the title opens the full editor. */
  onRename?: (task: Task, title: string) => void
  onSubtask?: (task: Task, subId: string, done: boolean) => void
  goal?: Goal
  onDelete: (task: Task) => void
  /** Whether a task with this title is on the Task Shelf. */
  saved?: boolean
  onSaveToShelf?: (task: Task) => void
}

export const TaskItem = memo(function TaskItem(props: TaskItemProps) {
  const { task, sortable = true } = props
  const s = useSortable({ id: task.id, disabled: !props.editable || !sortable })
  const style = { transform: CSS.Translate.toString(s.transform), transition: s.transition }
  return (
    <li
      ref={s.setNodeRef}
      style={style}
      className={cn('relative list-none', s.isDragging && 'z-10')}
      data-testid="task-item"
    >
      <TaskRow {...props} dragging={s.isDragging} handleProps={props.editable && sortable ? { ...s.attributes, ...s.listeners } : undefined} />
    </li>
  )
})

function TaskRow({
  task,
  category,
  level,
  editable,
  onToggle,
  onEdit,
  onRename,
  onSubtask,
  goal,
  onDelete,
  saved,
  onSaveToShelf,
  dragging,
  handleProps,
}: TaskItemProps & { dragging: boolean; handleProps?: Record<string, unknown> }) {
  const { d, f, date, dir } = useI18n()
  const [burst, setBurst] = useState(0)
  const box = useAnimationControls()
  const swiped = useRef(false)
  const [moving, setMoving] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const fx = useEffects()
  const steps = task.subtasks ?? []
  const stepsDone = steps.filter((s) => s.done).length
  const [showSteps, setShowSteps] = useState(() => !task.completed)
  const moved = !!task.rescheduledTo
  const canToggle = editable && !moved

  const toggle = () => {
    if (!canToggle) return
    if (!task.completed && fx.completion) {
      setBurst((b) => b + 1)
      void box.start({ scale: [1, 0.84, 1.1, 0.98, 1], transition: { duration: level === 'full' ? 0.5 : 0.18, ease: 'easeOut' } })
    }
    onToggle(task)
  }

  const swipeSign = dir === 'rtl' ? 1 : -1

  return (
    <div className="relative">
      {/* revealed behind the row while swiping to delete */}
      {editable && moving && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-end rounded-lg bg-danger/15 px-4 text-danger rtl:justify-start">
          <Trash2 className="size-5" />
        </div>
      )}
      <motion.div
        drag={editable && !renaming && level !== 'off' ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: dir === 'rtl' ? 0.05 : 0.6, right: dir === 'rtl' ? 0.6 : 0.05 }}
        dragSnapToOrigin
        onDragStart={() => {
          swiped.current = true
          setMoving(true)
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x * swipeSign > 110 || info.velocity.x * swipeSign > 800) onDelete(task)
          setTimeout(() => (swiped.current = false), 0)
          setTimeout(() => setMoving(false), 350)
        }}
        style={{ touchAction: 'pan-y' }}
        className={cn(
          'group relative flex min-h-[52px] items-start gap-1.5 rounded-lg py-2 pe-1 ps-0.5',
          'transition-[box-shadow,background-color] duration-150',
          editable && !moving && !dragging && 'hover:bg-black/[0.035]',
          (moving || dragging) && 'bg-[var(--note-bg)]',
          dragging && 'shadow-lift ring-1 ring-black/5',
        )}
      >
        {handleProps ? (
          <button
            type="button"
            {...handleProps}
            aria-label={f(d.task.drag, { title: task.title })}
            className="mt-0.5 grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-[#302c28]/30 hover:text-[#302c28]/60 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span className="w-2 shrink-0" />
        )}

        <div className="relative mt-1 shrink-0">
          <motion.button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            aria-label={f(task.completed ? d.task.incomplete : d.task.complete, { title: task.title })}
            disabled={!canToggle}
            onClick={toggle}
            animate={box}
            whileTap={canToggle && level !== 'off' ? { scale: 0.88 } : undefined}
            className={cn(
              'grid size-7 place-items-center rounded-[7px] border-2 transition-colors',
              task.completed ? 'border-[#4F7A4A] bg-[#4F7A4A]/10 text-[#3D6B39]' : 'border-[#302c28]/35 bg-white/40 hover:border-[#302c28]/60',
              !canToggle && 'opacity-60',
            )}
          >
            <HandCheck checked={task.completed} level={level} className="size-5" />
          </motion.button>
          {fx.completion && fx.amp > 0 && <Sparkles key={burst} active={burst > 0} count={fx.amp === 1 ? 7 : 4} />}
        </div>

        {renaming ? (
          <InlineTitle
            initial={task.title}
            onCancel={() => setRenaming(false)}
            onSave={(title) => {
              setRenaming(false)
              if (title && title !== task.title) onRename?.(task, title)
            }}
            onDetails={() => {
              setRenaming(false)
              onEdit(task)
            }}
          />
        ) : (
        <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => !swiped.current && editable && (onRename && !moved ? setRenaming(true) : onEdit(task))}
          disabled={!editable}
          className="w-full cursor-text py-1 text-start disabled:cursor-default"
          aria-label={`${task.title}${editable ? `, ${d.task.edit}` : ''}`}
        >
          {/* Strike drawn as a growing background so it sweeps across every wrapped line in order. */}
          <motion.span
            className="text-[15px] leading-snug break-words [box-decoration-break:clone]"
            style={{
              backgroundImage: 'linear-gradient(rgb(48 44 40 / 0.55), rgb(48 44 40 / 0.55))',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: dir === 'rtl' ? '100% 58%' : '0 58%',
            }}
            initial={false}
            animate={{
              color: task.completed || moved ? 'rgb(48 44 40 / 0.5)' : 'rgb(48 44 40 / 1)',
              backgroundSize: task.completed ? '100% 1.6px' : '0% 1.6px',
            }}
            transition={
              level === 'off'
                ? { duration: 0 }
                : {
                    color: { duration: 0.3 },
                    backgroundSize: { duration: level === 'full' ? 0.42 : 0.12, ease: [0.65, 0, 0.35, 1], delay: task.completed && level === 'full' ? 0.12 : 0 },
                  }
            }
          >
            {task.title}
          </motion.span>
          {task.description && <span className="mt-0.5 line-clamp-2 block text-[13px] text-[#302c28]/60">{task.description}</span>}
          <Meta task={task} category={category} goal={goal} moved={moved} />
          {moved && (
            <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#302c28]/55">
              <Undo2 className="size-3 -scale-x-100" />
              {f(d.task.movedTo, { date: date(task.rescheduledTo!, 'short') })}
            </span>
          )}
        </button>
        {steps.length > 0 && (
          <div className="pb-1">
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              aria-expanded={showSteps}
              className="flex h-7 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-[#302c28]/60 hover:bg-black/5 hover:text-[#302c28]"
            >
              <ListChecks className="size-3.5" />
              {f(d.subtasks.progress, { done: stepsDone, total: steps.length })}
              <span className="ms-1 h-1 w-10 overflow-hidden rounded-full bg-black/10" aria-hidden>
                <span className="block h-full rounded-full bg-[#4F7A4A]/70 transition-[width] duration-300" style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
              </span>
              <ChevronDown className={cn('size-3.5 transition-transform', showSteps && 'rotate-180')} />
              <span className="sr-only">{showSteps ? d.subtasks.hide : d.subtasks.show}</span>
            </button>
            <AnimatePresence initial={false}>
              {showSteps && (
                <motion.ul
                  initial={level === 'off' ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={level === 'off' ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: level === 'full' ? 0.22 : 0.12 }}
                  className="overflow-hidden"
                >
                  {steps.map((s) => (
                    <li key={s.id} className="flex min-h-8 items-center gap-2 ps-1">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={s.done}
                        aria-label={f(d.subtasks.mark, { title: s.title })}
                        disabled={!editable || moved}
                        onClick={() => {
                          if (!s.done && fx.completion) playSound('pencil')
                          onSubtask?.(task, s.id, !s.done)
                        }}
                        className={cn(
                          'grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors',
                          s.done ? 'border-[#4F7A4A] bg-[#4F7A4A]/10 text-[#3D6B39]' : 'border-[#302c28]/35 bg-white/40 hover:border-[#302c28]/60',
                        )}
                      >
                        <HandCheck checked={s.done} level={level} className="size-3.5" />
                      </button>
                      <span className={cn('text-[13.5px] leading-snug text-[#302c28]/85', s.done && 'text-[#302c28]/50 line-through decoration-[#302c28]/40')}>{s.title}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
        </div>
        )}

        {onSaveToShelf && (
          <ShelfMark saved={!!saved} level={level} title={task.title} onSave={() => onSaveToShelf(task)} />
        )}
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-[#302c28]/40 opacity-100 hover:bg-black/5 hover:text-[#302c28]/80 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={`${d.task.edit}: ${task.title}`}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(task)}>
                <Pencil /> {d.task.editDetails}
              </DropdownMenuItem>
              {onSaveToShelf && (
                <DropdownMenuItem onSelect={() => onSaveToShelf(task)} disabled={saved}>
                  {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? d.shelf.savedTask : d.shelf.saveTask}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem danger onSelect={() => onDelete(task)}>
                <Trash2 /> {d.task.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </motion.div>
    </div>
  )
}

function Meta({ task, category, goal, moved }: { task: Task; category?: Category; goal?: Goal; moved: boolean }) {
  const { d, f, date } = useI18n()
  const items = []
  if (task.priority !== 'none')
    items.push(
      <span key="p" className="flex items-center gap-1">
        <Flag className="size-3" style={{ color: PRIORITY_COLOR[task.priority] }} fill={PRIORITY_COLOR[task.priority]} />
        {d.task.priorities[task.priority]}
      </span>,
    )
  if (task.dueTime)
    items.push(
      <span key="t" className="flex items-center gap-1 tabular-nums">
        <Clock className="size-3" />
        {task.dueTime}
      </span>,
    )
  if (category)
    items.push(
      <span key="c" className="flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ background: NOTE_INK[category.color] }} />
        {category.name}
      </span>,
    )
  if (goal)
    items.push(
      <span key="g" className="flex items-center gap-1" title={d.goals.link}>
        <Target className="size-3" style={{ color: NOTE_INK[goal.color] }} />
        <span className="max-w-[10rem] truncate">{goal.title}</span>
      </span>,
    )
  if (task.recurrenceId)
    items.push(
      <span key="r" className="flex items-center gap-1" title={d.task.recurring}>
        <Repeat className="size-3" />
        <span className="sr-only">{d.task.recurring}</span>
      </span>,
    )
  if (task.rescheduledFrom && !moved) items.push(<span key="f">{f(d.task.movedFrom, { date: date(task.rescheduledFrom, 'short') })}</span>)
  if (!items.length) return null
  return <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#302c28]/60">{items}</span>
}

/** A handful of tiny ink stars that pop out of the checkbox. Purely decorative. */
function Sparkles({ active, count = 7 }: { active: boolean; count?: number }) {
  return (
    <AnimatePresence>
      {active && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: count }, (_, i) => {
            const a = (i / count) * Math.PI * 2 + 0.4
            const r = 20 + (i % 3) * 5
            return (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 block size-1.5 rounded-full"
                style={{ background: ['#F2C14E', '#E8AD67', '#F6D58B', '#E39A4F'][i % 4], marginLeft: -3, marginTop: -3, boxShadow: '0 0 4px rgb(242 193 78 / 0.7)' }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0.4, 1.1, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
              />
            )
          })}
        </span>
      )}
    </AnimatePresence>
  )
}

/** In-place title editor: Enter saves, Escape cancels, Shift+Enter opens the full editor. */
function InlineTitle({ initial, onSave, onCancel, onDetails }: { initial: string; onSave: (v: string) => void; onCancel: () => void; onDetails: () => void }) {
  const { d } = useI18n()
  const [v, setV] = useState(initial)
  const done = useRef(false)
  const finish = (fn: () => void) => {
    if (done.current) return
    done.current = true
    fn()
  }
  return (
    <div className="min-w-0 flex-1 py-0.5">
      <input
        autoFocus
        value={v}
        maxLength={200}
        aria-label={d.task.title}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            finish(onDetails)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            finish(() => onSave(v.trim()))
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            finish(onCancel)
          }
        }}
        onBlur={() => finish(() => onSave(v.trim()))}
        className="h-9 w-full rounded-md bg-white/55 px-2 text-[15px] text-[#302c28] shadow-[inset_0_0_0_1px_rgb(48_44_40/0.18)] outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(128_91_61/0.6)]"
      />
      <span className="mt-1 block px-0.5 text-[11px] text-[#302c28]/55">{d.task.inlineHint}</span>
    </div>
  )
}

/**
 * Bookmark beside a task: appears on hover (always on touch), fills in once the title is on the
 * Task Shelf, and pops with a little ribbon drop when you save it.
 */
function ShelfMark({ saved, level, title, onSave }: { saved: boolean; level: MotionLevel; title: string; onSave: () => void }) {
  const { d } = useI18n()
  const [pop, setPop] = useState(0)
  return (
    <button
      type="button"
      onClick={() => {
        if (!saved) setPop((p) => p + 1)
        onSave()
      }}
      aria-label={`${saved ? d.shelf.savedTask : d.shelf.saveTask}: ${title}`}
      aria-pressed={saved}
      className={cn(
        'relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full transition-[opacity,color] hover:bg-black/5 focus-visible:opacity-100',
        saved ? 'text-[#8C5A2E]/80 hover:text-[#8C5A2E]' : 'text-[#302c28]/40 hover:text-[#302c28]/80',
        // saved tasks keep a quiet mark on touch screens; on desktop both appear on hover
        saved ? 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100 max-sm:opacity-60',
        pop > 0 && 'opacity-100',
      )}
    >
      <motion.span
        key={pop}
        className="grid place-items-center"
        initial={pop && level !== 'off' ? { scale: 0.6, rotate: -12 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={level === 'full' ? { type: 'spring', stiffness: 520, damping: 13 } : { duration: 0.15 }}
      >
        <Bookmark className="size-4" fill={saved ? 'currentColor' : 'none'} />
      </motion.span>
      {pop > 0 && level === 'full' && (
        <motion.span
          key={`r${pop}`}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-1.5 -translate-x-1/2 rounded-b-[1px] bg-[#C4553F]"
          initial={{ y: -2, opacity: 1, scaleY: 0.3 }}
          animate={{ y: 10, opacity: 0, scaleY: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      )}
    </button>
  )
}
