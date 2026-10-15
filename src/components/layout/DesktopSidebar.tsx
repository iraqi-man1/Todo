import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { motion } from 'motion/react'
import { Logo } from '@/components/layout/Logo'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'
import { NAV_ITEMS } from './navItems'

export function DesktopSidebar() {
  const { d } = useI18n()
  const route = useUI((s) => s.route)
  const navigate = useUI((s) => s.navigate)
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const toggle = useUI((s) => s.toggleSidebar)
  return (
    <aside
      data-dim
      className={cn(
        'sticky top-0 z-10 hidden h-dvh shrink-0 flex-col border-e border-line bg-surface/60 py-5 transition-[width] duration-300 ease-[var(--ease-paper)] md:flex',
        collapsed ? 'w-[76px] px-3' : 'w-60 px-4',
      )}
    >
      <div className={cn('mb-8 flex items-center gap-2.5', collapsed ? 'justify-center' : 'px-2')}>
        <Logo className="size-9 shrink-0" />
        {!collapsed && <span className="text-[17px] font-semibold tracking-tight">{d.appName}</span>}
      </div>
      <nav aria-label={d.nav.main} className="flex-1">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ name, icon: Icon, key }) => {
            const active = route.name === name
            return (
              <li key={name}>
                <button
                  type="button"
                  data-nav={name}
                  onClick={() => navigate({ name })}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? d.nav[name] : undefined}
                  aria-label={collapsed ? d.nav[name] : undefined}
                  className={cn(
                    'relative flex h-11 w-full items-center gap-3 rounded-xl text-[14px] font-medium transition-colors',
                    collapsed ? 'justify-center' : 'px-3',
                    active ? 'text-ink' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="side-nav-pill"
                      className="absolute inset-0 rounded-xl bg-note-yellow/70 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)] dark:bg-accent/15"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon className="relative size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                  {!collapsed && (
                    <>
                      <span className="relative flex-1 text-start">{d.nav[name]}</span>
                      <kbd className="relative rounded-md border border-line px-1.5 text-[11px] text-ink-soft">{key}</kbd>
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? d.nav.expand : d.nav.collapse}
        className={cn('flex h-10 items-center gap-2 rounded-xl text-sm text-ink-soft hover:bg-surface-2 hover:text-ink', collapsed ? 'justify-center' : 'px-3')}
      >
        {collapsed ? <PanelLeftOpen className="size-5 rtl:-scale-x-100" /> : <PanelLeftClose className="size-5 rtl:-scale-x-100" />}
        {!collapsed && d.nav.collapse}
      </button>
    </aside>
  )
}
