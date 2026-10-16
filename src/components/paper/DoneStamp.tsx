import { useId, useMemo } from 'react'
import type { StampStyle } from '@/domain/types'
import { cn } from '@/lib/utils'

function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/**
 * What one particular press left on the paper: ink gaps (more when pressed lightly), one side
 * inkier than the other, and now and then a faint double strike where the stamp slipped.
 */
function useImprint(seed: string | undefined, pressure: number) {
  return useMemo(() => {
    if (!seed) return null
    const r = rng(seed)
    const gaps = Math.round(8 + (1 - pressure) * 34)
    const specks = Array.from({ length: gaps }, () => ({ x: r() * 100, y: r() * 100, r: 0.5 + r() * (1.2 + (1 - pressure) * 1.8) }))
    const angle = r() * 360
    const fade = 0.15 + (1 - pressure) * 0.5
    const slip = r() < 0.28 ? { x: (r() - 0.5) * 3, y: (r() - 0.5) * 3 } : null
    return { specks, angle, fade, slip }
  }, [seed, pressure])
}

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
  seed,
  pressure = 0.7,
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
  /** Makes this imprint unique (e.g. the date): ink gaps, uneven inking, an occasional slip. */
  seed?: string
  /** 0–1: a firmer press is darker, crisper and has fewer gaps. */
  pressure?: number
}) {
  const color = ink ?? INK[variant]
  const uid = useId().replace(/:/g, '')
  const imprint = useImprint(seed, pressure)
  const p = Math.max(0, Math.min(1, pressure))
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
      style={{
        transform: `rotate(${rotate}deg)`,
        color,
        opacity: onPaper ? (imprint ? 0.6 + p * 0.34 : 0.82) : 0.95,
        mixBlendMode: onPaper ? 'multiply' : 'normal',
      }}
    >
      {imprint && (
        <defs>
          <linearGradient id={`${uid}-ink`} gradientTransform={`rotate(${imprint.angle} 0.5 0.5)`}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity={1 - imprint.fade} />
          </linearGradient>
          <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill={`url(#${uid}-ink)`} />
            {imprint.specks.map((k, i) => (
              <circle key={i} cx={k.x} cy={k.y} r={k.r} fill="#000" />
            ))}
          </mask>
        </defs>
      )}
      {imprint?.slip && (
        <use href={`#${uid}-face`} x={imprint.slip.x} y={imprint.slip.y} opacity={0.18} />
      )}
      <g id={`${uid}-face`} mask={imprint ? `url(#${uid}-m)` : undefined}>
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
      </g>
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
