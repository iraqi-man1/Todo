import { useEffect } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

/**
 * Registers the service worker. Updates never apply silently: the user chooses when to reload, and
 * since all data lives in IndexedDB (not the cache), updating can never touch it.
 */
export function PwaPrompt() {
  const { d } = useI18n()
  useEffect(() => {
    // the Windows app ships its files locally, so it needs no service worker or update prompt
    if (import.meta.env.DEV || !('serviceWorker' in navigator) || navigator.userAgent.includes('Electron')) return
    let cancelled = false
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return
      const update = registerSW({
        onNeedRefresh() {
          toast(d.pwa.update, { duration: Infinity, action: { label: d.pwa.reload, onClick: () => void update(true) } })
        },
        onOfflineReady() {
          toast(d.pwa.offline)
        },
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
