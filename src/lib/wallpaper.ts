import { db } from '@/db/db'
import { uid } from '@/domain/ids'
import type { Wallpaper } from '@/domain/types'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES = 40 * 1024 * 1024
const MAX_EDGE = 2560
const THUMB_EDGE = 360

export class WallpaperError extends Error {
  constructor(public code: 'unsupported' | 'tooLarge' | 'corrupt') {
    super(code)
  }
}

export type WallpaperSettings = Pick<Wallpaper, 'mode' | 'posX' | 'posY' | 'zoom' | 'brightness' | 'blur' | 'opacity' | 'overlay' | 'parallax'>

export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  mode: 'fill',
  posX: 50,
  posY: 50,
  zoom: 1,
  brightness: 0.9,
  blur: 0,
  opacity: 1,
  overlay: 0.35,
  parallax: 0.5,
}

export interface ProcessedImage {
  hash: string
  type: string
  data: ArrayBuffer
  thumb: ArrayBuffer
  width: number
  height: number
  name: string
}

export function isAcceptedFile(file: { type: string; name: string }) {
  if (ACCEPTED_TYPES.includes(file.type)) return true
  return /\.(jpe?g|png|webp)$/i.test(file.name) && !file.type
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  try {
    const d = await crypto.subtle.digest('SHA-256', buf)
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback (non-secure contexts): FNV-1a over the bytes plus length.
    const v = new Uint8Array(buf)
    let h = 2166136261
    for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v[i], 16777619)
    return `fnv-${(h >>> 0).toString(16)}-${v.length}`
  }
}

async function encode(bitmap: ImageBitmap, edge: number, quality: number): Promise<{ buf: ArrayBuffer; type: string; w: number; h: number }> {
  const k = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * k))
  const h = Math.max(1, Math.round(bitmap.height * k))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new WallpaperError('corrupt')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality))
  const blob = (await toBlob('image/webp')) ?? (await toBlob('image/jpeg'))
  if (!blob) throw new WallpaperError('corrupt')
  return { buf: await blob.arrayBuffer(), type: blob.type || 'image/jpeg', w, h }
}

/**
 * Validate, decode and downscale a user image. Large photos are re-encoded to at most 2560px on the
 * long edge (never upscaled, never stretched) so storage stays small; a 360px thumbnail is made too.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  if (!isAcceptedFile(file)) throw new WallpaperError('unsupported')
  if (file.size > MAX_BYTES) throw new WallpaperError('tooLarge')
  const original = await file.arrayBuffer()
  const hash = await sha256(original)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([original], { type: file.type || 'image/jpeg' }))
  } catch {
    throw new WallpaperError('corrupt')
  }
  try {
    const main = await encode(bitmap, MAX_EDGE, 0.9)
    const thumb = await encode(bitmap, THUMB_EDGE, 0.8)
    return { hash, type: main.type, data: main.buf, thumb: thumb.buf, width: main.w, height: main.h, name: file.name.replace(/\.[^.]+$/, '') }
  } finally {
    bitmap.close?.()
  }
}

export async function findByHash(hash: string) {
  return db.wallpapers.where('hash').equals(hash).first()
}

/** Store a processed image with its settings; returns the existing record if the same image is already saved. */
export async function addWallpaper(img: ProcessedImage, settings: WallpaperSettings): Promise<{ wallpaper: Wallpaper; duplicate: boolean }> {
  const existing = await findByHash(img.hash)
  if (existing) return { wallpaper: existing, duplicate: true }
  const now = Date.now()
  const w: Wallpaper = { id: uid(), ...img, ...settings, createdAt: now, updatedAt: now }
  await db.wallpapers.add(w)
  return { wallpaper: w, duplicate: false }
}

export async function updateWallpaper(id: string, patch: Partial<WallpaperSettings & { name: string }>) {
  await db.wallpapers.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteWallpaper(id: string) {
  await db.wallpapers.delete(id)
  revokeUrls(id)
}

// Object URLs are created once per image and reused; image bytes never change for a given id.
const urls = new Map<string, { full?: string; thumb?: string }>()

export function wallpaperUrl(w: Pick<Wallpaper, 'id' | 'data' | 'type'>): string {
  const entry = urls.get(w.id) ?? {}
  if (!entry.full) {
    entry.full = URL.createObjectURL(new Blob([w.data], { type: w.type }))
    urls.set(w.id, entry)
  }
  return entry.full
}

export function thumbUrl(w: Pick<Wallpaper, 'id' | 'thumb' | 'type'>): string {
  const entry = urls.get(w.id) ?? {}
  if (!entry.thumb) {
    entry.thumb = URL.createObjectURL(new Blob([w.thumb], { type: w.type }))
    urls.set(w.id, entry)
  }
  return entry.thumb
}

export function revokeWallpaperUrl(id: string) {
  if (id.startsWith('draft-')) revokeUrls(id)
}

function revokeUrls(id: string) {
  const e = urls.get(id)
  if (e?.full) URL.revokeObjectURL(e.full)
  if (e?.thumb) URL.revokeObjectURL(e.thumb)
  urls.delete(id)
}
