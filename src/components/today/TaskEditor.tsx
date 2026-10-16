import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, Segmented, Select, Textarea } from '@/components/ui/fields'
import { db } from '@/db/db'
import { createRecurrence, deleteRecurrence } from '@/domain/actions'
import { uAddTask, uUpdateTask } from '@/domain/undoable'
import { PRIORITIES, type Priority, type RecurrenceFrequency, type Subtask, type Task } from '@/domain/types'
import { uid } from '@/domain/ids'
import { X } from 'lucide-react'
import { useCategories, useGoals } from '@/hooks/useData'
import { fromKey, weekdayOrder } from '@/lib/dates'
import { formatKey, useI18n } from '@/lib/i18n'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/utils'
import { reportError } from '@/lib/errors'

type Repeat = 'none' | RecurrenceFrequency

/** Full task editor for create and edit. Opened from the FAB, the `N` shortcut, or a task. */
export function TaskEditor() {
  const editor = useUI((s) => s.editor)
  const close = useUI((s) => s.closeEditor)
  return (
    <Dialog open={!!editor} onOpenChange={(o) => !o && close()}>
      {editor && <EditorBody key={editor.taskId ?? `new-${editor.date}-${editor.noteId ?? ''}`} />}
    </Dialog>
  )
}

function EditorBody() {
  const editor = useUI((s) => s.editor)!
  const close = useUI((s) => s.closeEditor)
  const { d, f, lang } = useI18n()
  const prefs = usePrefs((s) => s.prefs)
  const categories = useCategories()
  const data = useLiveQuery(async () => {
    const [task, notes] = await Promise.all([
      editor.taskId ? db.tasks.get(editor.taskId) : undefined,
      db.notes.where('date').equals(editor.date).sortBy('order'),
    ])
    const recurrence = task?.recurrenceId ? await db.recurrences.get(task.recurrenceId) : undefined
    return { task, notes, recurrence }
  }, [editor.taskId, editor.date])

  const [title, setTitle] = useState(editor.title ?? '')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [dueTime, setDueTime] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [goalId, setGoalId] = useState('')
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [stepDraft, setStepDraft] = useState('')
  const goals = useGoals()
  const [noteId, setNoteId] = useState(editor.noteId ?? '')
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [weekdays, setWeekdays] = useState<number[]>([fromKey(editor.date).getDay()])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(!editor.taskId)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data || loaded) return
    const t = data.task
    if (t) {
      setTitle(t.title)
      setDescription(t.description)
      setPriority(t.priority)
      setDueTime(t.dueTime ?? '')
      setCategoryId(t.categoryId ?? '')
      setGoalId(t.goalId ?? '')
      setSubtasks(t.subtasks ?? [])
      setNoteId(t.noteId)
      if (data.recurrence) {
        setRepeat(data.recurrence.frequency)
        setWeekdays(data.recurrence.weekdays)
      }
    }
    setLoaded(true)
  }, [data, loaded])

  const weekdayNames = useMemo(
    () =>
      weekdayOrder(prefs.weekStartsOn).map((wd) => ({
        wd,
        // 2023-01-01 was a Sunday
        label: formatKey(new Date(2023, 0, 1 + wd), 'weekdayShort', lang, 'friendly'),
      })),
    [prefs.weekStartsOn, lang],
  )

  const isEdit = !!editor.taskId
  if (isEdit && data && !data.task) return null
  // Never show the edit form before the task has loaded, or a late load would overwrite typing.
  if (!loaded) return null

  const save = async () => {
    const clean = title.trim()
    if (!clean) {
      setError(d.task.required)
      return
    }
    setSaving(true)
    try {
      const fields = {
        title: clean,
        description,
        priority,
        dueTime: dueTime || null,
        categoryId: categoryId || null,
        goalId: goalId || null,
        subtasks: [...subtasks, ...(stepDraft.trim() ? [{ id: uid(), title: stepDraft.trim(), done: false }] : [])].filter((s) => s.title.trim()),
      }
      let task: Task | undefined
      if (isEdit) {
        await uUpdateTask(editor.taskId!, { ...fields, ...(noteId ? { noteId } : {}) })
        task = await db.tasks.get(editor.taskId!)
      } else {
        task = (await uAddTask(editor.date, fields, { noteId: noteId || null, color: prefs.defaultNoteColor })).task
      }
      if (task) await syncRecurrence(task)
      close()
    } catch (e) {
      reportError(e)
    } finally {
      setSaving(false)
    }
  }

  const syncRecurrence = async (task: Task) => {
    const existing = data?.recurrence
    const same =
      existing && existing.frequency === repeat && (repeat !== 'weekly' || existing.weekdays.join() === [...weekdays].sort().join())
    if (repeat === 'none') {
      if (existing) await deleteRecurrence(existing.id)
      return
    }
    if (same) {
      await db.recurrences.update(existing.id, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        categoryId: task.categoryId,
        dueTime: task.dueTime,
        updatedAt: Date.now(),
      })
      return
    }
    if (existing) await deleteRecurrence(existing.id)
    if (repeat === 'weekly' && !weekdays.length) return
    await createRecurrence(
      {
        title: task.title,
        description: task.description,
        priority: task.priority,
        categoryId: task.categoryId,
        dueTime: task.dueTime,
        frequency: repeat,
        weekdays: [...weekdays].sort(),
        startDate: task.date,
      },
      task.id,
    )
    toast(d.task.recurring, { description: d.task.repeatOptions[repeat] })
  }

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>{isEdit ? d.task.editTask : d.task.newTask}</DialogTitle>
      <DialogDescription className="sr-only">{formatKey(editor.date, 'long', lang, prefs.dateFormat)}</DialogDescription>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div>
          <Label htmlFor="task-title">{d.task.title}</Label>
          <Input
            id="task-title"
            autoFocus
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value)
              setError('')
            }}
            placeholder={d.task.titlePlaceholder}
            aria-invalid={!!error}
            aria-describedby={error ? 'task-title-error' : undefined}
          />
          {error && (
            <p id="task-title-error" role="alert" className="mt-1.5 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="task-desc">{d.task.description}</Label>
          <Textarea
            id="task-desc"
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={d.task.descriptionPlaceholder}
            rows={2}
          />
        </div>
        <div>
          <Label id="prio-label">{d.task.priority}</Label>
          <Segmented
            label={d.task.priority}
            value={priority}
            onChange={setPriority}
            className="flex w-full"
            options={PRIORITIES.map((p) => ({ value: p, label: d.task.priorities[p] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="task-time">{d.task.dueTime}</Label>
            <Input id="task-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-cat">{d.task.category}</Label>
            <Select id="task-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{d.task.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="task-step">{d.subtasks.title}</Label>
          {subtasks.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1">
              {subtasks.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg bg-surface-2/60 px-2">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => setSubtasks((list) => list.map((x) => (x.id === s.id ? { ...x, done: e.target.checked } : x)))}
                    aria-label={f(d.subtasks.mark, { title: s.title || String(i + 1) })}
                    className="size-4 accent-[var(--dw-accent)]"
                  />
                  <input
                    value={s.title}
                    maxLength={140}
                    onChange={(e) => setSubtasks((list) => list.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                    aria-label={d.subtasks.title}
                    className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSubtasks((list) => list.filter((x) => x.id !== s.id))}
                    aria-label={f(d.subtasks.remove, { title: s.title })}
                    className="grid size-8 place-items-center rounded-full text-ink-soft hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            id="task-step"
            value={stepDraft}
            maxLength={140}
            placeholder={d.subtasks.add}
            onChange={(e) => setStepDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!stepDraft.trim()) return
                setSubtasks((list) => [...list, { id: uid(), title: stepDraft.trim(), done: false }])
                setStepDraft('')
              }
            }}
          />
        </div>
        {goals.length > 0 && (
          <div>
            <Label htmlFor="task-goal">{d.goals.link}</Label>
            <Select id="task-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">{d.goals.none}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </div>
        )}
        {data && data.notes.length > 1 && (
          <div>
            <Label htmlFor="task-note">{d.task.note}</Label>
            <Select id="task-note" value={noteId} onChange={(e) => setNoteId(e.target.value)}>
              {data.notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title || d.today.untitledNote}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="task-repeat">{d.task.repeat}</Label>
          <Select id="task-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {(['none', 'daily', 'weekdays', 'weekly'] as const).map((r) => (
              <option key={r} value={r}>
                {d.task.repeatOptions[r]}
              </option>
            ))}
          </Select>
          {repeat === 'weekly' && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={d.task.repeatOptions.weekly}>
              {weekdayNames.map(({ wd, label }) => {
                const on = weekdays.includes(wd)
                return (
                  <button
                    key={wd}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== wd) : [...w, wd]))}
                    className={cn(
                      'h-9 min-w-11 rounded-full border px-2.5 text-[13px] font-medium',
                      on ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-soft hover:bg-surface-2',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={close}>
            {d.task.cancel}
          </Button>
          <Button type="submit" variant="primary" className="flex-[2]" disabled={saving}>
            {isEdit ? d.task.save : d.task.create}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
