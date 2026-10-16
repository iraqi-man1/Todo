import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('absolute top-1/2 block size-3 -translate-y-1/2 rounded-full', className)}
      style={{
        background: 'radial-gradient(circle at 35% 30%, #F4DFAE, #B48A45 55%, #6E4F22)',
        boxShadow: 'inset 0 0 0 0.5px rgb(0 0 0 / 0.35), 0 1px 1px rgb(0 0 0 / 0.35)',
      }}
    >
      <span className="absolute top-1/2 left-[15%] h-px w-[70%] -translate-y-1/2 rotate-[35deg] bg-black/45" />
    </span>
  )
}

/** A small engraved walnut plaque, screwed to the board. */
export function WoodenMonthPlaque({
  title,
  subtitle,
  size = 'lg',
  className,
}: {
  title: string
  subtitle?: string
  size?: 'sm' | 'lg'
  className?: string
}) {
  const lg = size === 'lg'
  return (
    <div
      className={cn(
        'relative mx-auto w-fit rounded-[10px] text-center',
        lg ? 'min-w-[340px] px-14 pt-4 pb-3.5' : 'min-w-[180px] px-8 pt-2 pb-1.5',
        className,
      )}
      style={{
        backgroundColor: '#6A4428',
        backgroundImage: 'linear-gradient(180deg, rgb(255 230 190 / 0.18), rgb(0 0 0 / 0.12)), linear-gradient(rgb(70 40 18 / 0.55), rgb(70 40 18 / 0.55)), var(--wood-texture)',
        backgroundSize: '100% 100%, 100% 100%, 600px 600px',
        boxShadow:
          'inset 0 1px 0 rgb(255 225 180 / 0.35), inset 0 -2px 3px rgb(0 0 0 / 0.35), 0 2px 3px rgb(0 0 0 / 0.3), 0 10px 20px -8px rgb(30 15 5 / 0.6)',
      }}
    >
      <Screw className={lg ? 'left-4' : 'left-2.5'} />
      <Screw className={lg ? 'right-4' : 'right-2.5'} />
      <p
        className={cn('font-semibold tracking-[0.28em] uppercase', lg ? 'text-[30px]' : 'text-[17px]')}
        style={{ color: '#F3DDB8', textShadow: '0 -1px 0 rgb(0 0 0 / 0.55), 0 1px 0 rgb(255 230 190 / 0.18)' }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={title}
            className="inline-block"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {title}
          </motion.span>
        </AnimatePresence>
      </p>
      {subtitle && (
        <p className={cn('mt-0.5 font-medium tracking-wider', lg ? 'text-[15px]' : 'text-[12px]')} style={{ color: 'rgb(243 221 184 / 0.75)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
