import { act, render, renderHook, waitFor } from '@testing-library/react'
import { db, resetDbForTests } from '@/db/db'
import { DEFAULT_PREFS, migratePrefs, type Prefs } from '@/domain/types'
import { useCompletionTransition } from '@/hooks/useCompletionTransition'
import { useEffects } from '@/hooks/useMotionLevel'
import { useActiveWallpapers } from '@/hooks/useWallpapers'
import { addWallpaper, DEFAULT_WALLPAPER_SETTINGS, deleteWallpaper, isAcceptedFile, type ProcessedImage } from '@/lib/wallpaper'
import { usePrefs } from '@/store/prefs'

describe('preference migration', () => {
  it('maps the old single motion setting onto intensity + reduced motion', () => {
    expect(migratePrefs({ motion: 'off' } as Partial<Prefs>)).toMatchObject({ intensity: 'off', reducedMotion: 'system' })
    expect(migratePrefs({ motion: 'full' } as Partial<Prefs>)).toMatchObject({ intensity: 'lively', reducedMotion: 'off' })
    expect(migratePrefs({ motion: 'reduced' } as Partial<Prefs>)).toMatchObject({ intensity: 'subtle' })
  })
  it('keeps new values once set and fills defaults', () => {
    expect(migratePrefs({ motion: 'off', intensity: 'lively' } as Partial<Prefs>).intensity).toBe('lively')
    expect(migratePrefs(undefined)).toMatchObject({ notePhysics: true, celebration: true, wallpaperWorkspace: null })
  })
})

describe('effect resolution', () => {
  const run = (p: Partial<Prefs>) => {
    usePrefs.setState({ prefs: { ...DEFAULT_PREFS, ...p }, ready: true })
    return renderHook(() => useEffects()).result.current
  }
  it('turns physics and parallax off under reduced motion, but keeps gentle completion effects', () => {
    const fx = run({ reducedMotion: 'on' })
    expect(fx).toMatchObject({ physics: false, parallax: false, completion: true, level: 'reduced' })
  })
  it('respects individual toggles and intensity', () => {
    expect(run({ intensity: 'off' })).toMatchObject({ physics: false, completion: false, celebration: false, level: 'off' })
    expect(run({ intensity: 'subtle' }).amp).toBe(0.5)
    expect(run({ celebration: false }).celebration).toBe(false)
  })
})

describe('end-of-day trigger', () => {
  it('fires only on an incomplete → complete transition for the same day', () => {
    const { result, rerender } = renderHook(({ k, c }) => useCompletionTransition(k, c), { initialProps: { k: 'd1', c: undefined as boolean | undefined } })
    rerender({ k: 'd1', c: true }) // opened an already-finished day
    expect(result.current).toBe(0)
    rerender({ k: 'd1', c: true }) // re-render
    expect(result.current).toBe(0)
    rerender({ k: 'd1', c: false })
    rerender({ k: 'd1', c: true }) // finished the last task
    expect(result.current).toBe(1)
    rerender({ k: 'd2', c: true }) // switched to another finished day
    expect(result.current).toBe(1)
  })
})

describe('wallpapers', () => {
  const img = (hash: string): ProcessedImage => ({ hash, type: 'image/webp', data: new Uint8Array([1, 2, 3]).buffer, thumb: new Uint8Array([1]).buffer, width: 1600, height: 900, name: 'lake' })
  beforeEach(async () => {
    await resetDbForTests()
    usePrefs.setState({ prefs: { ...DEFAULT_PREFS }, ready: true })
  })
  it('accepts only JPG/PNG/WebP', () => {
    expect(isAcceptedFile({ type: 'image/png', name: 'a.png' })).toBe(true)
    expect(isAcceptedFile({ type: 'image/gif', name: 'a.gif' })).toBe(false)
    expect(isAcceptedFile({ type: '', name: 'photo.JPEG' })).toBe(true)
  })
  it('stores an image once even if added twice', async () => {
    const a = await addWallpaper(img('h1'), DEFAULT_WALLPAPER_SETTINGS)
    const b = await addWallpaper(img('h1'), { ...DEFAULT_WALLPAPER_SETTINGS, blur: 4 })
    expect(b.duplicate).toBe(true)
    expect(b.wallpaper.id).toBe(a.wallpaper.id)
    expect(await db.wallpapers.count()).toBe(1)
  })
  it('falls back to the original background when an active wallpaper is missing', async () => {
    const { wallpaper } = await addWallpaper(img('h2'), DEFAULT_WALLPAPER_SETTINGS)
    act(() => usePrefs.setState({ prefs: { ...DEFAULT_PREFS, wallpaperWorkspace: wallpaper.id, wallpaperWindow: 'gone' }, ready: true }))
    const seen: (string | null)[] = []
    function Probe() {
      const w = useActiveWallpapers()
      seen.push(w.workspace?.id ?? null)
      return null
    }
    render(<Probe />)
    await waitFor(() => expect(usePrefs.getState().prefs.wallpaperWindow).toBeNull())
    expect(usePrefs.getState().prefs.wallpaperWorkspace).toBe(wallpaper.id)
    await waitFor(() => expect(seen.at(-1)).toBe(wallpaper.id))
    await deleteWallpaper(wallpaper.id)
    await waitFor(() => expect(usePrefs.getState().prefs.wallpaperWorkspace).toBeNull())
  })
})
