import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Clock, Flag, GripVertical, MoreHorizontal, Pencil, Repeat, Trash2, Undo2 } from 'lucide-react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { memo, useRef, useState } from 'react'
import { HandCheck } from '@/components/paper/HandCheck'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NOTE_INK } from '@/domain/colors'
import type { Category, Task } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const PRIORITY_COLOR = { none: '', low: '#6FA563', medium: '#D99A3A', high: '#C4553F' } as const

export interface TaskItemProps {
  task: Task
  category?: Category
  level: MotionLevel
  editable: boolean
  sortable?: boolean
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
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
  onDelete,
  dragging,
  handleProps,
}: TaskItemProps & { dragging: boolean; handleProps?: Record<string, unknown> }) {
  const { d, f, date, dir } = useI18n()
  const [burst, setBurst] = useState(0)
  const box = useAnimationControls()
  const swiped = useRef(false)
  const [moving, setMoving] = useState(false)
  const moved = !!task.rescheduledTo
  const canToggle = editable && !moved

  const toggle = () => {
    if (!canToggle) return
    if (!task.completed) {
      setBurst((b) => b + 1)
      if (level !== 'off') void box.start({ scale: [1, 0.82, 1.12, 1], transition: { duration: level === 'full' ? 0.42 : 0.15 } })
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
        drag={editable && level !== 'off' ? 'x' : false}
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
          'transition-shadow',
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
          {level === 'full' && <Sparkles key={burst} active={burst > 0} />}
        </div>

        <button
          type="button"
          onClick={() => !swiped.current && editable && onEdit(task)}
          disabled={!editable}
          className="min-w-0 flex-1 cursor-text py-1 text-start disabled:cursor-default"
          aria-label={`${task.title}${editable ? `, ${d.task.edit}` : ''}`}
        >
          <span className="relative inline">
            <motion.span
              className="text-[15px] leading-snug break-words"
              initial={false}
              animate={{ color: task.completed || moved ? 'rgb(48 44 40 / 0.5)' : 'rgb(48 44 40 / 1)' }}
              transition={{ duration: level === 'off' ? 0 : 0.3 }}
            >
              {task.title}
            </motion.span>
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-[55%] h-[1.6px] rounded-full bg-[#302c28]/55"
              style={{ originX: dir === 'rtl' ? 1 : 0 }}
              initial={false}
              animate={{ scaleX: task.completed ? 1 : 0 }}
              transition={level === 'off' ? { duration: 0 } : { duration: level === 'full' ? 0.38 : 0.12, ease: [0.65, 0, 0.35, 1], delay: task.completed && level === 'full' ? 0.12 : 0 }}
            />
          </span>
          {task.description && <span className="mt-0.5 line-clamp-2 block text-[13px] text-[#302c28]/60">{task.description}</span>}
          <Meta task={task} category={category} moved={moved} />
          {moved && (
            <span className="mt-1 flex items-center gap-1 text-xs font-medium text-[#302c28]/55">
              <Undo2 className="size-3 -scale-x-100" />
              {f(d.task.movedTo, { date: date(task.rescheduledTo!, 'short') })}
            </span>
          )}
        </button>

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
                <Pencil /> {d.task.edit}
              </DropdownMenuItem>
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

function Meta({ task, category, moved }: { task: Task; category?: Category; moved: boolean }) {
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
function Sparkles({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2 + 0.4
            const r = 20 + (i % 3) * 5
            return (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 block size-1.5 rounded-full"
                style={{ background: ['#E0A526', '#E37A6B', '#6FA563', '#8C7AD6'][i % 4], marginLeft: -3, marginTop: -3 }}
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
