import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GoalsBoard } from '@/components/goals/GoalsBoard'
import type { WallView } from '@/store/ui'
import { DayBoard, MonthBoard, WeekBoard, YearBoard, type BoardProps } from './Boards'

/** Printable area of an A4 landscape page at 96dpi, less the page margins set in CSS. */
const PAGE_W = 1047
const PAGE_H = 718

/**
 * A print-only copy of the board on screen, scaled to fill one landscape page. It is mounted just
 * long enough to print: the app itself is hidden by the `@media print` rules in index.css.
 */
export function PrintWall({ view, props, onDone }: { view: WallView; props: BoardProps; onDone: () => void }) {
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    setScale(Math.min(PAGE_W / el.scrollWidth, PAGE_H / el.scrollHeight, 1.6))
  }, [])

  useLayoutEffect(() => {
    if (scale === null) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    window.addEventListener('afterprint', finish)
    let armed = false
    // Fallback for browsers whose print() returns before the dialog closes and never fire afterprint:
    // the next interaction with the app means printing is over.
    const onInteract = () => armed && finish()
    window.addEventListener('pointerdown', onInteract)
    window.addEventListener('keydown', onInteract)
    // Let textures and fonts settle before the print dialog snapshots the page.
    const t = setTimeout(async () => {
      await document.fonts?.ready
      window.print()
      armed = true
    }, 120)
    return () => {
      clearTimeout(t)
      window.removeEventListener('afterprint', finish)
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('keydown', onInteract)
    }
  }, [scale, onDone])

  const board = { ...props, level: 'off' as const, narrow: false, justPinned: null, inspecting: null }
  return createPortal(
    <div className="dw-print-sheet" aria-hidden>
      <div style={{ width: PAGE_W, height: PAGE_H, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div ref={inner} style={{ transform: `scale(${scale ?? 1})`, transformOrigin: 'center', width: 'max-content', visibility: scale === null ? 'hidden' : undefined }}>
          {view === 'month' && <MonthBoard {...board} />}
          {view === 'week' && <WeekBoard {...board} />}
          {view === 'year' && <YearBoard {...board} />}
          {view === 'day' && <DayBoard {...board} />}
          {view === 'goals' && <GoalsBoard narrow={false} level="off" />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
