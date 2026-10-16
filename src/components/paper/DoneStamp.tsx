import { cn } from '@/lib/utils'

/** Circular ink stamp. `ink` defaults to a faded green; the slight roughness comes from a dash pattern. */
export function DoneStamp({
  label = 'DONE',
  sub,
  size = 56,
  ink = '#3F7A4C',
  rotate = -12,
  className,
  onPaper = true,
}: {
  label?: string
  sub?: string
  size?: number
  ink?: string
  rotate?: number
  className?: string
  /** Ink soaks into paper (multiply); on dark UI surfaces draw it plainly so it stays visible. */
  onPaper?: boolean
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('pointer-events-none select-none', className)}
      style={{ transform: `rotate(${rotate}deg)`, color: ink, opacity: onPaper ? 0.82 : 0.95, mixBlendMode: onPaper ? 'multiply' : 'normal' }}
    >
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="60 3 30 2 80 4" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M30 52 l12 12 l26 -28" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <text x="50" y="27" textAnchor="middle" fontSize={label.length > 6 ? 8.5 : 11} fontWeight="800" letterSpacing={label.length > 6 ? 0.8 : 2.5} fill="currentColor" fontFamily="Inter Variable, sans-serif">
        {label}
      </text>
      {sub && (
        <text x="50" y="84" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="currentColor" fontFamily="Inter Variable, sans-serif">
          {sub}
        </text>
      )}
    </svg>
  )
}
