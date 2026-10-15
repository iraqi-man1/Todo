import { cn } from '@/lib/utils'

/** The physical board: an oak panel inside a dark walnut frame, with soft light from the upper left. */
export function Board({ children, className, padding }: { children: React.ReactNode; className?: string; padding: number }) {
  return (
    <div
      className="wood-frame rounded-[14px] p-[14px]"
      style={{
        backgroundColor: '#4E321E',
        backgroundImage: 'linear-gradient(135deg, rgb(255 220 170 / 0.16), rgb(0 0 0 / 0.2)), linear-gradient(rgb(55 30 12 / 0.62), rgb(55 30 12 / 0.62)), var(--wood-texture)',
        backgroundSize: '100% 100%, 100% 100%, 900px 900px',
      }}
    >
      <div
        className={cn('wood relative overflow-hidden rounded-[6px]', className)}
        style={{ padding, boxShadow: 'inset 0 2px 6px rgb(0 0 0 / 0.45), inset 0 0 0 1px rgb(0 0 0 / 0.25)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 20% 4%, rgb(255 200 130 / calc(var(--lamp, 0) * 0.32)), transparent 70%), radial-gradient(ellipse 80% 60% at 22% 8%, rgb(255 236 200 / 0.22), transparent 65%), radial-gradient(ellipse at 50% 50%, transparent 50%, rgb(20 10 4 / calc(0.28 + var(--lamp, 0) * 0.25)) 100%)',
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}
