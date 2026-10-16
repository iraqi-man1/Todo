import { useEffect, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { PwaPrompt } from '@/components/layout/PwaPrompt'
import { TooltipProvider } from '@/components/ui/tooltip'
import { loadPrefs } from '@/domain/actions'
import { useAchievementWatcher } from '@/hooks/useAchievementWatcher'
import { useMotionLevel } from '@/hooks/useMotionLevel'
import { useReminders } from '@/hooks/useReminders'
import { useAmbientSound } from '@/hooks/useAmbientSound'
import { WOOD_PALETTES, paperNoise, woodTexture } from '@/lib/textures'
import { usePrefs } from '@/store/prefs'

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

/** Applies theme, language direction, motion level and generated textures to the document. */
function useDocumentPrefs() {
  const prefs = usePrefs((s) => s.prefs)
  const systemDark = useSystemDark()
  const level = useMotionLevel()
  const night = prefs.theme === 'night'
  const dark = night || prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.classList.toggle('night', night)
    root.style.setProperty('--lamp', night ? String(prefs.lamp) : '0')
    root.classList.toggle('focus-mode', prefs.focusMode)
    root.classList.toggle('still', !prefs.ambient || prefs.focusMode)
    root.lang = prefs.language
    root.dir = prefs.language === 'ar' ? 'rtl' : 'ltr'
    root.classList.toggle('motion-off', level === 'off')
    root.classList.toggle('motion-reduced', level === 'reduced')
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', night ? '#101827' : dark ? '#1C1814' : '#F8F5EF'))
  }, [dark, night, prefs.language, prefs.focusMode, prefs.ambient, prefs.lamp, level])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--wood-base', WOOD_PALETTES[prefs.wood].base)
    let cancelled = false
    // Generate after first paint so it never delays startup.
    const id = setTimeout(() => {
      void woodTexture(prefs.wood).then((url) => {
        if (!cancelled && url) root.style.setProperty('--wood-texture', `url(${url})`)
      })
    }, 30)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [prefs.wood])

  useEffect(() => {
    void paperNoise().then((url) => url && document.documentElement.style.setProperty('--paper-noise', `url(${url})`))
  }, [])

  return dark
}

export default function App() {
  const ready = usePrefs((s) => s.ready)
  const hydrate = usePrefs((s) => s.hydrate)
  useEffect(() => {
    loadPrefs().then(hydrate, () => hydrate(usePrefs.getState().prefs))
  }, [hydrate])
  const dark = useDocumentPrefs()
  const level = useMotionLevel()
  const rtl = usePrefs((s) => s.prefs.language === 'ar')
  useAchievementWatcher()
  useReminders()
  useAmbientSound()

  if (!ready) return null
  return (
    <MotionConfig reducedMotion={level === 'full' ? 'never' : 'always'}>
      <TooltipProvider delayDuration={450} skipDelayDuration={200}>
      <AppShell />
      <PwaPrompt />
      <Toaster
        position="top-center"
        theme={dark ? 'dark' : 'light'}
        dir={rtl ? 'rtl' : 'ltr'}
        offset={{ top: 'calc(12px + env(safe-area-inset-top))' }}
        mobileOffset={{ top: 'calc(12px + env(safe-area-inset-top))' }}
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border-line !bg-surface !text-ink !shadow-lift !font-sans',
            description: '!text-ink-soft',
            actionButton: '!bg-accent !text-accent-ink !rounded-lg',
          },
        }}
      />
      </TooltipProvider>
    </MotionConfig>
  )
}
