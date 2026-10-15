import { useEffect } from 'react'
import { NAV_ITEMS } from '@/components/layout/navItems'
import { isTypingTarget } from '@/lib/utils'
import { useToday } from './useToday'
import { useUI } from '@/store/ui'

/** Global keyboard shortcuts. Ignored while typing or when a dialog is open. */
export function useShortcuts() {
  const today = useToday()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      const ui = useUI.getState()
      const nav = NAV_ITEMS.find((n) => n.key === e.key)
      if (nav) {
        e.preventDefault()
        ui.navigate({ name: nav.name })
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        const date = ui.route.name === 'today' ? (ui.route.date ?? today) : today
        if (ui.route.name !== 'today') ui.navigate({ name: 'today' })
        ui.openEditor({ date })
      } else if (e.key === '/') {
        e.preventDefault()
        if (ui.route.name !== 'wall') ui.navigate({ name: 'wall' })
        ui.setSearchOpen(true)
      } else if (e.key === '?') {
        e.preventDefault()
        ui.setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [today])
}
