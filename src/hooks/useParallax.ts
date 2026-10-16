import { useEffect } from 'react'

/**
 * Writes eased pointer position to `--px` / `--py` (−1…1) on an element, so CSS layers can shift by
 * their depth. One passive listener, a rAF loop only while easing, and nothing at all on touch.
 */
export function useParallax(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reset = () => {
      el.style.setProperty('--px', '0')
      el.style.setProperty('--py', '0')
    }
    if (!enabled || !window.matchMedia?.('(pointer: fine)').matches) {
      reset()
      return
    }
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let raf = 0
    const tick = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.setProperty('--px', cx.toFixed(3))
      el.style.setProperty('--py', cy.toFixed(3))
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      tx = -((e.clientX / window.innerWidth) * 2 - 1)
      ty = -((e.clientY / window.innerHeight) * 2 - 1)
      if (!raf) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      reset()
    }
  }, [ref, enabled])
}

/** CSS transform for a parallax layer at a given depth (px of travel at the screen edge). */
export const parallaxLayer = (depth: number): React.CSSProperties => ({
  transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth * 0.6}px), 0)`,
})
