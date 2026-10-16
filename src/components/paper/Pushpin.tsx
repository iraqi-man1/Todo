import type { PinStyle } from '@/domain/types'
import { cn } from '@/lib/utils'

const ROUND: Partial<Record<PinStyle, [string, string]>> = {
  red: ['#E86A5C', '#A8352B'],
  brass: ['#E9C77B', '#9C7432'],
  walnut: ['#9A6B47', '#4F3220'],
  sage: ['#93B38A', '#4E6E46'],
  gold: ['#FFE08A', '#B8860B'],
  copper: ['#F0A07A', '#8A4526'],
}
export type PinColor = PinStyle

/**
 * A push pin sitting above the paper, lit from the upper left, with its shadow falling down-right onto
 * the note. Round pins are glossy domes; the collection adds crystal, star and heart heads.
 */
export function Pushpin({ color = 'red', size = 18, className }: { color?: PinStyle; size?: number; className?: string }) {
  const shadow = (
    <span
      className="absolute rounded-full"
      style={{
        width: size * 0.9,
        height: size * 0.5,
        left: size * 0.35,
        top: size * 0.62,
        background: 'rgb(30 15 5 / 0.38)',
        filter: `blur(${size * 0.12}px)`,
        transform: 'rotate(28deg)',
      }}
    />
  )
  const round = ROUND[color]
  return (
    <span aria-hidden className={cn('pointer-events-none absolute block', className)} style={{ width: size, height: size }}>
      {shadow}
      {round ? (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 34% 30%, rgb(255 255 255 / 0.85) 0 9%, ${round[0]} 30%, ${round[1]} 88%)`,
            boxShadow: 'inset -1px -2px 3px rgb(0 0 0 / 0.25), 0 1px 1px rgb(0 0 0 / 0.3)',
          }}
        />
      ) : color === 'crystal' ? (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.95) 0 10%, rgb(200 230 255 / 0.55) 28%, rgb(120 170 220 / 0.45) 70%, rgb(70 110 170 / 0.6) 100%)',
            boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.5), inset -1px -2px 3px rgb(30 60 110 / 0.35), 0 1px 1px rgb(0 0 0 / 0.25)',
            backdropFilter: 'blur(1px)',
          }}
        />
      ) : (
        <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]">
          <defs>
            <radialGradient id={`pin-${color}`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor={color === 'star' ? '#FFF3C4' : '#FFD1DA'} />
              <stop offset="0.45" stopColor={color === 'star' ? '#F2C14E' : '#E8546E'} />
              <stop offset="1" stopColor={color === 'star' ? '#9C6A12' : '#9C1F38'} />
            </radialGradient>
          </defs>
          {color === 'star' ? (
            <path d="M12 1.8l2.9 6.2 6.7.7-5 4.6 1.4 6.6L12 16.6 6 19.9l1.4-6.6-5-4.6 6.7-.7z" fill={`url(#pin-${color})`} stroke="rgb(90 60 10 / 0.5)" strokeWidth="0.6" />
          ) : (
            <path d="M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.5 2.8C20.5 15.7 12 21 12 21z" fill={`url(#pin-${color})`} stroke="rgb(90 10 25 / 0.45)" strokeWidth="0.6" />
          )}
          <ellipse cx="9" cy="8.5" rx="2.2" ry="1.4" fill="#fff" opacity="0.6" />
        </svg>
      )}
    </span>
  )
}
