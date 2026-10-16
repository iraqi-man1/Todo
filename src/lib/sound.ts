/**
 * Tiny synthesized sound effects (Web Audio). No audio files, nothing autoplays: every sound is
 * triggered by a user action and only when the user has turned sounds on.
 */
import { usePrefs } from '@/store/prefs'
import { haptic, type Haptic } from './haptics'

export type SoundName = 'tap' | 'pencil' | 'paper' | 'pin' | 'chime'

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
const HAPTIC: Partial<Record<SoundName, Haptic>> = { pencil: 'tap', pin: 'pin', chime: 'success' }

export function playSound(name: SoundName, force = false) {
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
    case 'pin':
      burst(ac, master, t, 0.05, 900, 3, 0.7)
      tone(ac, master, t, 1320, 0.12, 0.05)
      break
    case 'chime':
      tone(ac, master, t, 784, 0.9, 0.12)
      tone(ac, master, t + 0.09, 988, 0.9, 0.1)
      tone(ac, master, t + 0.18, 1319, 1.2, 0.08)
      break
  }
}
