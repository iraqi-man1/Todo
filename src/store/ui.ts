import { create } from 'zustand'
import { isValidKey } from '@/lib/dates'
import type { DateKey } from '@/domain/types'

export type RouteName = 'today' | 'wall' | 'calendar' | 'stats' | 'settings'
export interface Route {
  name: RouteName
  /** Planner date when browsing a day other than today. */
  date?: DateKey
}

export type WallView = 'day' | 'week' | 'month' | 'year'
export type WallFilter = 'all' | 'complete' | 'incomplete'

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, arg] = parts
  if (head === 'day' && isValidKey(arg)) return { name: 'today', date: arg }
  if (head === 'wall' || head === 'calendar' || head === 'stats' || head === 'settings') return { name: head }
  return { name: 'today' }
}

export function routeToHash(r: Route): string {
  if (r.name === 'today' && r.date) return `#/day/${r.date}`
  return `#/${r.name}`
}

export interface EditorState {
  date: DateKey
  taskId?: string
  noteId?: string
  /** Prefilled title when promoting a quick-add into the full editor. */
  title?: string
}

export interface InspectState {
  date: DateKey
  /** Screen rect of the note that was tapped, for the lift-off animation. */
  origin?: { x: number; y: number; width: number; height: number; rotate: number }
}

interface UIState {
  route: Route
  navigate: (r: Route) => void
  setRouteFromHash: () => void

  wallView: WallView
  wallAnchor: DateKey | null
  wallFilter: WallFilter
  setWall: (p: Partial<Pick<UIState, 'wallView' | 'wallAnchor' | 'wallFilter'>>) => void
  /** Ask the wall to centre a date's note (e.g. "go to today"). `tick` makes repeats re-trigger. */
  wallFocus: { date: DateKey; tick: number } | null
  requestWallFocus: (date: DateKey) => void

  /** Date whose note was just pinned; the wall plays the attach animation for it once. */
  justPinned: DateKey | null
  setJustPinned: (d: DateKey | null) => void

  editor: EditorState | null
  openEditor: (e: EditorState) => void
  closeEditor: () => void

  inspect: InspectState | null
  setInspect: (i: InspectState | null) => void

  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean) => void
  searchOpen: boolean
  setSearchOpen: (v: boolean) => void
  sidebarCollapsed: boolean
  hideCompleted: boolean
  setHideCompleted: (v: boolean) => void
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
  toggleSidebar: () => void
}

const initialRoute = typeof window !== 'undefined' ? parseHash(window.location.hash) : { name: 'today' as const }

export const useUI = create<UIState>((set) => ({
  route: initialRoute,
  navigate: (route) => {
    const hash = routeToHash(route)
    if (window.location.hash !== hash) window.location.hash = hash
    set({ route })
  },
  setRouteFromHash: () => set({ route: parseHash(window.location.hash) }),

  wallView: readChoice('dw-wall-view', ['day', 'week', 'month', 'year'] as const, 'month'),
  wallAnchor: null,
  wallFilter: readChoice('dw-wall-filter', ['all', 'complete', 'incomplete'] as const, 'all'),
  setWall: (p) => {
    if (p.wallView) writeChoice('dw-wall-view', p.wallView)
    if (p.wallFilter) writeChoice('dw-wall-filter', p.wallFilter)
    set(p)
  },
  wallFocus: null,
  requestWallFocus: (date) => set((s) => ({ wallFocus: { date, tick: (s.wallFocus?.tick ?? 0) + 1 } })),

  justPinned: null,
  setJustPinned: (justPinned) => set({ justPinned }),

  editor: null,
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),

  inspect: null,
  setInspect: (inspect) => set({ inspect }),

  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  sidebarCollapsed: readCollapsed(),
  hideCompleted: readFlag('dw-hide-done'),
  setHideCompleted: (hideCompleted) => {
    writeFlag('dw-hide-done', hideCompleted)
    set({ hideCompleted })
  },
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  toggleSidebar: () =>
    set((s) => {
      try {
        localStorage.setItem('dw-sidebar', s.sidebarCollapsed ? '0' : '1')
      } catch {
        /* storage unavailable */
      }
      return { sidebarCollapsed: !s.sidebarCollapsed }
    }),
}))

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('dw-sidebar') === '1'
  } catch {
    return false
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

function readChoice<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && options.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function writeChoice(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* storage unavailable */
  }
}
