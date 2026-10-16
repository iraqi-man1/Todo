import { toast } from 'sonner'
import type { UndoLabel } from '@/domain/undoable'
import { redo, undo, undoEntry, type HistoryEntry } from '@/store/history'
import { usePrefs } from '@/store/prefs'
import { reportError } from './errors'
import { DICTS } from './i18n'

const dict = () => DICTS[usePrefs.getState().prefs.language]
const labelOf = (e: HistoryEntry) => dict().history.labels[e.label as UndoLabel] ?? e.label

export async function undoWithToast() {
  try {
    const e = await undo()
    if (e) toast(dict().history.undone.replace('{label}', labelOf(e)), { action: { label: dict().history.redo, onClick: () => void redoWithToast() } })
    else toast(dict().history.nothingUndo)
  } catch (err) {
    reportError(err)
  }
}

export async function redoWithToast() {
  try {
    const e = await redo()
    if (e) toast(dict().history.redone.replace('{label}', labelOf(e)))
    else toast(dict().history.nothingRedo)
  } catch (err) {
    reportError(err)
  }
}

/** A toast offering to undo one specific action. */
export function toastWithUndo(message: string, entry: HistoryEntry | null | undefined, description?: string) {
  toast(message, {
    description,
    action: entry ? { label: dict().history.undo, onClick: () => void undoEntry(entry).catch(reportError) } : undefined,
  })
}
