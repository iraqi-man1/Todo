import { useMedia } from '@/hooks/useMedia'
import { useRef } from 'react'
import { toast } from 'sonner'
import { WallpaperImage } from '@/components/wallpaper/WallpaperImage'
import type { Wallpaper } from '@/domain/types'
import { useEffects, useMotionLevel } from '@/hooks/useMotionLevel'
import { useParallax } from '@/hooks/useParallax'
import { useActiveWallpapers } from '@/hooks/useWallpapers'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePrefs } from '@/store/prefs'
import { NightWindow } from './NightWindow'

export const WINDOW_W = 'clamp(260px, 26vw, 440px)'

export function useEnvironment() {
  const prefs = usePrefs((s) => s.prefs)
  const level = useMotionLevel()
  const fx = useEffects()
  const night = prefs.theme === 'night'
  return {
    night,
    windowShown: night && prefs.showWindow,
    animate: night && prefs.ambient && !prefs.focusMode && level === 'full',
    parallax: fx.parallax && !prefs.focusMode,
  }
}

/** A small brass desk lamp on the window sill, its head turned toward the notes. */
function DeskLamp() {
  return (
    <svg viewBox="0 0 140 170" className="absolute -bottom-4 z-10 h-[150px] w-[124px] rtl:-scale-x-100" style={{ insetInlineStart: -36 }} aria-hidden>
      <defs>
        <linearGradient id="dw-brass" x1="0" x2="1">
          <stop offset="0" stopColor="#6B4A24" />
          <stop offset="0.5" stopColor="#C89A55" />
          <stop offset="1" stopColor="#5A3C1C" />
        </linearGradient>
        <radialGradient id="dw-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE9C2" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#F2B96E" stopOpacity="0.45" />
          <stop offset="1" stopColor="#E8AD67" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="88" cy="164" rx="26" ry="5" fill="#000" opacity="0.45" />
      <path d="M66 160 q22 -10 44 0 v4 h-44z" fill="url(#dw-brass)" />
      <path d="M88 158 L104 96 L62 52" fill="none" stroke="url(#dw-brass)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="96" r="4" fill="#C89A55" />
      <circle cx="62" cy="52" r="4" fill="#C89A55" />
      <g transform="rotate(-38 54 58)">
        <path d="M34 50 h40 l10 26 h-60z" fill="url(#dw-brass)" />
        <ellipse cx="54" cy="76" rx="30" ry="6" fill="#FFE2B0" opacity="0.95" />
      </g>
      <circle cx="40" cy="88" r="30" fill="url(#dw-glow)" style={{ opacity: 'calc(0.4 + var(--lamp, 0.7) * 0.6)' }} />
    </svg>
  )
}

/** A custom photo behind the whole workspace, with optional gentle parallax. Works in every theme. */
export function WorkspaceWallpaper({ wallpaper, parallax }: { wallpaper: Wallpaper; parallax: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { d } = useI18n()
  useParallax(ref, parallax)
  return (
    <div ref={ref} aria-hidden className="absolute inset-0">
      <WallpaperImage
        wallpaper={wallpaper}
        settings={wallpaper}
        parallaxDepth={16}
        onError={() => {
          usePrefs.getState().update({ wallpaperWorkspace: null })
          toast.error(d.wallpaper.corrupt)
        }}
      />
    </div>
  )
}

/**
 * The room behind the app: a deep navy wall, the warm lamp, and the rainy window. Fixed, decorative,
 * and pointer-transparent; cards and notes sit on top of it.
 */
export function Environment() {
  const prefs = usePrefs((s) => s.prefs)
  const { night, windowShown, animate, parallax } = useEnvironment()
  const lg = useMedia('(min-width: 1024px)')
  const walls = useActiveWallpapers()
  if (!night) {
    // Other themes keep their flat background unless the user picked a workspace wallpaper.
    return walls.workspace ? (
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <WorkspaceWallpaper wallpaper={walls.workspace} parallax={parallax} />
      </div>
    ) : null
  }
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ ['--lamp' as string]: prefs.lamp }}>
      {/* painted wall, or the user's own wallpaper */}
      {walls.workspace ? (
        <WorkspaceWallpaper wallpaper={walls.workspace} parallax={parallax} />
      ) : (
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#121B2B',
          backgroundImage: 'linear-gradient(180deg, #152034 0%, #101827 60%, #0C1320 100%), var(--paper-noise)',
          backgroundSize: '100% 100%, 220px 220px',
          backgroundBlendMode: 'normal, soft-light',
        }}
      />
      )}
      {/* cool moonlight spilling from the window */}
      {windowShown && (
        <div
          className="absolute inset-0 hidden lg:block"
          style={{ background: `radial-gradient(ellipse 45% 70% at calc(100% - ${WINDOW_W} / 2 - 3vw) 50%, rgb(120 150 200 / 0.12), transparent 70%)` }}
        />
      )}
      {/* warm lamp pool */}
      <div
        className={cn('absolute inset-0', animate && 'dw-lamp-breathe')}
        style={{
          opacity: 'var(--lamp)',
          background:
            lg
                ? `radial-gradient(ellipse 60% 75% at calc(100% - ${WINDOW_W} - 5vw) 80%, rgb(232 173 103 / 0.30), rgb(232 173 103 / 0.10) 45%, transparent 75%), radial-gradient(ellipse 40% 50% at 40% 30%, rgb(232 173 103 / 0.10), transparent 70%)`
                : 'radial-gradient(ellipse 80% 45% at 50% 30%, rgb(232 173 103 / 0.22), rgb(232 173 103 / 0.08) 50%, transparent 80%)',
        }}
      />

      {windowShown && lg && (
        <>
          {/* desktop: a tall window beside the content */}
          <div className="absolute top-[7vh] h-[80vh]" style={{ insetInlineEnd: '3vw', width: WINDOW_W }}>
            <NightWindow rain={prefs.rain} intensity={prefs.rainIntensity} animate={animate} parallax={parallax} scenery={walls.window} className="h-full w-full" />
            <DeskLamp />
            {/* sill */}
            <div
              className="absolute -inset-x-4 -bottom-4 h-5 rounded-[3px]"
              style={{
                backgroundColor: '#5A3D27',
                backgroundImage: 'linear-gradient(180deg, rgb(255 220 170 / 0.2), rgb(0 0 0 / 0.3)), var(--wood-texture)',
                backgroundSize: '100% 100%, 600px 600px',
                boxShadow: '0 12px 24px -6px rgb(0 0 0 / 0.6)',
              }}
            />
          </div>
        </>
      )}
      {/* mobile/tablet: the window as an atmospheric band behind the top of the page */}
      {windowShown && !lg && (
          <div className="absolute inset-x-0 top-0 h-[42vh]" style={{ maskImage: 'linear-gradient(180deg, #000 35%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, #000 35%, transparent)' }}>
            <NightWindow rain={prefs.rain} intensity={prefs.rainIntensity * 0.7} animate={animate} scenery={walls.window} framed={false} className="h-full w-full opacity-70" />
          </div>
      )}
    </div>
  )
}
