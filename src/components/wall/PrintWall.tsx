import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GoalsBoard } from '@/components/goals/GoalsBoard'
import { useI18n } from '@/lib/i18n'
import type { WallView } from '@/store/ui'
import { DayBoard, MonthBoard, WeekBoard, YearBoard, YearHeatmap, type BoardProps } from './Boards'

/** Printable area of a landscape page at 96dpi, less 8mm margins. */
const PAGES = { A4: { w: 1047, h: 718 }, A3: { w: 1527, h: 1062 } } as const
/** Room for the title above and the footer below the board. */
const CHROME = 78

/**
 * A print-only copy of the board on screen, scaled to fill one landscape page. It is mounted just
 * long enough to print: the app itself is hidden by the `@media print` rules in index.css.
 */
export function PrintWall({ view, yearStyle = 'notes', props, title, paper, onDone }: { view: WallView; yearStyle?: 'notes' | 'heat'; props: BoardProps; title: string; paper: 'A4' | 'A3'; onDone: () => void }) {
  const { d, date } = useI18n()
  const { w: PAGE_W, h: PAGE_H } = PAGES[paper]
  const BOARD_H = PAGE_H - CHROME
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    setScale(Math.min(PAGE_W / el.scrollWidth, BOARD_H / el.scrollHeight, 2))
  }, [PAGE_W, BOARD_H])

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
    <div className="dw-print-sheet" aria-hidden style={{ width: PAGE_W, height: PAGE_H, display: 'flex', flexDirection: 'column', color: '#3A2A1C' }}>
      <style>{`@media print { @page { size: ${paper} landscape; margin: 8mm; } }`}</style>
      <header style={{ height: 44, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '1px solid #D9CBB6', marginBottom: 8 }}>
        <span className="font-hand" style={{ fontSize: 30, lineHeight: 1 }}>{title}</span>
        <span style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7 }}>DoneWall</span>
      </header>
      <div style={{ width: PAGE_W, height: BOARD_H, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div ref={inner} style={{ transform: `scale(${scale ?? 1})`, transformOrigin: 'center', width: 'max-content', visibility: scale === null ? 'hidden' : undefined }}>
          {view === 'month' && <MonthBoard {...board} />}
          {view === 'week' && <WeekBoard {...board} />}
          {view === 'year' && (yearStyle === 'heat' ? <YearHeatmap {...board} /> : <YearBoard {...board} />)}
          {view === 'day' && <DayBoard {...board} />}
          {view === 'goals' && <GoalsBoard narrow={false} level="off" />}
        </div>
      </div>
      <footer style={{ height: 18, marginTop: 8, fontSize: 10.5, opacity: 0.6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{d.print.footer}</span>
        <span>{date(new Date(), 'long')}</span>
      </footer>
    </div>,
    document.body,
  )
}
