/**
 * Gentle synthesized rain ambience (filtered noise + soft patter). No files; starts only after the
 * user has turned it on and interacted with the page.
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let nodes: AudioScheduledSourceNode[] = []

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

export function startAmbient(volume: number, intensity: number) {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  if (master) {
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

  body.start()
  patter.start()
  nodes = [body, patter]
  setAmbientVolume(volume, intensity)
}

export function setAmbientVolume(volume: number, intensity: number) {
  if (!ctx || !master) return
  master.gain.setTargetAtTime(volume * (0.25 + intensity * 0.35), ctx.currentTime, 0.8)
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
}
