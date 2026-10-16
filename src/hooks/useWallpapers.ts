import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { db } from '@/db/db'
import type { Wallpaper } from '@/domain/types'
import { useI18n } from '@/lib/i18n'
import { usePrefs } from '@/store/prefs'

/** The wallpapers currently in use. If a saved choice no longer exists, quietly fall back to the original. */
export function useActiveWallpapers(): { workspace: Wallpaper | null; window: Wallpaper | null } {
  const ws = usePrefs((s) => s.prefs.wallpaperWorkspace)
  const win = usePrefs((s) => s.prefs.wallpaperWindow)
  const ready = usePrefs((s) => s.ready)
  const { d } = useI18n()
  const data = useLiveQuery(async () => {
    const [a, b] = await Promise.all([ws ? db.wallpapers.get(ws) : undefined, win ? db.wallpapers.get(win) : undefined])
    return { ws, win, a: a ?? null, b: b ?? null }
  }, [ws, win])
  const warned = useRef(false)
  useEffect(() => {
    if (!ready || !data || data.ws !== ws || data.win !== win) return
    const patch: Record<string, null> = {}
    if (ws && !data.a) patch.wallpaperWorkspace = null
    if (win && !data.b) patch.wallpaperWindow = null
    if (Object.keys(patch).length) {
      usePrefs.getState().update(patch)
      if (!warned.current) toast(d.wallpaper.missing)
      warned.current = true
    }
  }, [data, ws, win, ready, d])
  const fresh = data && data.ws === ws && data.win === win
  return { workspace: fresh ? data.a : null, window: fresh ? data.b : null }
}

export function useAllWallpapers(): Wallpaper[] {
  return useLiveQuery(() => db.wallpapers.orderBy('createdAt').toArray(), []) ?? []
}
