/**
 * Tiny synthesized sound effects (Web Audio). No audio files, nothing autoplays: every sound is
 * triggered by a user action and only when the user has turned sounds on.
 */
import type { PinStyle } from '@/domain/types'
import { usePrefs } from '@/store/prefs'
import { haptic, type Haptic } from './haptics'

export type SoundName = 'tap' | 'pencil' | 'paper' | 'pin' | 'chime' | 'crumple' | 'thud' | 'stamp' | 'unpin' | 'flutter'

export interface SoundOpts {
  force?: boolean
  /** Which pin is pressed in or pulled: each material has its own click. */
  pin?: PinStyle
  /** 0–1, how hard a stamp was pressed. */
  pressure?: number
}

/** A pin's click: burst band (body), ring pitch and how long the ring lasts. */
const PIN_VOICE: Record<PinStyle, { body: number; ring: number; ringDur: number; ringGain: number }> = {
  red: { body: 900, ring: 1320, ringDur: 0.12, ringGain: 0.05 },
  sage: { body: 850, ring: 1180, ringDur: 0.1, ringGain: 0.04 },
  walnut: { body: 520, ring: 640, ringDur: 0.05, ringGain: 0.03 },
  brass: { body: 1300, ring: 1860, ringDur: 0.32, ringGain: 0.06 },
  gold: { body: 1400, ring: 2090, ringDur: 0.42, ringGain: 0.06 },
  copper: { body: 1150, ring: 1560, ringDur: 0.26, ringGain: 0.055 },
  crystal: { body: 2200, ring: 3135, ringDur: 0.55, ringGain: 0.045 },
  star: { body: 1250, ring: 1760, ringDur: 0.3, ringGain: 0.05 },
  heart: { body: 950, ring: 1400, ringDur: 0.16, ringGain: 0.05 },
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2)
  return buf
}

function burst(ac: AudioContext, out: AudioNode, at: number, dur: number, freq: number, q: number, gain: number) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, dur)
  const f = ac.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(out)
  src.start(at)
}

function tone(ac: AudioContext, out: AudioNode, at: number, freq: number, dur: number, gain: number) {
  const o = ac.createOscillator()
  o.type = 'sine'
  o.frequency.value = freq
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + dur + 0.05)
}

/** Moments that also deserve a little buzz on phones. */
const HAPTIC: Partial<Record<SoundName, Haptic>> = { pencil: 'tap', pin: 'pin', chime: 'success', stamp: 'pin', thud: 'tap' }

export function playSound(name: SoundName, opts: boolean | SoundOpts = false) {
  const o: SoundOpts = typeof opts === 'boolean' ? { force: opts } : opts
  const force = !!o.force
  const h = HAPTIC[name]
  if (h && !force) haptic(h)
  const { sound, volume } = usePrefs.getState().prefs
  if ((!sound && !force) || volume <= 0) return
  const ac = audio()
  if (!ac) return
  const master = ac.createGain()
  master.gain.value = volume * 0.9
  master.connect(ac.destination)
  const t = ac.currentTime + 0.01
  switch (name) {
    case 'tap':
      burst(ac, master, t, 0.06, 2400, 1.2, 0.5)
      burst(ac, master, t, 0.03, 600, 2, 0.4)
      break
    case 'pencil': {
      // a short graphite tick: two quick strokes of filtered noise
      burst(ac, master, t, 0.05, 3800, 2.5, 0.22)
      burst(ac, master, t + 0.06, 0.09, 4600, 2, 0.3)
      burst(ac, master, t, 0.03, 900, 3, 0.18)
      break
    }
    case 'paper':
      burst(ac, master, t, 0.25, 3200, 0.7, 0.25)
      burst(ac, master, t + 0.08, 0.2, 1800, 0.8, 0.18)
      break
    case 'pin': {
      const v = PIN_VOICE[o.pin ?? 'red']
      burst(ac, master, t, 0.05, v.body, 3, 0.7)
      tone(ac, master, t, v.ring, v.ringDur, v.ringGain)
      if (o.pin === 'crystal') tone(ac, master, t + 0.01, v.ring * 1.5, v.ringDur * 0.7, v.ringGain * 0.6)
      break
    }
    case 'unpin': {
      // the pin resists, then pops free: a creak, then a higher click
      const v = PIN_VOICE[o.pin ?? 'red']
      burst(ac, master, t, 0.12, v.body * 0.6, 6, 0.18)
      burst(ac, master, t + 0.14, 0.04, v.body * 1.3, 3, 0.55)
      tone(ac, master, t + 0.14, v.ring * 1.12, v.ringDur * 0.8, v.ringGain)
      break
    }
    case 'crumple':
      // a fistful of crackles, denser at the start
      for (let i = 0; i < 9; i++) burst(ac, master, t + i * 0.028 + Math.random() * 0.02, 0.05 + Math.random() * 0.05, 1800 + Math.random() * 3200, 1.2, 0.22 - i * 0.015)
      break
    case 'thud':
      burst(ac, master, t, 0.12, 260, 1.4, 0.55)
      burst(ac, master, t + 0.01, 0.06, 1400, 2, 0.15)
      break
    case 'stamp': {
      // a harder press is a deeper, louder thump
      const p = Math.max(0, Math.min(1, o.pressure ?? 0.6))
      burst(ac, master, t, 0.09 + p * 0.05, 180 + p * 80, 1.2, 0.35 + p * 0.45)
      burst(ac, master, t, 0.04, 2200, 2, 0.12 + p * 0.1)
      break
    }
    case 'flutter':
      // paper falling through the air: soft, wavering
      for (let i = 0; i < 4; i++) burst(ac, master, t + i * 0.11, 0.14, 2400 + (i % 2) * 900, 0.9, 0.09)
      break
    case 'chime':
      tone(ac, master, t, 784, 0.9, 0.12)
      tone(ac, master, t + 0.09, 988, 0.9, 0.1)
      tone(ac, master, t + 0.18, 1319, 1.2, 0.08)
      break
  }
}

/**
 * A continuous paper rustle that follows how fast a sheet is moved: slow drags whisper, quick ones
 * hiss louder and brighter. Returns null when sounds are off.
 */
export function startRustle(): { update: (speed: number) => void; stop: () => void } | null {
  const { sound, volume } = usePrefs.getState().prefs
  if (!sound || volume <= 0) return null
  const ac = audio()
  if (!ac) return null
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
  const ch = buf.getChannelData(0)
  // crinkly noise: white noise with random sparse spikes
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.35)
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = true
  const f = ac.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 2200
  f.Q.value = 0.8
  const g = ac.createGain()
  g.gain.value = 0
  src.connect(f).connect(g).connect(ac.destination)
  src.start()
  return {
    // speed in px/ms (0 → still, ~2 → a fast flick)
    update: (speed: number) => {
      const k = Math.min(1, Math.abs(speed) / 1.6)
      const now = ac.currentTime
      g.gain.setTargetAtTime(volume * 0.22 * Math.pow(k, 0.8), now, 0.05)
      f.frequency.setTargetAtTime(1600 + k * 3400, now, 0.06)
    },
    stop: () => {
      const now = ac.currentTime
      g.gain.setTargetAtTime(0, now, 0.06)
      setTimeout(() => {
        try {
          src.stop()
        } catch {
          // already stopped
        }
        src.disconnect()
      }, 400)
    },
  }
}
