export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="#C99B6B" />
      <path d="M0 22h64M0 43h64" stroke="#A97C50" strokeWidth="1.2" opacity="0.7" />
      <g transform="rotate(-6 32 34)">
        <rect x="15" y="15" width="34" height="34" rx="2" fill="#FFF0A8" />
        <path d="M15 15h34v6H15z" fill="#000" opacity="0.04" />
        <path d="M22.5 33.5l6 6 13-14" fill="none" stroke="#302C28" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="32" cy="15.5" r="4" fill="#C4553F" />
      <circle cx="30.8" cy="14.3" r="1.2" fill="#fff" opacity="0.7" />
    </svg>
  )
}
