import { Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NOTE_HEX } from '@/domain/colors'
import type { Archive, DateKey } from '@/domain/types'
import { useI18n } from '@/lib/i18n'

interface Hit {
  key: string
  date: DateKey
  text: string
  color: string
}

export function searchArchives(archives: Archive[], query: string, limit = 60): Hit[] {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return []
  const hits: Hit[] = []
  const sorted = [...archives].sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const a of sorted) {
    const color = NOTE_HEX[a.color]
    if (a.title.toLocaleLowerCase().includes(q)) hits.push({ key: `${a.id}-t`, date: a.date, text: a.title, color })
    if (a.personalNote.toLocaleLowerCase().includes(q)) hits.push({ key: `${a.id}-n`, date: a.date, text: a.personalNote, color })
    for (const t of a.tasks)
      if (t.title.toLocaleLowerCase().includes(q) || t.description.toLocaleLowerCase().includes(q))
        hits.push({ key: `${a.id}-${t.id}`, date: a.date, text: t.title, color })
    if (hits.length >= limit) break
  }
  return hits.slice(0, limit)
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLocaleLowerCase().indexOf(q.trim().toLocaleLowerCase())
  if (i < 0 || !q.trim()) return <>{text}</>
  const n = q.trim().length
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-note-yellow px-0.5 text-[#302c28]">{text.slice(i, i + n)}</mark>
      {text.slice(i + n)}
    </>
  )
}

export function WallSearch({
  open,
  onOpenChange,
  archives,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  archives: Archive[]
  onPick: (date: DateKey) => void
}) {
  const { d, f, date } = useI18n()
  const [q, setQ] = useState('')
  const dq = useDeferredValue(q)
  const hits = useMemo(() => searchArchives(archives, dq), [archives, dq])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:top-[12vh] sm:translate-y-0">
        <DialogTitle className="sr-only">{d.wall.search}</DialogTitle>
        <DialogDescription className="sr-only">{d.wall.searchHint}</DialogDescription>
        <div className="relative me-10">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={d.wall.searchPlaceholder}
            aria-label={d.wall.search}
            className="h-12 w-full rounded-xl border border-line bg-surface-2 ps-11 pe-3 text-base focus:border-accent/60 focus:outline-none focus-visible:outline-none"
          />
        </div>
        <div className="mt-3 min-h-40" aria-live="polite">
          {!q.trim() ? (
            <p className="py-8 text-center text-sm text-ink-soft">{d.wall.searchHint}</p>
          ) : hits.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">{f(d.wall.noResults, { q })}</p>
          ) : (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <li key={h.key}>
                  <button type="button" onClick={() => onPick(h.date)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-start hover:bg-surface-2">
                    <span className="size-8 shrink-0 rounded-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.15)]" style={{ background: h.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">
                        <Highlight text={h.text} q={q} />
                      </span>
                      <span className="text-xs text-ink-soft">{date(h.date, 'long')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
