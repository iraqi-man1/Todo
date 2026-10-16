import { AppWindow, Check, ImagePlus, Monitor, Moon, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Label, Segmented } from '@/components/ui/fields'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { WallpaperImage } from '@/components/wallpaper/WallpaperImage'
import type { Wallpaper } from '@/domain/types'
import { useAllWallpapers } from '@/hooks/useWallpapers'
import { reportError } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  addWallpaper,
  ACCEPTED_TYPES,
  DEFAULT_WALLPAPER_SETTINGS,
  deleteWallpaper,
  findByHash,
  processImage,
  revokeWallpaperUrl,
  thumbUrl,
  updateWallpaper,
  WallpaperError,
  type ProcessedImage,
  type WallpaperSettings as Settings,
} from '@/lib/wallpaper'
import { usePrefs } from '@/store/prefs'

type Draft =
  | { kind: 'new'; img: ProcessedImage; settings: Settings; useWorkspace: boolean; useWindow: boolean }
  | { kind: 'edit'; wallpaper: Wallpaper; settings: Settings; useWorkspace: boolean; useWindow: boolean }

const pick = (w: Wallpaper): Settings => ({
  mode: w.mode,
  posX: w.posX,
  posY: w.posY,
  zoom: w.zoom,
  brightness: w.brightness,
  blur: w.blur,
  opacity: w.opacity,
  overlay: w.overlay,
  parallax: w.parallax,
})

/** Settings → Appearance → Wallpapers: upload, preview, crop, apply to workspace and/or window, manage. */
export function WallpaperSettings() {
  const { d } = useI18n()
  const prefs = usePrefs((s) => s.prefs)
  const update = usePrefs((s) => s.update)
  const all = useAllWallpapers()
  const input = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string | 'original'>('original')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Wallpaper | null>(null)

  const sel = all.find((w) => w.id === selected) ?? null
  const isWs = (id: string | null) => prefs.wallpaperWorkspace === id
  const isWin = (id: string | null) => prefs.wallpaperWindow === id

  const onFile = async (file: File) => {
    setBusy(true)
    try {
      const img = await processImage(file)
      const existing = await findByHash(img.hash)
      if (existing) {
        toast(d.wallpaper.duplicate)
        setSelected(existing.id)
        setDraft({ kind: 'edit', wallpaper: existing, settings: pick(existing), useWorkspace: isWs(existing.id), useWindow: isWin(existing.id) })
      } else setDraft({ kind: 'new', img, settings: { ...DEFAULT_WALLPAPER_SETTINGS }, useWorkspace: true, useWindow: false })
    } catch (e) {
      if (e instanceof WallpaperError) toast.error(d.wallpaper[e.code])
      else reportError(e)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!draft) return
    try {
      let id: string
      if (draft.kind === 'new') {
        const res = await addWallpaper(draft.img, draft.settings)
        id = res.wallpaper.id
        if (res.duplicate) await updateWallpaper(id, draft.settings)
      } else {
        id = draft.wallpaper.id
        await updateWallpaper(id, draft.settings)
      }
      const patch: Partial<typeof prefs> = {}
      if (draft.useWorkspace) patch.wallpaperWorkspace = id
      else if (prefs.wallpaperWorkspace === id) patch.wallpaperWorkspace = null
      if (draft.useWindow) patch.wallpaperWindow = id
      else if (prefs.wallpaperWindow === id) patch.wallpaperWindow = null
      update(patch)
      setSelected(id)
      setDraft(null)
      toast.success(d.wallpaper.saved)
    } catch (e) {
      reportError(e)
    }
  }

  const remove = async (w: Wallpaper) => {
    const patch: Partial<typeof prefs> = {}
    if (prefs.wallpaperWorkspace === w.id) patch.wallpaperWorkspace = null
    if (prefs.wallpaperWindow === w.id) patch.wallpaperWindow = null
    if (Object.keys(patch).length) update(patch)
    await deleteWallpaper(w.id).catch(reportError)
    setSelected('original')
  }

  const Badges = ({ id }: { id: string | null }) => (
    <span className="absolute end-1.5 bottom-1.5 flex gap-1">
      {isWs(id) && (
        <span title={d.wallpaper.workspace} className="grid size-6 place-items-center rounded-full bg-black/60 text-white">
          <Monitor className="size-3.5" />
          <span className="sr-only">{d.wallpaper.workspace}</span>
        </span>
      )}
      {isWin(id) && (
        <span title={d.wallpaper.window} className="grid size-6 place-items-center rounded-full bg-black/60 text-white">
          <AppWindow className="size-3.5" />
          <span className="sr-only">{d.wallpaper.window}</span>
        </span>
      )}
    </span>
  )

  return (
    <div className="px-4 py-3.5">
      <p className="text-[13px] leading-snug text-ink-soft">{d.wallpaper.help}</p>
      <div role="listbox" aria-label={d.wallpaper.title} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          type="button"
          role="option"
          aria-selected={selected === 'original'}
          onClick={() => setSelected('original')}
          className={cn('relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition', selected === 'original' ? 'border-accent' : 'border-transparent')}
          style={{ background: 'radial-gradient(circle at 72% 28%, #EFE6D2 0 5%, rgb(245 231 207 / 0.25) 7%, transparent 24%), linear-gradient(180deg, #0A111E, #24324B 80%, #3A3A4A)' }}
          aria-label={d.wallpaper.original}
        >
          <span className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'repeating-linear-gradient(90deg, #0E1626 0 9px, #121b2d 9px 15px)' }} />
          <Moon className="absolute top-2 left-2 size-3.5 text-[#F5E7CF]/80" />
          <Badges id={null} />
        </button>
        {all.map((w) => (
          <button
            key={w.id}
            type="button"
            role="option"
            aria-selected={selected === w.id}
            aria-label={w.name}
            onClick={() => setSelected(w.id)}
            className={cn('relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-surface-2 transition', selected === w.id ? 'border-accent' : 'border-transparent')}
          >
            <img src={thumbUrl(w)} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <Badges id={w.id} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs font-medium text-ink-soft transition hover:border-accent/50 hover:text-ink disabled:opacity-60"
        >
          <ImagePlus className="size-5" />
          {d.wallpaper.upload}
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(',') + ',.jpg,.jpeg,.png,.webp'}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* Placement for the selected wallpaper; for the original, offer to restore it where a custom one is used */}
      {sel ? (
        <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
          <label className="flex min-h-12 items-center justify-between gap-3 px-3 text-sm">
            <span className="flex items-center gap-2">
              <Monitor className="size-4 text-ink-soft" /> {d.wallpaper.workspace}
            </span>
            <Switch checked={isWs(sel.id)} onCheckedChange={(on) => update({ wallpaperWorkspace: on ? sel.id : null })} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 px-3 text-sm">
            <span className="flex items-center gap-2">
              <AppWindow className="size-4 text-ink-soft" /> {d.wallpaper.window}
            </span>
            <Switch checked={isWin(sel.id)} onCheckedChange={(on) => update({ wallpaperWindow: on ? sel.id : null })} />
          </label>
          <div className="flex flex-wrap gap-2 px-3 py-2.5">
            <Button variant="secondary" size="sm" onClick={() => setDraft({ kind: 'edit', wallpaper: sel, settings: pick(sel), useWorkspace: isWs(sel.id), useWindow: isWin(sel.id) })}>
              <SlidersHorizontal /> {d.wallpaper.edit}
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(sel)}>
              <Trash2 /> {d.wallpaper.delete}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!isWs(null) && (
            <Button variant="secondary" size="sm" onClick={() => update({ wallpaperWorkspace: null })}>
              <RotateCcw /> {d.wallpaper.restore} · {d.wallpaper.workspace}
            </Button>
          )}
          {!isWin(null) && (
            <Button variant="secondary" size="sm" onClick={() => update({ wallpaperWindow: null })}>
              <RotateCcw /> {d.wallpaper.restore} · {d.wallpaper.window}
            </Button>
          )}
          {isWs(null) && isWin(null) && <p className="text-[13px] text-ink-soft">{d.wallpaper.originalInUse}</p>}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        {draft && <Editor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} />}
      </Dialog>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={d.wallpaper.delete}
        body={d.wallpaper.deleteConfirm}
        confirmLabel={d.common.delete}
        danger
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
      />
    </div>
  )
}

function Editor({ draft, setDraft, onSave, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const { d } = useI18n()
  const s = draft.settings
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, settings: { ...s, ...patch } })
  const source = draft.kind === 'new' ? { id: `draft-${draft.img.hash}`, data: draft.img.data, type: draft.img.type } : draft.wallpaper
  const windowShape = draft.useWindow && !draft.useWorkspace
  // The unsaved preview gets a temporary object URL; free it when the editor closes.
  useEffect(() => () => revokeWallpaperUrl(source.id), [source.id])
  const drag = useRef<{ x: number; y: number; px: number; py: number; w: number; h: number } | null>(null)

  const slider = (label: string, key: keyof Settings, min: number, max: number, step: number) => (
    <div>
      <Label>{label}</Label>
      <Slider value={[s[key] as number]} min={min} max={max} step={step} onValueChange={([v]) => set({ [key]: v } as Partial<Settings>)} thumbLabel={label} />
    </div>
  )

  return (
    <DialogContent className="sm:w-[min(40rem,calc(100vw-2rem))]">
      <DialogTitle>{d.wallpaper.editorTitle}</DialogTitle>
      <DialogDescription className="mt-1">{d.wallpaper.position}</DialogDescription>
      <div
        className={cn(
          'relative mx-auto mt-4 cursor-grab touch-none overflow-hidden rounded-xl border border-line shadow-soft active:cursor-grabbing',
          windowShape ? 'aspect-[2/3] h-72' : 'aspect-video w-full',
        )}
        aria-label={d.wallpaper.preview}
        role="img"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          drag.current = { x: e.clientX, y: e.clientY, px: s.posX, py: s.posY, w: r.width, h: r.height }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const g = drag.current
          if (!g) return
          // Dragging the image right reveals more of its left side, so the focal point moves left.
          const nx = g.px - ((e.clientX - g.x) / g.w) * 100 / Math.max(1, s.zoom)
          const ny = g.py - ((e.clientY - g.y) / g.h) * 100 / Math.max(1, s.zoom)
          set({ posX: Math.round(Math.max(0, Math.min(100, nx))), posY: Math.round(Math.max(0, Math.min(100, ny))) })
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <WallpaperImage wallpaper={source} settings={s} />
        {windowShape && (
          <>
            <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 bg-[#4A3221]" />
            <div className="absolute inset-x-0 top-[42%] h-2 bg-[#4A3221]" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>{d.wallpaper.mode}</Label>
          <Segmented label={d.wallpaper.mode} value={s.mode} onChange={(mode) => set({ mode })} className="flex w-full" options={(['fill', 'fit', 'center'] as const).map((m) => ({ value: m, label: d.wallpaper.modes[m] }))} />
        </div>
        {slider(d.wallpaper.zoom, 'zoom', 1, 3, 0.05)}
        {slider(d.wallpaper.brightness, 'brightness', 0.4, 1.4, 0.05)}
        {slider(d.wallpaper.blur, 'blur', 0, 20, 1)}
        {slider(d.wallpaper.opacity, 'opacity', 0.2, 1, 0.05)}
        {slider(d.wallpaper.overlay, 'overlay', 0, 0.85, 0.05)}
        {slider(d.wallpaper.parallax, 'parallax', 0, 1, 0.05)}
      </div>

      <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
        <label className="flex min-h-12 items-center justify-between gap-3 px-3 text-sm">
          {d.wallpaper.workspace}
          <Switch checked={draft.useWorkspace} onCheckedChange={(v) => setDraft({ ...draft, useWorkspace: v })} />
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3 px-3 text-sm">
          {d.wallpaper.window}
          <Switch checked={draft.useWindow} onCheckedChange={(v) => setDraft({ ...draft, useWindow: v })} />
        </label>
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          {d.wallpaper.cancel}
        </Button>
        <Button variant="primary" className="flex-[2]" onClick={onSave}>
          <Check /> {draft.useWorkspace || draft.useWindow ? d.wallpaper.apply : d.wallpaper.save}
        </Button>
      </div>
    </DialogContent>
  )
}
