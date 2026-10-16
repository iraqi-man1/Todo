/** DoneWall's mark: a DONE stamp pressed onto paper (the small-size drawing of design/icons/icon.svg). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="dw-logo-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7F0E3" />
          <stop offset="1" stopColor="#EADFC9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#dw-logo-paper)" />
      <g transform="rotate(-13 32 32)" fill="none" stroke="#2D6A4F">
        <circle cx="32" cy="32" r="24.5" strokeWidth="3.6" strokeDasharray="60 2 38 3 52 2" />
        <circle cx="32" cy="32" r="17.5" strokeWidth="1.8" />
        <path d="M24.2 32.6 C25.9 34.1 27.6 35.9 29.6 38 C32.4 33.3 35.9 29.1 39.8 25.4" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}
