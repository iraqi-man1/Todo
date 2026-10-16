import { useEffect } from 'react'
import { NAV_ITEMS } from '@/components/layout/navItems'
import { redoWithToast, undoWithToast } from '@/lib/undoUi'
import { isTypingTarget } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { useUI } from '@/store/ui'
import { useToday } from './useToday'

/** Jump to today's note from anywhere: the planner, or today's slot on the wall. */
export function goToToday(today: string) {
  const ui = useUI.getState()
  if (ui.route.name === 'wall') {
    ui.setWall({ wallAnchor: null, wallView: ui.wallView === 'year' || ui.wallView === 'goals' ? 'month' : ui.wallView })
    ui.requestWallFocus(today)
  } else ui.navigate({ name: 'today' })
}

/** Global keyboard shortcuts. Single keys are ignored while typing or when a dialog is open. */
export function useShortcuts() {
  const today = useToday()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const ui = useUI.getState()
      const mod = e.metaKey || e.ctrlKey
      const typing = isTypingTarget(e.target)
      const dialog = !!document.querySelector('[role="dialog"]')

      if (mod && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.setPaletteOpen(!ui.paletteOpen)
        return
      }
      // Text fields keep their native undo.
      if (mod && !e.altKey && !typing && !dialog) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          void undoWithToast()
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault()
          void redoWithToast()
        }
        return
      }
      if (mod || e.altKey || typing || dialog) return

      const nav = NAV_ITEMS.find((n) => n.key === e.key)
      if (nav) {
        e.preventDefault()
        ui.navigate({ name: nav.name })
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        const date = ui.route.name === 'today' ? (ui.route.date ?? today) : today
        if (ui.route.name !== 'today') ui.navigate({ name: 'today' })
        ui.openEditor({ date })
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        goToToday(today)
      } else if (e.key === '/') {
        e.preventDefault()
        if (ui.route.name !== 'wall') ui.navigate({ name: 'wall' })
        ui.setSearchOpen(true)
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        const p = usePrefs.getState()
        p.update({ focusMode: !p.prefs.focusMode })
      } else if (e.key === '?') {
        e.preventDefault()
        ui.setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [today])
}
