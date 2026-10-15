import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'
import { NAV_ITEMS } from './navItems'

export function BottomNavigation() {
  const { d } = useI18n()
  const route = useUI((s) => s.route)
  const navigate = useUI((s) => s.navigate)
  return (
    <nav
      data-dim
      aria-label={d.nav.main}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/90 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {NAV_ITEMS.map(({ name, icon: Icon }) => {
          const active = route.name === name
          return (
            <li key={name} className="flex-1">
              <button
                type="button"
                data-nav={name}
                onClick={() => navigate({ name })}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-ink' : 'text-ink-soft',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-pill"
                    className="absolute top-2 h-8 w-14 rounded-full bg-note-yellow/80 dark:bg-accent/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                <Icon className="relative size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                <span className="relative">{d.nav[name]}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
