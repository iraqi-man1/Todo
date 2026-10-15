import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { ArchivedNoteModal } from '@/components/wall/ArchivedNoteModal'
import { TaskEditor } from '@/components/today/TaskEditor'
import { TodayBoard } from '@/components/today/TodayBoard'
import { dur, useMotionLevel } from '@/hooks/useMotionLevel'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useI18n } from '@/lib/i18n'
import { useUI } from '@/store/ui'
import { Environment, useEnvironment, WINDOW_W } from '@/components/environment/Environment'
import { useMedia } from '@/hooks/useMedia'
import { BottomNavigation } from './BottomNavigation'
import { DesktopSidebar } from './DesktopSidebar'
import { ShortcutsDialog } from './ShortcutsDialog'

const WoodenWall = lazy(() => import('@/components/wall/WoodenWall').then((m) => ({ default: m.WoodenWall })))
const CalendarView = lazy(() => import('@/components/calendar/CalendarView').then((m) => ({ default: m.CalendarView })))
const StatisticsDashboard = lazy(() => import('@/components/stats/StatisticsDashboard').then((m) => ({ default: m.StatisticsDashboard })))
const SettingsPanel = lazy(() => import('@/components/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })))

export function AppShell() {
  const route = useUI((s) => s.route)
  const setRouteFromHash = useUI((s) => s.setRouteFromHash)
  const level = useMotionLevel()
  const { d } = useI18n()
  useShortcuts()
  const env = useEnvironment()
  const lg = useMedia('(min-width: 1024px)')
  const reserve = env.windowShown && lg

  useEffect(() => {
    window.addEventListener('hashchange', setRouteFromHash)
    return () => window.removeEventListener('hashchange', setRouteFromHash)
  }, [setRouteFromHash])

  useEffect(() => {
    const title = route.name === 'today' ? d.nav.today : d.nav[route.name]
    document.title = `${title} · ${d.appName}`
  }, [route.name, d])

  const pageKey = route.name === 'today' ? `today-${route.date ?? ''}` : route.name
  const isWall = route.name === 'wall'

  return (
    <div className="relative flex min-h-dvh">
      <Environment />
      <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {d.skip}
      </a>
      <DesktopSidebar />
      <main
        id="main"
        className={isWall ? 'relative z-10 h-dvh min-w-0 flex-1 overflow-hidden' : 'relative z-10 min-w-0 flex-1'}
        style={reserve ? { paddingInlineEnd: `calc(${WINDOW_W} + 5vw)` } : undefined}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={route.name === 'today' ? 'today' : pageKey}
            initial={level === 'off' ? false : { opacity: 0, y: level === 'full' ? 10 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={level === 'off' ? undefined : { opacity: 0, y: level === 'full' ? -6 : 0 }}
            transition={{ duration: dur(level, 0.22), ease: [0.22, 1, 0.36, 1] }}
            className={isWall ? 'h-full' : undefined}
          >
            <Suspense fallback={<div className="h-dvh" />}>
              {route.name === 'today' && <TodayBoard key={route.date ?? 'today'} date={route.date} />}
              {route.name === 'wall' && <WoodenWall />}
              {route.name === 'calendar' && <CalendarView />}
              {route.name === 'stats' && <StatisticsDashboard />}
              {route.name === 'settings' && <SettingsPanel />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNavigation />
      <TaskEditor />
      <ArchivedNoteModal />
      <ShortcutsDialog />
    </div>
  )
}
