import { Bookmark } from 'lucide-react'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'

/**
 * The bookmark beside a note's "Add a task" field (or a labelled button on an empty day). It only
 * opens the shelf; the panel itself lives in <TaskShelfHost/> so it survives the note being created.
 */
export function ShelfButton({ date, noteId, labelled, className }: { date: string; noteId: string | null; labelled?: boolean; className?: string }) {
  const { d } = useI18n()
  const shelf = useUI((s) => s.shelf)
  const setShelf = useUI((s) => s.setShelf)
  const open = !!shelf && shelf.date === date && shelf.noteId === noteId
  const button = (
    <button
      type="button"
      onClick={() => setShelf(open ? null : { date, noteId })}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={labelled ? undefined : d.shelf.open}
      data-shelf-button
      data-shelf-date={date}
      data-shelf-note={noteId ?? ''}
      className={cn(
        labelled
          ? 'flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-[#302c28]/75 ring-1 ring-[#302c28]/15 transition hover:bg-black/5 hover:text-[#302c28] active:scale-[0.97]'
          : 'grid size-9 shrink-0 place-items-center rounded-full text-[#302c28]/45 transition-colors hover:bg-black/5 hover:text-[#302c28]/80',
        open && 'bg-black/5 text-[#8C5A2E]',
        className,
      )}
    >
      <Bookmark className="size-4" fill={open ? 'currentColor' : 'none'} />
      {labelled && d.shelf.fromShelf}
    </button>
  )
  return labelled ? button : <Tip label={d.shelf.title}>{button}</Tip>
}

/** Find the bookmark button for a target: the exact note's, else any on that day. */
export function findShelfAnchor(date: string, noteId: string | null): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-shelf-button][data-shelf-date="${date}"]`)]
  return all.find((el) => el.dataset.shelfNote === (noteId ?? '')) ?? all[0] ?? null
}
