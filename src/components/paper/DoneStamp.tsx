import type { StampStyle } from '@/domain/types'
import { cn } from '@/lib/utils'

const INK: Record<StampStyle, string> = {
  classic: '#3F7A4C',
  star: '#9A6A16',
  laurel: '#3F6E5A',
  heart: '#A8344E',
  moon: '#3D4F8C',
}

/** Leaves of a laurel wreath along one side of the ring. */
function Laurel({ side }: { side: 1 | -1 }) {
  const leaves = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * (0.62 + i * 0.1)) * side
    const x = 50 + Math.sin(a) * 41
    const y = 50 + Math.cos(a) * 41
    const deg = (-a * 180) / Math.PI + (side === 1 ? 60 : -60)
    return <ellipse key={i} cx={x} cy={y} rx="5.5" ry="2.4" transform={`rotate(${deg} ${x} ${y})`} fill="currentColor" />
  })
  return <g opacity="0.9">{leaves}</g>
}

/**
 * An ink stamp. `variant` comes from the user's collection (classic ring, star, laurel wreath, heart or
 * moon); the label is always readable and the roughness comes from a dash pattern, not an image.
 */
export function DoneStamp({
  label = 'DONE',
  sub,
  size = 56,
  ink,
  rotate = -12,
  className,
  onPaper = true,
  variant = 'classic',
}: {
  label?: string
  sub?: string
  size?: number
  ink?: string
  rotate?: number
  className?: string
  /** Ink soaks into paper (multiply); on dark UI surfaces draw it plainly so it stays visible. */
  onPaper?: boolean
  variant?: StampStyle
}) {
  const color = ink ?? INK[variant]
  const small = label.length > 6
  const text = (
    <text
      x="50"
      y={variant === 'heart' ? 33 : 27}
      textAnchor="middle"
      fontSize={small ? 8.5 : 11}
      fontWeight="800"
      letterSpacing={small ? 0.8 : 2.5}
      fill="currentColor"
      fontFamily="Inter Variable, sans-serif"
    >
      {label}
    </text>
  )
  const check = <path d="M30 52 l12 12 l26 -28" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('pointer-events-none select-none', className)}
      style={{ transform: `rotate(${rotate}deg)`, color, opacity: onPaper ? 0.82 : 0.95, mixBlendMode: onPaper ? 'multiply' : 'normal' }}
    >
      {variant === 'heart' ? (
        <>
          <path d="M50 92 C18 70 6 52 6 34 A20 20 0 0 1 50 22 A20 20 0 0 1 94 34 C94 52 82 70 50 92Z" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="70 3 40 2 90 4" strokeLinejoin="round" />
          <path d="M34 54 l10 10 l22 -24" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          {text}
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth={variant === 'laurel' ? 2.2 : 5} strokeDasharray="60 3 30 2 80 4" />
          {variant !== 'laurel' && <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="1.6" />}
          {variant === 'laurel' && (
            <>
              <Laurel side={1} />
              <Laurel side={-1} />
            </>
          )}
          {variant === 'star' &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2 + Math.PI / 8
              const x = 50 + Math.cos(a) * 40.5
              const y = 50 + Math.sin(a) * 40.5
              return i === 6 || i === 5 ? null : <path key={i} d={starPath(x, y, 3.4)} fill="currentColor" />
            })}
          {variant === 'moon' ? (
            <>
              <path d="M58 30 a22 22 0 1 0 14 38 a18 18 0 1 1 -14 -38z" fill="currentColor" opacity="0.85" />
              <path d="M37 56 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            check
          )}
          {text}
        </>
      )}
      {sub && (
        <text x="50" y="84" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="currentColor" fontFamily="Inter Variable, sans-serif">
          {sub}
        </text>
      )}
    </svg>
  )
}

function starPath(cx: number, cy: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}
