import { create } from 'zustand'

export interface HistoryEntry {
  label: string
  undo: () => Promise<unknown>
  redo: () => Promise<unknown>
}

interface HistoryState {
  past: HistoryEntry[]
  future: HistoryEntry[]
  busy: boolean
}

const LIMIT = 60

export const useHistory = create<HistoryState>(() => ({ past: [], future: [], busy: false }))

export function record(entry: HistoryEntry) {
  useHistory.setState((s) => ({ past: [...s.past, entry].slice(-LIMIT), future: [] }))
}

async function run(from: 'past' | 'future'): Promise<HistoryEntry | null> {
  const s = useHistory.getState()
  if (s.busy) return null
  const stack = s[from]
  const entry = stack[stack.length - 1]
  if (!entry) return null
  useHistory.setState({ busy: true })
  try {
    await (from === 'past' ? entry.undo() : entry.redo())
    useHistory.setState((st) =>
      from === 'past'
        ? { past: st.past.slice(0, -1), future: [...st.future, entry] }
        : { future: st.future.slice(0, -1), past: [...st.past, entry] },
    )
    return entry
  } catch (e) {
    // The world changed underneath this entry (e.g. day pinned meanwhile): drop it rather than loop on it.
    useHistory.setState((st) => ({ [from]: st[from].filter((x) => x !== entry) }) as Partial<HistoryState>)
    throw e
  } finally {
    useHistory.setState({ busy: false })
  }
}

export const undo = () => run('past')
export const redo = () => run('future')

/** Undo one specific entry (e.g. from a toast's Undo button), wherever it is in the stack. */
export async function undoEntry(entry: HistoryEntry) {
  const { past } = useHistory.getState()
  if (past[past.length - 1] === entry) return undo()
  if (!past.includes(entry)) return null
  await entry.undo()
  useHistory.setState((s) => ({ past: s.past.filter((x) => x !== entry), future: [...s.future, entry] }))
  return entry
}

export function clearHistory() {
  useHistory.setState({ past: [], future: [] })
}
