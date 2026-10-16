import { useLiveQuery } from 'dexie-react-hooks'
import { Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Logo } from '@/components/layout/Logo'
import { Tip } from '@/components/ui/tooltip'
import { db } from '@/db/db'
import { percent } from '@/domain/summary'
import { useToday } from '@/hooks/useToday'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'
import { NAV_ITEMS } from './navItems'
import { SaveIndicator } from './SaveIndicator'

const fade = { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -4 }, transition: { duration: 0.16 } }

/** Today's progress at a glance; one click opens today's note from anywhere. */
function TodayCard({ collapsed }: { collapsed: boolean }) {
  const { d, f, date } = useI18n()
  const today = useToday()
  const navigate = useUI((s) => s.navigate)
  const route = useUI((s) => s.route)
  const stats = useLiveQuery(async () => {
    const [tasks, pinned] = await Promise.all([db.tasks.where('date').equals(today).toArray(), db.archives.where('date').equals(today).count()])
    return { total: tasks.length, done: tasks.filter((t) => t.completed).length, pinned: pinned > 0 }
  }, [today])
  const pct = percent(stats?.done ?? 0, stats?.total ?? 0)
  const R = 13
  const C = 2 * Math.PI * R
  const active = route.name === 'today' && !route.date
  const label = stats?.total ? f(stats.total === 1 ? d.today.progressOne : d.today.progress, { done: stats.done, total: stats.total, pct }) : d.today.noTasks
  const ring = (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0 -rotate-90" aria-hidden>
      <circle cx="16" cy="16" r={R} fill="none" stroke="var(--dw-line)" strokeWidth="3.5" />
      <motion.circle
        cx="16"
        cy="16"
        r={R}
        fill="none"
        stroke={pct === 100 ? 'var(--dw-success)' : 'var(--dw-accent)'}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={C}
        initial={false}
        animate={{ strokeDashoffset: C * (1 - pct / 100) }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
      />
    </svg>
  )
  const button = (
    <button
      type="button"
      onClick={() => navigate({ name: 'today' })}
      aria-label={`${d.shortcuts.today}: ${label}`}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl border text-start transition-colors',
        collapsed ? 'justify-center border-transparent p-1.5' : 'p-2.5 pe-3',
        !collapsed && (active ? 'border-accent/30 bg-accent/10' : 'border-line bg-surface-2/50 hover:bg-surface-2'),
      )}
    >
      {ring}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span {...fade} className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">{date(today, 'weekday')}</span>
            <span className="block truncate text-xs text-ink-soft tabular-nums">
              {stats?.pinned ? d.celebrate.pinned : stats?.total ? f(d.today.progressShort, { done: stats.done, total: stats.total }) : d.today.noTasks}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
  return collapsed ? (
    <Tip label={`${d.shortcuts.today} · ${label}`} side="right" shortcut="T">
      {button}
    </Tip>
  ) : (
    button
  )
}

export function DesktopSidebar() {
  const { d } = useI18n()
  const route = useUI((s) => s.route)
  const navigate = useUI((s) => s.navigate)
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const toggle = useUI((s) => s.toggleSidebar)
  const setPaletteOpen = useUI((s) => s.setPaletteOpen)
  const focus = usePrefs((s) => s.prefs.focusMode)
  const update = usePrefs((s) => s.update)

  const footerBtn = cn(
    'flex h-10 w-full items-center gap-3 rounded-xl text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink',
    collapsed ? 'justify-center' : 'px-3',
  )
  const withTip = (label: string, el: React.ReactElement, shortcut?: string) =>
    collapsed ? (
      <Tip label={label} side="right" shortcut={shortcut}>
        {el}
      </Tip>
    ) : (
      el
    )

  return (
    <motion.aside
      data-dim
      initial={false}
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="sticky top-0 z-10 hidden h-dvh shrink-0 flex-col overflow-hidden border-e border-line bg-surface/60 px-3 py-5 md:flex"
    >
      <div className={cn('mb-6 flex h-9 items-center gap-2.5', collapsed ? 'justify-center' : 'px-2')}>
        <Logo className="size-9 shrink-0" />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span {...fade} className="text-[17px] font-semibold tracking-tight whitespace-nowrap">
              {d.appName}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <TodayCard collapsed={collapsed} />

      <nav aria-label={d.nav.main} className="mt-6 flex-1">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ name, icon: Icon, key }) => {
            const active = route.name === name
            return (
              <li key={name}>
                {withTip(
                  d.nav[name],
                  <button
                    type="button"
                    data-nav={name}
                    onClick={() => navigate({ name })}
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? d.nav[name] : undefined}
                    aria-keyshortcuts={key}
                    className={cn(
                      'relative flex h-11 w-full items-center gap-3 rounded-xl text-[14px] font-medium transition-colors duration-150',
                      collapsed ? 'justify-center' : 'px-3',
                      active ? 'text-ink' : 'text-ink-soft hover:bg-surface-2/70 hover:text-ink',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="side-nav-pill"
                        className="absolute inset-0 rounded-xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--dw-line)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      >
                        <span className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-accent" />
                      </motion.span>
                    )}
                    <Icon className={cn('relative size-5 shrink-0 transition-colors', active && 'text-accent')} strokeWidth={active ? 2.1 : 1.8} />
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span {...fade} className="relative flex flex-1 items-center justify-between gap-2 whitespace-nowrap">
                          {d.nav[name]}
                          <kbd className="rounded-md border border-line px-1.5 text-[11px] font-normal text-ink-soft/80">{key}</kbd>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>,
                  key,
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-line pt-3">
        {withTip(
          d.palette.open,
          <button type="button" onClick={() => setPaletteOpen(true)} className={footerBtn} aria-label={collapsed ? d.palette.open : undefined}>
            <Search className="size-[18px] shrink-0" />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between whitespace-nowrap">
                {d.palette.open}
                <kbd className="rounded-md border border-line px-1.5 text-[11px] font-normal">Ctrl K</kbd>
              </span>
            )}
          </button>,
          'Ctrl K',
        )}
        {withTip(
          focus ? d.focus.exit : d.settings.focusMode,
          <button
            type="button"
            onClick={() => update({ focusMode: !focus })}
            aria-pressed={focus}
            className={cn(footerBtn, focus && 'text-accent')}
            aria-label={collapsed ? (focus ? d.focus.exit : d.settings.focusMode) : undefined}
          >
            {focus ? <Sun className="size-[18px] shrink-0" /> : <Moon className="size-[18px] shrink-0" />}
            {!collapsed && <span className="flex-1 text-start whitespace-nowrap">{focus ? d.focus.exit : d.settings.focusMode}</span>}
          </button>,
          'F',
        )}
        {withTip(
          collapsed ? d.nav.expand : d.nav.collapse,
          <button type="button" onClick={toggle} aria-label={collapsed ? d.nav.expand : d.nav.collapse} aria-expanded={!collapsed} className={footerBtn}>
            {collapsed ? <PanelLeftOpen className="size-[18px] shrink-0 rtl:-scale-x-100" /> : <PanelLeftClose className="size-[18px] shrink-0 rtl:-scale-x-100" />}
            {!collapsed && <span className="flex-1 text-start whitespace-nowrap">{d.nav.collapse}</span>}
          </button>,
        )}
        <SaveIndicator compact={collapsed} className={cn('mt-2 h-6', collapsed ? 'justify-center' : 'px-3')} />
      </div>
    </motion.aside>
  )
}
