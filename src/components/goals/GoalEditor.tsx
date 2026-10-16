import { Check, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, Textarea } from '@/components/ui/fields'
import { addGoal, deleteGoal, updateGoal } from '@/domain/actions'
import { NOTE_HEX } from '@/domain/colors'
import { NOTE_COLORS, type Goal, type NoteColor } from '@/domain/types'
import { reportError } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Create or edit a goal. Render inside a <Dialog>. */
export function GoalEditor({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { d } = useI18n()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [color, setColor] = useState<NoteColor>(goal?.color ?? 'sand')
  const [target, setTarget] = useState(goal?.target ? String(goal.target) : '')
  const [dueDate, setDueDate] = useState(goal?.dueDate ?? '')
  const [error, setError] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const save = async () => {
    if (!title.trim()) {
      setError(true)
      return
    }
    const n = parseInt(target, 10)
    const fields = { title: title.trim(), description: description.trim(), color, target: Number.isFinite(n) && n > 0 ? n : null, dueDate: dueDate || null }
    try {
      if (goal) await updateGoal(goal.id, fields)
      else await addGoal(fields)
      onClose()
    } catch (e) {
      reportError(e)
    }
  }

  return (
    <DialogContent>
      <DialogTitle>{goal ? d.goals.edit : d.goals.new}</DialogTitle>
      <DialogDescription className="sr-only">{d.goals.empty}</DialogDescription>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div>
          <Label htmlFor="goal-title">{d.goals.name}</Label>
          <Input
            id="goal-title"
            autoFocus
            value={title}
            maxLength={80}
            placeholder={d.goals.namePlaceholder}
            aria-invalid={error}
            onChange={(e) => {
              setTitle(e.target.value)
              setError(false)
            }}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-sm text-danger">
              {d.task.required}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="goal-desc">{d.goals.description}</Label>
          <Textarea id="goal-desc" rows={2} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="goal-target">{d.goals.target}</Label>
            <Input id="goal-target" type="number" inputMode="numeric" min={1} max={9999} value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="goal-due">{d.goals.due}</Label>
            <Input id="goal-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-ink-soft">{d.goals.targetHelp}</p>
        <div>
          <Label>{d.goals.color}</Label>
          <div role="radiogroup" aria-label={d.goals.color} className="flex flex-wrap gap-2">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={d.colors[c]}
                onClick={() => setColor(c)}
                className={cn('grid size-9 place-items-center rounded-md shadow-sm transition', color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                style={{ background: NOTE_HEX[c] }}
              >
                {color === c && <Check className="size-4 text-[#302c28]" />}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          {goal && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)} aria-label={d.goals.delete}>
              <Trash2 />
            </Button>
          )}
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {d.common.cancel}
          </Button>
          <Button type="submit" variant="primary" className="flex-[2]">
            {d.goals.save}
          </Button>
        </div>
      </form>
      {goal && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={d.goals.delete}
          body={d.goals.deleteConfirm}
          confirmLabel={d.common.delete}
          danger
          onConfirm={() => deleteGoal(goal.id).then(onClose, reportError)}
        />
      )}
    </DialogContent>
  )
}
