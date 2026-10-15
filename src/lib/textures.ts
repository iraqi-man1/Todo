import type { WoodTheme } from '@/domain/types'

/**
 * Procedural, seamlessly tiling textures rendered once to a canvas and cached as object URLs.
 * Real photos would cost hundreds of KB; this costs a few ms and looks like real oak grain.
 */

type RGB = [number, number, number]
interface WoodPalette {
  light: RGB
  dark: RGB
  grain: RGB
  base: string
}

export const WOOD_PALETTES: Record<WoodTheme, WoodPalette> = {
  'light-oak': { light: [232, 206, 168], dark: [205, 168, 120], grain: [160, 118, 74], base: '#DCC198' },
  'natural-oak': { light: [206, 160, 112], dark: [170, 124, 82], grain: [110, 74, 44], base: '#B98B60' },
  'dark-walnut': { light: [128, 92, 64], dark: [90, 62, 42], grain: [50, 32, 20], base: '#62452F' },
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

/** Tileable value noise on a `period`-sized lattice. */
function makeNoise(period: number, seed: number) {
  const r = rng(seed)
  const grid = new Float32Array(period * period).map(() => r())
  const at = (x: number, y: number) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)]
  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

function canvasOf(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c.getContext('2d')
  } catch {
    return null
  }
}

async function toUrl(ctx: CanvasRenderingContext2D): Promise<string> {
  const canvas = ctx.canvas
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86))
  return blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.86)
}

const woodCache = new Map<WoodTheme, Promise<string | null>>()

export function woodTexture(theme: WoodTheme): Promise<string | null> {
  let p = woodCache.get(theme)
  if (!p) {
    p = renderWood(theme)
    woodCache.set(theme, p)
  }
  return p
}

async function renderWood(theme: WoodTheme): Promise<string | null> {
  const S = 1024
  const PLANK = 128
  const ctx = canvasOf(S, S)
  if (!ctx) return null
  const pal = WOOD_PALETTES[theme]
  const img = ctx.createImageData(S, S)
  const data = img.data
  // Lattice periods divide S so every octave tiles.
  const n1 = makeNoise(4, 11) // long, lazy undulation along the plank
  const n2 = makeNoise(16, 23)
  const n3 = makeNoise(64, 37) // fibres
  const r = rng(theme.length * 97)
  const plankCount = S / PLANK
  const plankTone = Array.from({ length: plankCount }, () => r() * 0.5 - 0.25)
  const plankPhase = Array.from({ length: plankCount }, () => r() * 50)
  const plankJoint = Array.from({ length: plankCount }, () => Math.floor(r() * S))
  const knots = Array.from({ length: 3 }, () => ({ x: r() * S, y: r() * S, s: 10 + r() * 14 }))

  for (let y = 0; y < S; y++) {
    const p = Math.floor(y / PLANK)
    const ly = y - p * PLANK
    for (let x = 0; x < S; x++) {
      const fx = x / S
      const fy = y / S
      const warp = n1(fx * 4, fy * 4 + p) * 40 + n2(fx * 16, fy * 16) * 9
      let knot = 0
      for (const k of knots) {
        let dx = Math.abs(x - k.x)
        dx = Math.min(dx, S - dx)
        let dy = Math.abs(y - k.y)
        dy = Math.min(dy, S - dy)
        const d2 = (dx * dx) / (k.s * k.s * 9) + (dy * dy) / (k.s * k.s)
        if (d2 < 9) knot += Math.exp(-d2) * 18
      }
      const ring = Math.sin((ly + warp + knot + plankPhase[p]) * 0.42)
      const grainLine = Math.pow(Math.abs(ring), 7)
      const fibre = n3(fx * 64, fy * 64 * 6) - 0.5
      let t = 0.45 + plankTone[p] + (n2(fx * 16 + p * 3, fy * 16) - 0.5) * 0.5 + fibre * 0.25
      t = Math.min(1, Math.max(0, t))
      let cr = pal.light[0] + (pal.dark[0] - pal.light[0]) * t
      let cg = pal.light[1] + (pal.dark[1] - pal.light[1]) * t
      let cb = pal.light[2] + (pal.dark[2] - pal.light[2]) * t
      const g = grainLine * 0.38 + Math.min(knot / 30, 0.45)
      cr += (pal.grain[0] - cr) * g
      cg += (pal.grain[1] - cg) * g
      cb += (pal.grain[2] - cb) * g
      // plank seams and butt joints
      let shade = 1
      if (ly < 2) shade = 0.62
      else if (ly < 4) shade = 1.08
      else if (ly > PLANK - 3) shade = 0.9
      const jx = (x - plankJoint[p] + S) % S
      if (jx < 2) shade *= 0.7
      else if (jx < 3) shade *= 1.06
      const i = (y * S + x) * 4
      data[i] = cr * shade
      data[i + 1] = cg * shade
      data[i + 2] = cb * shade
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return toUrl(ctx)
}

let paperPromise: Promise<string | null> | null = null

/** Faint fibrous paper grain, applied over note colors via multiply-ish alpha. */
export function paperNoise(): Promise<string | null> {
  if (!paperPromise) paperPromise = renderPaper()
  return paperPromise
}

async function renderPaper(): Promise<string | null> {
  const S = 160
  const ctx = canvasOf(S, S)
  if (!ctx) return null
  const img = ctx.createImageData(S, S)
  const n = makeNoise(40, 5)
  const n2 = makeNoise(160, 9)
  const rnd = rng(77)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = n((x / S) * 40, (y / S) * 40) * 0.4 + n2((x / S) * 160, (y / S) * 160) * 0.6
      const i = (y * S + x) * 4
      const dark = v < 0.5
      data(i, dark ? 70 : 255, Math.abs(v - 0.5) * 2 * (dark ? 16 : 22) + (rnd() - 0.5) * 10 + 4)
    }
  function data(i: number, c: number, a: number) {
    img.data[i] = c
    img.data[i + 1] = c * 0.94
    img.data[i + 2] = c * 0.86
    img.data[i + 3] = a
  }
  ctx.putImageData(img, 0, 0)
  const canvas = ctx.canvas
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  return blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')
}
