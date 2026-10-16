import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { WallpaperImage } from '@/components/wallpaper/WallpaperImage'
import type { Wallpaper } from '@/domain/types'
import { parallaxLayer, useParallax } from '@/hooks/useParallax'
import type { Season, SkyPhase, Weather } from '@/lib/sky'
import { cn } from '@/lib/utils'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

/** The view outside: sky, sun or moon, slow clouds, a far city and tree line. Pure SVG. */
const layer = parallaxLayer

interface Palette {
  sky: [string, string, string, string]
  stars: number
  body: 'moon' | 'sun' | 'lowsun'
  cloud: [string, number]
  far: string
  near: string
  lights: number
  glow: number
  haze: [string, number]
  trees: string
}

const PALETTES: Record<SkyPhase, Palette> = {
  night: { sky: ['#0A111E', '#152238', '#24324B', '#3A3A4A'], stars: 0.55, body: 'moon', cloud: ['#3B4862', 0.55], far: '#18233A', near: '#0E1626', lights: 1, glow: 0.16, haze: ['#3A3E52', 0.55], trees: '#080D17' },
  dawn: { sky: ['#1F2A4A', '#5A5A86', '#C98C8C', '#F2C29A'], stars: 0.22, body: 'lowsun', cloud: ['#E3AFA6', 0.5], far: '#3E4262', near: '#262B46', lights: 0.45, glow: 0.1, haze: ['#F2C29A', 0.32], trees: '#161A2A' },
  day: { sky: ['#3F7FC2', '#6FA6DB', '#A9CFEE', '#D8EAF6'], stars: 0, body: 'sun', cloud: ['#FFFFFF', 0.78], far: '#8195AF', near: '#52637C', lights: 0.05, glow: 0, haze: ['#DCEBF6', 0.45], trees: '#2E3C3C' },
  dusk: { sky: ['#18203E', '#4A3E6E', '#B4607A', '#F09A6A'], stars: 0.3, body: 'lowsun', cloud: ['#C27E8C', 0.5], far: '#3B2F50', near: '#1F1A31', lights: 0.8, glow: 0.2, haze: ['#F09A6A', 0.3], trees: '#120F1C' },
}

const TREE_TINT: Record<Season, [string, number]> = { winter: ['#EEF3F8', 0.55], spring: ['#5E9E4A', 0.28], summer: ['#3E6E3A', 0.18], autumn: ['#C2601E', 0.42] }

const NightScene = memo(function NightScene({ moonY = 120, phase = 'night', season = 'autumn' }: { moonY?: number; phase?: SkyPhase; season?: Season }) {
  const { stars, buildings, lights, far } = useMemo(() => {
    const r = rng(42)
    const stars = Array.from({ length: 46 }, () => ({ x: r() * 400, y: r() * 300, s: 0.4 + r() * 0.9, tw: r() < 0.25, d: r() * 6 }))
    const buildings: { x: number; w: number; h: number }[] = []
    for (let x = -10; x < 410; ) {
      const w = 14 + r() * 26
      buildings.push({ x, w, h: 40 + r() * 110 * (r() < 0.15 ? 1.6 : 1) })
      x += w + r() * 3
    }
    // A hazier, farther skyline for depth.
    const far: { x: number; w: number; h: number }[] = []
    for (let x = -10; x < 410; ) {
      const w = 10 + r() * 18
      far.push({ x, w, h: 70 + r() * 120 })
      x += w + r() * 2
    }
    const lights: { x: number; y: number; o: number }[] = []
    for (const b of buildings)
      for (let yy = 600 - b.h + 6; yy < 585; yy += 7)
        for (let xx = b.x + 3; xx < b.x + b.w - 3; xx += 5) if (r() < 0.13) lights.push({ x: xx, y: yy, o: 0.35 + r() * 0.6 })
    return { stars, buildings, lights, far }
  }, [])
  const p = PALETTES[phase]
  const tint = TREE_TINT[season]
  const trees = 'M0 600 V560 q12 -22 26 -6 q10 -30 28 -8 q14 -18 26 4 q8 -10 18 2 V600 Z M300 600 V572 q14 -26 30 -8 q12 -24 30 -2 q16 -20 26 6 q8 -6 14 2 V600 Z'
  const sunX = p.body === 'lowsun' ? (phase === 'dawn' ? 90 : 120) : 295
  const sunY = p.body === 'lowsun' ? moonY + 230 : moonY
  return (
    <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full scale-[1.06]" data-phase={phase} data-season={season}>
      <defs>
        <linearGradient id={`dw-sky-${phase}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.55" stopColor={p.sky[1]} />
          <stop offset="0.85" stopColor={p.sky[2]} />
          <stop offset="1" stopColor={p.sky[3]} />
        </linearGradient>
        <radialGradient id="dw-moonglow">
          <stop offset="0" stopColor="#F5E7CF" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#C9D3E6" stopOpacity="0.12" />
          <stop offset="1" stopColor="#C9D3E6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`dw-sunglow-${phase}`}>
          <stop offset="0" stopColor={phase === 'day' ? '#FFFBE8' : '#FFD9A0'} stopOpacity="0.9" />
          <stop offset="0.3" stopColor={phase === 'day' ? '#FFF2C2' : '#F6A86A'} stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFE8B0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`dw-cloud-${phase}`}>
          <stop offset="0" stopColor={p.cloud[0]} stopOpacity={p.cloud[1]} />
          <stop offset="1" stopColor={p.cloud[0]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`dw-haze-${phase}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.haze[0]} stopOpacity="0" />
          <stop offset="1" stopColor={p.haze[0]} stopOpacity={p.haze[1]} />
        </linearGradient>
        <linearGradient id="dw-cityglow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8AD67" stopOpacity="0" />
          <stop offset="1" stopColor="#E8AD67" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill={`url(#dw-sky-${phase})`} />
      {/* Each layer drifts by its depth (parallax via --px/--py set by the window). */}
      {p.stars > 0 && (
        <g style={layer(2)} opacity={p.stars / 0.55}>
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#F5E7CF" opacity={0.55} className={s.tw ? 'dw-twinkle' : undefined} style={s.tw ? { animationDelay: `${s.d}s` } : undefined} />
          ))}
        </g>
      )}
      <g style={layer(3)}>
        {p.body === 'moon' ? (
          <>
            <circle cx="295" cy={moonY} r="90" fill="url(#dw-moonglow)" />
            <circle cx="295" cy={moonY} r="19" fill="#EFE6D2" />
            <circle cx="301" cy={moonY - 6} r="17" fill="#E3D9C2" opacity="0.5" />
            <circle cx="288" cy={moonY + 6} r="3" fill="#D6CCB4" opacity="0.6" />
          </>
        ) : (
          <>
            <circle cx={sunX} cy={sunY} r={p.body === 'sun' ? 110 : 130} fill={`url(#dw-sunglow-${phase})`} />
            <circle cx={sunX} cy={sunY} r={p.body === 'sun' ? 17 : 24} fill={p.body === 'sun' ? '#FFF8E2' : '#FFC88A'} opacity={p.body === 'sun' ? 1 : 0.92} />
          </>
        )}
      </g>
      <g style={layer(5)}>
        <g className="dw-clouds">
          <ellipse cx="120" cy="150" rx="150" ry="26" fill={`url(#dw-cloud-${phase})`} />
          <ellipse cx="330" cy="200" rx="120" ry="20" fill={`url(#dw-cloud-${phase})`} />
          <ellipse cx="220" cy="90" rx="110" ry="16" fill={`url(#dw-cloud-${phase})`} opacity="0.7" />
        </g>
      </g>
      {p.glow > 0 && <rect y="420" width="400" height="180" fill="url(#dw-cityglow)" opacity={p.glow} />}
      <g style={layer(6)} fill={p.far}>
        {far.map((b, i) => (
          <rect key={i} x={b.x} y={600 - b.h} width={b.w} height={b.h} />
        ))}
      </g>
      <rect y="380" width="400" height="220" fill={`url(#dw-haze-${phase})`} />
      <g style={layer(9)}>
        <g fill={p.near}>
          {buildings.map((b, i) => (
            <rect key={i} x={b.x} y={600 - b.h} width={b.w} height={b.h} />
          ))}
        </g>
        {season === 'winter' && (
          <g fill="#F4F8FC" opacity="0.85">
            {buildings.map((b, i) => (
              <rect key={i} x={b.x - 0.5} y={600 - b.h - 1.5} width={b.w + 1} height="3" rx="1.2" />
            ))}
          </g>
        )}
        {p.lights > 0.04 && (
          <g fill="#F2C27E" opacity={p.lights}>
            {lights.map((l, i) => (
              <rect
                key={i}
                x={l.x}
                y={l.y}
                width="2"
                height="2.6"
                opacity={l.o}
                className={i % 23 === 7 ? 'dw-flicker' : undefined}
                style={i % 23 === 7 ? { animationDelay: `${(i % 11) * 1.7}s` } : undefined}
              />
            ))}
          </g>
        )}
      </g>
      <g style={layer(14)}>
        <path d={trees} fill={p.trees} />
        <path d={trees} fill={tint[0]} opacity={tint[1]} />
      </g>
    </svg>
  )
})

interface Drop {
  x: number
  y: number
  r: number
  v: number
  trail: number
  sliding: boolean
}

/**
 * Rain on the glass, on a single canvas at ~30fps. Pauses when hidden or still; with motion off it
 * paints one static frame of beads so the window still reads as rainy.
 */
function RainCanvas({ intensity, animate }: { intensity: number; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let w = 0
    let h = 0
    const r = rng(7)
    let beads: Drop[] = []
    let streaks: { x: number; y: number; l: number; v: number }[] = []
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const area = (w * h) / 10000
      beads = Array.from({ length: Math.round(area * 9 * intensity) + 6 }, () => ({
        x: r() * w,
        y: r() * h,
        r: 0.6 + r() * 1.8,
        v: 0,
        trail: 0,
        sliding: false,
      }))
      streaks = Array.from({ length: Math.round(area * 3 * intensity) }, () => ({ x: r() * w, y: r() * h, l: 8 + r() * 14, v: 380 + r() * 260 }))
    }
    const drawBead = (d: Drop) => {
      ctx.beginPath()
      ctx.fillStyle = 'rgba(200,215,235,0.16)'
      ctx.arc(d.x, d.y, d.r * 1.25, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = 'rgba(245,231,207,0.5)'
      ctx.arc(d.x - d.r * 0.35, d.y - d.r * 0.4, Math.max(0.35, d.r * 0.35), 0, Math.PI * 2)
      ctx.fill()
      if (d.sliding && d.trail > 1) {
        ctx.strokeStyle = 'rgba(200,215,235,0.10)'
        ctx.lineWidth = d.r * 0.9
        ctx.beginPath()
        ctx.moveTo(d.x, d.y - d.trail)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }
    }
    const frame = (dt: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(190,205,230,0.18)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      for (const s of streaks) {
        s.y += s.v * dt
        s.x -= s.v * dt * 0.08
        if (s.y > h) {
          s.y = -s.l
          s.x = r() * (w + 40)
        }
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x + s.l * 0.08, s.y - s.l)
      }
      ctx.stroke()
      for (const d of beads) {
        if (!d.sliding && d.r > 1.6 && r() < 0.002 * intensity) {
          d.sliding = true
          d.v = 18 + r() * 40
        }
        if (d.sliding) {
          d.y += d.v * dt
          d.x += Math.sin(d.y * 0.05) * 0.08
          d.trail = Math.min(d.trail + d.v * dt, 60)
          if (d.y - d.trail > h) Object.assign(d, { x: r() * w, y: -4, r: 0.6 + r() * 1.8, sliding: false, trail: 0, v: 0 })
        }
        drawBead(d)
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = (t - last) / 1000
      last = t
      acc += dt
      if (acc < 1 / 30) return
      frame(Math.min(acc, 0.1))
      acc = 0
    }
    const start = () => {
      cancelAnimationFrame(raf)
      if (animate && document.visibilityState === 'visible') {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      } else frame(0)
    }
    start()
    document.addEventListener('visibilitychange', start)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', start)
    }
  }, [intensity, animate])
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}

interface Flake {
  x: number
  y: number
  r: number
  v: number
  sway: number
  phase: number
  spin: number
  angle: number
  color: string
}

const LEAF_COLORS = ['#D9822B', '#B5462A', '#E3B23C', '#9E5B2B', '#C9672F']

/**
 * Snow drifting or autumn leaves tumbling past the glass, same budget as the rain: one canvas, ~30fps,
 * paused when hidden, a single still frame when motion is off.
 */
function DriftCanvas({ kind, intensity, animate }: { kind: 'snow' | 'leaves'; intensity: number; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let w = 0
    let h = 0
    const r = rng(kind === 'snow' ? 11 : 23)
    let items: Flake[] = []
    const make = (y?: number): Flake =>
      kind === 'snow'
        ? { x: r() * w, y: y ?? r() * h, r: 0.8 + r() * 2.2, v: 14 + r() * 26, sway: 6 + r() * 14, phase: r() * 6.28, spin: 0, angle: 0, color: '' }
        : {
            x: r() * w,
            y: y ?? r() * h,
            r: 3 + r() * 3.5,
            v: 26 + r() * 30,
            sway: 14 + r() * 22,
            phase: r() * 6.28,
            spin: (r() - 0.5) * 4,
            angle: r() * 6.28,
            color: LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)],
          }
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const area = (w * h) / 10000
      const n = kind === 'snow' ? Math.round(area * 5 * intensity) + 8 : Math.round(area * 0.7 * intensity) + 3
      items = Array.from({ length: n }, () => make())
    }
    let t = 0
    const frame = (dt: number) => {
      t += dt
      ctx.clearRect(0, 0, w, h)
      for (const f of items) {
        f.y += f.v * dt
        f.angle += f.spin * dt
        const x = f.x + Math.sin(t * (kind === 'snow' ? 0.8 : 1.3) + f.phase) * f.sway + (kind === 'leaves' ? (f.y / h) * -30 : 0)
        if (f.y - 10 > h) Object.assign(f, make(-10))
        if (kind === 'snow') {
          ctx.beginPath()
          ctx.fillStyle = `rgba(240,246,255,${0.45 + f.r * 0.15})`
          ctx.arc(x, f.y, f.r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.save()
          ctx.translate(x, f.y)
          ctx.rotate(f.angle)
          // squash with the spin so the leaf seems to flip
          ctx.scale(1, 0.35 + Math.abs(Math.cos(f.angle * 1.7)) * 0.65)
          ctx.fillStyle = f.color
          ctx.globalAlpha = 0.85
          ctx.beginPath()
          ctx.moveTo(-f.r * 1.4, 0)
          ctx.quadraticCurveTo(0, -f.r, f.r * 1.4, 0)
          ctx.quadraticCurveTo(0, f.r, -f.r * 1.4, 0)
          ctx.fill()
          ctx.strokeStyle = 'rgba(60,30,10,0.45)'
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(-f.r * 1.4, 0)
          ctx.lineTo(f.r * 1.4, 0)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      acc += (now - last) / 1000
      last = now
      if (acc < 1 / 30) return
      frame(Math.min(acc, 0.1))
      acc = 0
    }
    const start = () => {
      cancelAnimationFrame(raf)
      if (animate && document.visibilityState === 'visible') {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      } else frame(0)
    }
    start()
    document.addEventListener('visibilitychange', start)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', start)
    }
  }, [kind, intensity, animate])
  return <canvas ref={ref} data-weather={kind} className="absolute inset-0 h-full w-full" />
}

/** A wooden-framed window with the night outside. Decorative only. */
export function NightWindow({
  rain,
  weather = 'rain',
  phase = 'night',
  season = 'autumn',
  intensity,
  animate,
  parallax = false,
  scenery,
  framed = true,
  className,
}: {
  /** Weather effects on/off (the "rain" switch). */
  rain: boolean
  weather?: Weather
  phase?: SkyPhase
  season?: Season
  intensity: number
  animate: boolean
  /** Pointer parallax across the depth layers (sky, city, rain, glass); the frame stays put. */
  parallax?: boolean
  /** A custom wallpaper shown through the glass instead of the night scene. */
  scenery?: Wallpaper | null
  framed?: boolean
  className?: string
}) {
  const pane = useRef<HTMLDivElement>(null)
  useParallax(pane, parallax && framed)
  const [broken, setBroken] = useState<string | null>(null)
  const custom = scenery && broken !== scenery.id ? scenery : null
  return (
    <div
      className={cn('relative overflow-hidden', framed && 'rounded-[6px] p-[14px]', className)}
      style={
        framed
          ? {
              backgroundColor: '#4A3221',
              backgroundImage: 'linear-gradient(135deg, rgb(232 173 103 / 0.18), rgb(0 0 0 / 0.3)), linear-gradient(rgb(50 30 15 / 0.55), rgb(50 30 15 / 0.55)), var(--wood-texture)',
              backgroundSize: '100% 100%, 100% 100%, 700px 700px',
              boxShadow: 'inset 0 1px 0 rgb(255 220 170 / 0.18), 0 30px 60px -20px rgb(0 0 0 / 0.7)',
            }
          : undefined
      }
    >
      <div ref={pane} className={cn('relative h-full w-full overflow-hidden', framed && 'rounded-[2px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.5),inset_0_6px_14px_rgb(0_0_0/0.55)]')}>
        {custom ? (
          <WallpaperImage wallpaper={custom} settings={custom} parallaxDepth={10} onError={() => setBroken(custom.id)} />
        ) : (
          <NightScene moonY={framed ? 120 : 330} phase={phase} season={season} />
        )}
        {rain && weather !== 'clear' && (
          // Drops sit on the glass, nearer than the scene: they drift a touch more.
          <div className="absolute -inset-3" style={layer(11)}>
            {weather === 'rain' ? (
              <RainCanvas intensity={intensity} animate={animate} />
            ) : (
              <DriftCanvas kind={weather} intensity={intensity} animate={animate} />
            )}
          </div>
        )}
        {/* glass: faint reflection band + lamp reflected in the pane; drifts slightly against the scene */}
        <div
          className="absolute -inset-2"
          style={{
            ...layer(-3),
            background:
              'linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.05) 38%, transparent 46%), radial-gradient(ellipse 40% 25% at 18% 22%, rgb(232 173 103 / calc(var(--lamp, 0.7) * 0.16)), transparent 70%)',
          }}
        />
        {framed && (
          <>
            <div className="absolute inset-y-0 left-1/2 w-[10px] -translate-x-1/2" style={MULLION} />
            <div className="absolute inset-x-0 top-[42%] h-[10px]" style={MULLION} />
          </>
        )}
      </div>
    </div>
  )
}

const MULLION: React.CSSProperties = {
  backgroundColor: '#4A3221',
  backgroundImage: 'linear-gradient(rgb(40 24 12 / 0.45), rgb(40 24 12 / 0.45)), var(--wood-texture)',
  backgroundSize: '100% 100%, 600px 600px',
  boxShadow: '0 2px 6px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 220 170 / 0.15)',
}
