import { create } from 'zustand'
import { savePrefs } from '@/domain/actions'
import { DEFAULT_PREFS, type Prefs } from '@/domain/types'

interface PrefsState {
  prefs: Prefs
  ready: boolean
  hydrate: (p: Prefs) => void
  update: (patch: Partial<Omit<Prefs, 'id'>>) => void
}

/** In-memory mirror of the persisted preferences; writes go through immediately. */
export const usePrefs = create<PrefsState>((set, get) => ({
  prefs: DEFAULT_PREFS,
  ready: false,
  hydrate: (prefs) => set({ prefs, ready: true }),
  update: (patch) => {
    set({ prefs: { ...get().prefs, ...patch } })
    void savePrefs(patch).catch((e) => console.error('Failed to save preferences', e))
  },
}))
