import { animate, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useRef, useState } from 'react'
import { NOTE_HEX } from '@/domain/colors'
import type { NoteColor } from '@/domain/types'
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { useI18n } from '@/lib/i18n'
import { playSound, startRustle } from '@/lib/sound'
import { cn } from '@/lib/utils'

const PEEL_AT = 0.72
const PULL = 90 // px of pull for a full peel

/**
 * A pad of sticky notes. Pull its bottom corner and the top sheet lifts around its glued top edge,
 * following the pointer; past a point it comes away and flies off to become a new note. Let go
 * early and it flaps back down. A click or Enter peels one off for you.
 */
export function StickyPad({ color, level, onPeel, className }: { color: NoteColor; level: MotionLevel; onPeel: () => void; className?: string }) {
  const { d } = useI18n()
  const raw = useMotionValue(0)
  // underdamped so a released sheet flaps once or twice before lying flat
  const peel = useSpring(raw, { stiffness: 420, damping: 13, mass: 0.5 })
  const side = useMotionValue(0)
  const rotateX = useTransform(peel, (p) => p * 62)
  const curl = useTransform(peel, (p) => `linear-gradient(0deg, rgb(255 255 255 / ${0.12 + p * 0.45}), transparent ${30 + p * 30}%), linear-gradient(0deg, rgb(0 0 0 / ${p * 0.1}), transparent 40%)`)
  const under = useTransform(peel, (p) => p * 0.5)
  const fly = useMotionValue(0)
  const flyY = useTransform(fly, (f) => -f * 140)
  // twist from a sideways pull, plus a spin as it flies off
  const rotateZ = useTransform(() => side.get() * peel.get() * 10 - fly.get() * 16)
  const flyO = useTransform(fly, (f) => 1 - f)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ x: number; y: number; t: number; lx: number; ly: number; moved: boolean; rustle: ReturnType<typeof startRustle> } | null>(null)
  const sheet = NOTE_HEX[color]

  const detach = async () => {
    if (busy) return
    setBusy(true)
    playSound('paper')
    if (level === 'off') {
      onPeel()
      setBusy(false)
      return
    }
    raw.set(1)
    await animate(fly, 1, { duration: level === 'full' ? 0.34 : 0.15, ease: [0.3, 0.7, 0.4, 1] })
    onPeel()
    // the next sheet is already underneath: reset instantly
    peel.jump(0)
    raw.jump(0)
    side.jump(0)
    fly.jump(0)
    setBusy(false)
  }

  const release = () => {
    const s = drag.current
    drag.current = null
    s?.rustle?.stop()
    if (!s) return
    if (!s.moved) return void detach()
    if (raw.get() >= PEEL_AT) void detach()
    else {
      // a sheet that was pulled a fair way slaps back down audibly
      if (raw.get() > 0.25) playSound('paper')
      raw.set(0)
    }
  }

  return (
    <button
      type="button"
      aria-label={d.today.newNote}
      title={d.today.peelHint}
      disabled={busy}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, moved: false, rustle: level === 'off' ? null : startRustle() }
      }}
      onPointerMove={(e) => {
        const s = drag.current
        if (!s || level === 'off') return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        const dist = Math.hypot(dx, dy)
        if (dist > 4) s.moved = true
        // pulling up (or toward you) lifts the sheet; sideways pulls twist it a little
        raw.set(Math.min(1.08, Math.max(0, (Math.max(-dy, 0) + Math.abs(dx) * 0.5) / PULL)))
        side.set(Math.max(-1, Math.min(1, dx / PULL)))
        const now = performance.now()
        s.rustle?.update(Math.hypot(e.clientX - s.lx, e.clientY - s.ly) / Math.max(8, now - s.t))
        s.lx = e.clientX
        s.ly = e.clientY
        s.t = now
        if (raw.get() >= 1) release()
      }}
      onPointerUp={release}
      onPointerCancel={() => {
        drag.current?.rustle?.stop()
        drag.current = null
        raw.set(0)
      }}
      onClick={(e) => {
        // keyboard activation (pointer clicks are handled on release)
        if (e.detail === 0) void detach()
      }}
      className={cn('group flex h-11 touch-none items-center gap-3 rounded-full ps-1.5 pe-4 text-[14px] font-medium text-ink-soft transition-colors select-none hover:text-ink', className)}
    >
      <span className="relative block size-9" style={{ perspective: 220 }}>
        {/* the rest of the pad: a few sheet edges below */}
        <span aria-hidden className="absolute inset-0 translate-x-[2px] translate-y-[3px] rounded-[3px] shadow-[0_2px_3px_rgb(0_0_0/0.3)]" style={{ background: sheet, filter: 'brightness(0.86)' }} />
        <span aria-hidden className="absolute inset-0 translate-x-[1px] translate-y-[1.5px] rounded-[3px]" style={{ background: sheet, filter: 'brightness(0.93)' }} />
        {/* the shadow the lifting sheet throws on the one below */}
        <motion.span aria-hidden className="absolute inset-0 rounded-[3px] bg-[radial-gradient(ellipse_at_50%_100%,rgb(30_15_5/0.6),transparent_70%)]" style={{ opacity: under }} />
        {/* the top sheet, glued along its top edge */}
        <motion.span
          aria-hidden
          className="absolute inset-0 grid place-items-center rounded-[3px] text-[18px] leading-none text-[#302c28]/55 shadow-[0_1px_1px_rgb(0_0_0/0.15)]"
          style={{ backgroundColor: sheet, backgroundImage: curl, rotateX, rotate: rotateZ, y: flyY, opacity: flyO, originY: 0, transformStyle: 'preserve-3d' }}
        >
          +
        </motion.span>
      </span>
      {d.today.newNote}
    </button>
  )
}
