import { cn } from '@/lib/utils'

const PIN_COLORS = {
  red: ['#E86A5C', '#A8352B'],
  brass: ['#E9C77B', '#9C7432'],
  walnut: ['#9A6B47', '#4F3220'],
  sage: ['#93B38A', '#4E6E46'],
} as const
export type PinColor = keyof typeof PIN_COLORS

/** A glossy push pin with a cast shadow that falls down-right, as if lit from the upper left. */
export function Pushpin({ color = 'red', size = 18, className }: { color?: PinColor; size?: number; className?: string }) {
  const [hi, lo] = PIN_COLORS[color]
  return (
    <span aria-hidden className={cn('pointer-events-none absolute block', className)} style={{ width: size, height: size }}>
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
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 34% 30%, rgb(255 255 255 / 0.85) 0 9%, ${hi} 30%, ${lo} 88%)`,
          boxShadow: `inset -1px -2px 3px rgb(0 0 0 / 0.25), 0 1px 1px rgb(0 0 0 / 0.3)`,
        }}
      />
    </span>
  )
}
