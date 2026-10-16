/**
 * Gentle synthesized ambience that follows the window's weather: rain patter, the hush of snow,
 * gusts of wind through leaves, or a quiet clear night. Filtered noise only, no files; starts only
 * after the user has turned it on and interacted with the page.
 */
import type { Weather } from './sky'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let nodes: AudioScheduledSourceNode[] = []
let shape: { lp: BiquadFilterNode; bp: BiquadFilterNode; pg: GainNode; gust: GainNode } | null = null
let current: Weather = 'rain'

/** Filter settings per weather: body cutoff, patter band and level, gust depth, overall level. */
const PROFILES: Record<Weather, { lp: number; bp: number; q: number; patter: number; gust: number; level: number }> = {
  rain: { lp: 900, bp: 3200, q: 0.6, patter: 0.08, gust: 0, level: 1 },
  snow: { lp: 380, bp: 1800, q: 0.4, patter: 0, gust: 0.15, level: 0.6 },
  leaves: { lp: 620, bp: 5200, q: 1.1, patter: 0.03, gust: 0.6, level: 0.75 },
  clear: { lp: 300, bp: 2400, q: 0.5, patter: 0, gust: 0.25, level: 0.45 },
}

function makeNoise(ac: AudioContext, seconds: number, brown: boolean) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate)
  const ch = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < ch.length; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      ch[i] = last * 3.5
    } else ch[i] = white
  }
  return buf
}

export function startAmbient(volume: number, intensity: number, weather: Weather = current) {
  current = weather
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  if (master) {
    setAmbientWeather(weather)
    setAmbientVolume(volume, intensity)
    return
  }
  const ac = ctx
  master = ac.createGain()
  master.gain.value = 0
  master.connect(ac.destination)

  const body = ac.createBufferSource()
  body.buffer = makeNoise(ac, 6, true)
  body.loop = true
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  body.connect(lp).connect(master)

  const patter = ac.createBufferSource()
  patter.buffer = makeNoise(ac, 4, false)
  patter.loop = true
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3200
  bp.Q.value = 0.6
  const pg = ac.createGain()
  pg.gain.value = 0.08
  patter.connect(bp).connect(pg).connect(master)

  // a slow oscillator swells the body for gusts of wind
  const bodyGain = ac.createGain()
  lp.disconnect()
  lp.connect(bodyGain).connect(master)
  const lfo = ac.createOscillator()
  lfo.frequency.value = 0.13
  const gust = ac.createGain()
  gust.gain.value = 0
  lfo.connect(gust).connect(bodyGain.gain)

  body.start()
  patter.start()
  lfo.start()
  nodes = [body, patter, lfo]
  shape = { lp, bp, pg, gust }
  setAmbientWeather(weather, true)
  setAmbientVolume(volume, intensity)
}

let lastVolume = 0
let lastIntensity = 0

export function setAmbientVolume(volume: number, intensity: number) {
  lastVolume = volume
  lastIntensity = intensity
  if (!ctx || !master) return
  master.gain.setTargetAtTime(volume * (0.25 + intensity * 0.35) * PROFILES[current].level, ctx.currentTime, 0.8)
}

/** Crossfade the sound to another weather over a couple of seconds. */
export function setAmbientWeather(weather: Weather, immediate = false) {
  const changed = weather !== current
  current = weather
  if (!ctx || !shape) return
  const p = PROFILES[weather]
  const t = ctx.currentTime
  const tc = immediate ? 0.01 : 1.2
  shape.lp.frequency.setTargetAtTime(p.lp, t, tc)
  shape.bp.frequency.setTargetAtTime(p.bp, t, tc)
  shape.bp.Q.setTargetAtTime(p.q, t, tc)
  shape.pg.gain.setTargetAtTime(p.patter, t, tc)
  shape.gust.gain.setTargetAtTime(p.gust, t, tc)
  if (changed) setAmbientVolume(lastVolume, lastIntensity)
}

export function stopAmbient() {
  if (!ctx || !master) return
  const m = master
  m.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
  const ns = nodes
  setTimeout(() => {
    ns.forEach((n) => n.stop())
    m.disconnect()
  }, 1200)
  master = null
  nodes = []
  shape = null
}
