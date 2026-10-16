/**
 * Crumple & toss: a deleted task scrunches into a paper ball, flies on a real ballistic arc into a
 * little wastebasket, clips the rim, drops in, and the basket wobbles. Undo reverses it: the ball
 * hops back out and unfolds where the task was. Plain DOM + Web Animations, so React never
 * re-renders for it; nothing runs when motion is off.
 */
import type { MotionLevel } from '@/hooks/useMotionLevel'
import { playSound } from './sound'

const BALL = 30
const G = 2600 // px/s², a heavy-ish paper ball

let basket: HTMLDivElement | null = null
let hideTimer: ReturnType<typeof setTimeout> | undefined

const canAnimate = () => typeof document !== 'undefined' && !!document.body?.animate

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)))
  return `rgb(${f(n >> 16)} ${f((n >> 8) & 255)} ${f(n & 255)})`
}

/** A crumpled ball: facets of the note's colour in different lights, drawn as one small SVG. */
function ballSvg(color: string) {
  const facets = [
    ['15,2 26,8 20,15', 1.08],
    ['2,11 15,2 20,15', 0.98],
    ['20,15 26,8 28,19', 0.9],
    ['2,11 20,15 10,23', 0.94],
    ['20,15 28,19 21,27', 0.8],
    ['10,23 20,15 21,27', 0.86],
    ['2,11 10,23 4,20', 0.85],
    ['10,23 21,27 12,28', 0.74],
  ] as const
  const polys = facets.map(([pts, k]) => `<polygon points="${pts}" fill="${shade(color, k)}" stroke="rgb(60 40 20 / 0.18)" stroke-width="0.5"/>`).join('')
  return `<svg viewBox="0 0 30 30" width="${BALL}" height="${BALL}" style="display:block;filter:drop-shadow(0 3px 3px rgb(30 15 5 / 0.35))">${polys}<path d="M8 9 l5 3 M17 6 l2 5 M22 18 l-4 4 M9 18 l4 -2" stroke="rgb(60 40 20 / 0.25)" stroke-width="0.6" fill="none"/></svg>`
}

const BASKET_SVG = (part: 'back' | 'front') =>
  part === 'back'
    ? `<svg viewBox="0 0 76 84" width="76" height="84" aria-hidden="true"><ellipse cx="38" cy="14" rx="34" ry="9" fill="#3a2614"/><ellipse cx="38" cy="15" rx="30" ry="6.5" fill="#1d130a"/></svg>`
    : `<svg viewBox="0 0 76 84" width="76" height="84" aria-hidden="true">
        <defs><linearGradient id="dwb" x1="0" x2="1"><stop offset="0" stop-color="#6b4526"/><stop offset="0.45" stop-color="#a87445"/><stop offset="1" stop-color="#5a3a1f"/></linearGradient></defs>
        <path d="M5 15 L13 78 Q38 86 63 78 L71 15 Q38 25 5 15 Z" fill="url(#dwb)"/>
        ${Array.from({ length: 7 }, (_, i) => `<path d="M${11 + i * 9} ${19 + Math.abs(3 - i) * 0.6} L${16 + i * 7.3} 80" stroke="#3d2714" stroke-opacity="0.45" stroke-width="1.4"/>`).join('')}
        ${[32, 48, 64].map((y) => `<path d="M${6 + y * 0.1} ${y} Q38 ${y + 7} ${70 - y * 0.1} ${y}" stroke="#3d2714" stroke-opacity="0.35" stroke-width="1.2" fill="none"/>`).join('')}
        <ellipse cx="38" cy="15" rx="34" ry="9" fill="none" stroke="#c8925a" stroke-width="3.2"/>
        <ellipse cx="38" cy="14" rx="34" ry="9" fill="none" stroke="#e6b47a" stroke-opacity="0.5" stroke-width="1"/>
      </svg>`

/** The basket peeks in from the bottom corner while it's needed, then slips away. */
function showBasket(): { el: HTMLDivElement; mouth: { x: number; y: number }; front: HTMLElement } {
  if (!basket) {
    basket = document.createElement('div')
    basket.setAttribute('aria-hidden', 'true')
    basket.dataset.wastebasket = ''
    Object.assign(basket.style, {
      position: 'fixed',
      width: '76px',
      height: '84px',
      insetInlineEnd: 'max(20px, calc(var(--safe-right, 0px) + 20px))',
      bottom: window.matchMedia('(min-width: 768px)').matches ? '22px' : 'calc(84px + var(--safe-bottom, 0px))',
      zIndex: '70',
      pointerEvents: 'none',
      transformOrigin: '50% 100%',
      transform: 'translateY(140%)',
      transition: 'transform 380ms cubic-bezier(0.34, 1.4, 0.64, 1)',
    } satisfies Partial<CSSStyleDeclaration>)
    basket.innerHTML = `<div style="position:absolute;inset:0">${BASKET_SVG('back')}</div><div data-front style="position:absolute;inset:0;z-index:2">${BASKET_SVG('front')}</div>`
    document.body.appendChild(basket)
    void basket.offsetWidth
  }
  clearTimeout(hideTimer)
  basket.style.transform = 'translateY(0)'
  const r = basket.getBoundingClientRect()
  // where the basket will sit once it has slid in
  const top = window.innerHeight - parseFloat(getComputedStyle(basket).bottom) - r.height
  return { el: basket, mouth: { x: r.left + r.width / 2, y: top + 14 }, front: basket.querySelector('[data-front]') as HTMLElement }
}

function hideBasketSoon(ms = 1600) {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (basket) basket.style.transform = 'translateY(140%)'
  }, ms)
}

function wobble(el: HTMLElement) {
  el.animate([{ rotate: '0deg' }, { rotate: '-7deg' }, { rotate: '5deg' }, { rotate: '-2.5deg' }, { rotate: '0deg' }], { duration: 620, easing: 'ease-out' })
}

function makeBall(color: string, x: number, y: number) {
  const ball = document.createElement('div')
  ball.setAttribute('aria-hidden', 'true')
  ball.innerHTML = ballSvg(color)
  Object.assign(ball.style, {
    position: 'fixed',
    left: `${x - BALL / 2}px`,
    top: `${y - BALL / 2}px`,
    width: `${BALL}px`,
    height: `${BALL}px`,
    zIndex: '71',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(ball)
  return ball
}

/** Positions along a ballistic arc from a to b taking `t` seconds, as WAAPI keyframes. */
function arc(a: { x: number; y: number }, b: { x: number; y: number }, t: number, spin: number, steps = 18) {
  const vx = (b.x - a.x) / t
  const vy = (b.y - a.y - 0.5 * G * t * t) / t
  return Array.from({ length: steps + 1 }, (_, i) => {
    const k = (i / steps) * t
    const x = vx * k
    const y = vy * k + 0.5 * G * k * k
    return { transform: `translate(${x}px, ${y}px) rotate(${(spin * i) / steps}deg)`, offset: i / steps }
  })
}

/** Flight time scales with distance so long throws don't look rushed, short ones don't float. */
const flightTime = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.min(0.85, Math.max(0.5, Math.hypot(b.x - a.x, b.y - a.y) / 1500))

export function tossToBasket(from: DOMRect, title: string, color: string, level: MotionLevel) {
  if (level === 'off' || !canAnimate()) return
  playSound('crumple')
  const cx = from.left + Math.min(from.width, 280) / 2
  const cy = from.top + from.height / 2

  // 1. the row scrunches toward its middle
  const strip = document.createElement('div')
  strip.textContent = title
  strip.setAttribute('aria-hidden', 'true')
  Object.assign(strip.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${Math.min(from.width, 280)}px`,
    height: `${from.height}px`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    font: '400 15px/1.2 Inter Variable, sans-serif',
    color: '#302c28',
    background: color,
    borderRadius: '4px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    zIndex: '71',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>)
  document.body.appendChild(strip)
  const full = level === 'full'
  const scrunch = strip.animate(
    [
      { transform: 'scale(1) rotate(0deg)', borderRadius: '4px', opacity: 1 },
      { transform: 'scale(0.55, 0.8) rotate(-6deg)', borderRadius: '30%', opacity: 1, offset: 0.55 },
      { transform: `scale(${BALL / Math.min(from.width, 280)}, ${BALL / from.height}) rotate(12deg)`, borderRadius: '50%', opacity: 0 },
    ],
    { duration: full ? 260 : 140, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
  )

  scrunch.onfinish = () => {
    strip.remove()
    const { el, mouth, front } = showBasket()
    const ball = makeBall(color, cx, cy)
    if (!full) {
      // reduced: a short, straight drop into the basket
      const a = ball.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${mouth.x - cx}px, ${mouth.y + 20 - cy}px)`, opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' })
      a.onfinish = () => {
        ball.remove()
        hideBasketSoon(900)
      }
      return
    }
    // 2. thrown: it clips the near rim (a little short of centre), bounces, and drops in
    const rim = { x: mouth.x + 16, y: mouth.y - 2 }
    const t = flightTime({ x: cx, y: cy }, rim)
    const fly = ball.animate(arc({ x: cx, y: cy }, rim, t, 520), { duration: t * 1000, easing: 'linear', fill: 'forwards' })
    fly.onfinish = () => {
      playSound('thud')
      wobble(el)
      // the ball now sits between the basket's back and front, so it disappears inside it
      ball.style.zIndex = '1'
      el.insertBefore(ball, front)
      const bx = rim.x - el.getBoundingClientRect().left - BALL / 2
      const by = rim.y - el.getBoundingClientRect().top - BALL / 2
      Object.assign(ball.style, { position: 'absolute', left: `${bx}px`, top: `${by}px` })
      const drop = ball.animate(
        [
          { transform: 'translate(0, 0) rotate(520deg)' },
          { transform: 'translate(-8px, -16px) rotate(600deg)', offset: 0.35 },
          { transform: 'translate(-16px, 34px) rotate(700deg)' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.3, 0, 0.7, 1)', fill: 'forwards' },
      )
      drop.onfinish = () => {
        ball.remove()
        hideBasketSoon()
      }
    }
  }
}

/** Undo: the ball hops out of the basket and unfolds back into the task's row. */
export function untossTo(to: DOMRect, color: string, level: MotionLevel) {
  if (level === 'off' || !canAnimate()) return
  const { el, mouth } = showBasket()
  const start = { x: mouth.x, y: mouth.y + 10 }
  const end = { x: to.left + Math.min(to.width, 280) / 2, y: to.top + to.height / 2 }
  const ball = makeBall(color, start.x, start.y)
  wobble(el)
  playSound('crumple')
  const full = level === 'full'
  const t = full ? flightTime(start, end) : 0.25
  const fly = ball.animate(full ? arc(start, end, t, -480) : [{ transform: 'translate(0,0)' }, { transform: `translate(${end.x - start.x}px, ${end.y - start.y}px)` }], {
    duration: t * 1000,
    easing: full ? 'linear' : 'ease-out',
    fill: 'forwards',
  })
  hideBasketSoon(900)
  fly.onfinish = () => {
    ball.remove()
    // the paper opens back out over the restored row, then gets out of the way
    const sheet = document.createElement('div')
    sheet.setAttribute('aria-hidden', 'true')
    Object.assign(sheet.style, {
      position: 'fixed',
      left: `${to.left}px`,
      top: `${to.top}px`,
      width: `${Math.min(to.width, 280)}px`,
      height: `${to.height}px`,
      background: color,
      borderRadius: '4px',
      zIndex: '71',
      pointerEvents: 'none',
      backgroundImage: 'linear-gradient(115deg, rgb(0 0 0 / 0.08) 0 12%, transparent 12% 30%, rgb(255 255 255 / 0.2) 30% 34%, transparent 34% 62%, rgb(0 0 0 / 0.07) 62% 66%, transparent 66%)',
    } satisfies Partial<CSSStyleDeclaration>)
    document.body.appendChild(sheet)
    const open = sheet.animate(
      [
        { transform: `scale(${BALL / Math.min(to.width, 280)}, ${BALL / to.height}) rotate(14deg)`, borderRadius: '50%', opacity: 1 },
        { transform: 'scale(0.7, 0.9) rotate(-4deg)', borderRadius: '20%', opacity: 1, offset: 0.5 },
        { transform: 'scale(1) rotate(0deg)', borderRadius: '4px', opacity: 0 },
      ],
      { duration: full ? 380 : 180, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' },
    )
    open.onfinish = () => sheet.remove()
  }
}

/** Remember tossed tasks by their undo entry, so any way of undoing it can bring the ball back. */
const tossed = new WeakMap<object, { taskId: string; color: string }>()

export function rememberToss(entry: object, taskId: string, color: string) {
  tossed.set(entry, { taskId, color })
}

export function untossIfTossed(entry: object | null | undefined, level: MotionLevel) {
  const info = entry && tossed.get(entry)
  if (!info) return
  tossed.delete(entry)
  // wait for the restored row to render
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-task-id="${info.taskId}"]`)
      if (row) untossTo(row.getBoundingClientRect(), info.color, level)
    }),
  )
}
