import type { StageHandle } from '../puppet/geometry'
import type { ClockReading } from './acting-clock'

export type CrowdReaction = 'correct' | 'incorrect'

export const crowdSampleRate = 24_000
const turn = Math.PI * 2

/** Two small house sounds, synthesized once from original envelopes and hand-clap noise. */
export function renderCrowdReaction(reaction: CrowdReaction) {
  const rate = crowdSampleRate
  const pcm = new Float32Array(Math.round(rate * (reaction === 'correct' ? 1.03 : 0.68)))
  let seed = 82371
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x80000000 - 1
  }
  function add(start: number, length: number, sample: (t: number) => number) {
    const first = Math.round(start * rate)
    const n = Math.min(Math.round(length * rate), pcm.length - first)
    for (let i = 0; i < n; i++) {
      // A short tail at every cut keeps the little room quiet between sounds.
      const edge = Math.min(1, i / 24, (n - 1 - i) / 48)
      pcm[first + i] += sample(i / rate) * edge
    }
  }

  if (reaction === 'correct') {
    // The judge's two-note bell cuts through the ushers' applause.
    for (const [start, hz] of [[.009, 659.25], [.156, 987.77]]) {
      add(start, .27, t => .17 * Math.exp(-14 * t) * (Math.sin(turn * hz * t) + .28 * Math.sin(turn * hz * 2.01 * t)))
    }
    // Three staggered pairs of hands, with one usher who claps late.
    const hits = [.012, .055, .107, .174, .224, .283, .36, .397, .485, .546, .637, .891]
    hits.forEach((start, i) => {
      let palm = 0, air = 0
      add(start, .085, t => {
        const hiss = noise()
        palm += .21 * (hiss - palm)
        air += .74 * (hiss - air)
        const slap = Math.exp(-t * 77) + .23 * Math.exp(-Math.abs(t - .012) * 160)
        return ((air - palm) * .49 + palm * .3) * slap * (i % 3 === 1 ? .73 : 1)
      })
    })
    // A little two-person "woo", with different pitches and entrances.
    for (const [start, duration, pitch, level] of [[.09, .48, 260, .092], [.16, .39, 326, .059]]) {
      let phase = 0
      add(start, duration, t => {
        const u = t / duration
        const arch = Math.sin(Math.PI * u)
        const hz = pitch * (1 + .43 * arch + .006 * Math.sin(turn * 5.7 * t))
        phase += turn * hz / rate
        const vowel = .73 * Math.sin(phase) + .28 * Math.sin(2 * phase) + .11 * Math.sin(3 * phase)
        return level * arch ** 1.5 * vowel
      })
    }
  } else {
    for (const [start, hz] of [[.01, 167], [.17, 134]]) {
      add(start, .14, t => .11 * Math.sin(Math.PI * t / .14) * Math.tanh(2.3 * Math.sin(turn * hz * t)))
    }
    // A half-hearted raspberry loses pressure, then a folding seat knocks shut.
    let lip = 0, flutter = 0, breath = 0
    add(.018, .39, t => {
      const u = t / .39
      lip += turn * (148 - 61 * u) / rate
      flutter += turn * (38 - 15 * u + 2 * Math.sin(turn * 3 * t)) / rate
      breath += .24 * (noise() - breath)
      const pulse = .18 + .82 * ((1 + Math.sin(flutter)) / 2) ** 2
      const buzz = .53 * Math.sin(lip) + .29 * Math.sin(2 * lip) + .18 * Math.sin(3 * lip)
      return .36 * Math.sin(Math.PI * u) ** .68 * pulse * (.42 * buzz + .58 * breath)
    })
    add(.535, .09, t => .13 * Math.exp(-55 * t) * (Math.sin(turn * 187 * t) + .32 * noise()))
  }

  let peak = 0
  for (const v of pcm) peak = Math.max(peak, Math.abs(v))
  const mix = (reaction === 'correct' ? .32 : .24) / peak
  for (let i = 0; i < pcm.length; i++) pcm[i] *= mix
  return pcm
}

type ButtonSound = 'paper' | 'wood' | 'punch'
type Effect = ButtonSound | 'mutter' | 'squeak' | 'spring' | 'shoe' | 'tick' | 'doubleTick' | 'lastTicks' | 'bell' | 'room'
type Channel = 'button' | 'crowd' | 'voice' | 'puppet' | 'clock' | 'room'
type Playing = { source: AudioBufferSourceNode; gain: GainNode }
const lengths: Record<Effect, number> = {
  paper: .093, wood: .077, punch: .104, mutter: .081, squeak: .14, spring: .19, shoe: .11, tick: .06,
  doubleTick: .37, lastTicks: .44, bell: .68, room: 8,
}

/** Original mono samples. Pitch variation at playback gives the ticket punch vowels and the actor weight. */
export function renderStageEffect(effect: Effect) {
  const seconds = lengths[effect]
  const pcm = new Float32Array(Math.round(crowdSampleRate * seconds))
  let phase = 0, air = 0, seed = 92731
  for (let i = 0; i < pcm.length; i++) {
    const t = i / crowdSampleRate, u = t / seconds
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 0x80000000 - 1
    air += .075 * (noise - air)
    let sample = 0
    if (effect === 'room') {
      // Eight complete turns of the bed wrap without a splice. The creak is well away from the seam.
      const fan = Math.sin(turn * 92 * t) + .35 * Math.sin(turn * 184 * t)
      const seam = Math.min(1, i / 2000, (pcm.length - 1 - i) / 2000)
      const creak = Math.max(0, 1 - Math.abs(t - 5.8) / .28)
      sample = .017 * fan * (.8 + .2 * Math.sin(turn * 1.125 * t)) +
        seam * .048 * air + .011 * creak ** 2 * Math.sin(turn * (148 * t + 3 * Math.sin(12 * t)))
    } else if (effect === 'mutter') {
      // A little reed through a metal horn, with the vowel pinching shut at the end.
      phase += turn * (113 + 65 * Math.sin(Math.PI * u) - 24 * u) / crowdSampleRate
      const jaw = Math.sin(Math.PI * u) ** .8
      sample = .13 * jaw * (.48 * Math.sin(phase) + .35 * Math.sin(3 * phase + jaw) +
        .26 * Math.sin(5 * phase) + .14 * Math.sin(7 * phase)) + .035 * noise * Math.exp(-170 * t)
    } else if (effect === 'squeak' || effect === 'spring' || effect === 'shoe') {
      const pitch = effect === 'shoe' ? 100 - 44 * u : effect === 'spring'
        ? 175 + 74 * Math.sin(3.3 * Math.PI * u) * (1 - u) : 410 + 185 * Math.sin(Math.PI * u)
      phase += turn * pitch / crowdSampleRate
      const env = Math.sin(Math.PI * u) * Math.exp(-2.2 * u)
      sample = .16 * env * (Math.sin(phase) + .37 * Math.sin(2 * phase) + (effect === 'shoe' ? 1.6 * air : .16 * Math.sin(4 * phase)))
    } else if (effect === 'paper') {
      const brush = Math.sin(Math.PI * u) * (.65 + .35 * Math.cos(28 * u))
      sample = .12 * (noise - air) * brush
    } else if (effect === 'wood' || effect === 'punch') {
      const metal = effect === 'punch'
      const strike = metal && t > .048 ? t - .048 : t
      sample = .19 * Math.exp(-82 * strike) * (Math.sin(turn * (metal ? 670 : 260) * strike) + .35 * noise)
    } else if (effect === 'bell') {
      sample = .17 * Math.exp(-6 * t) * (Math.sin(turn * 610 * t) + .44 * Math.sin(turn * 967 * t))
    } else {
      const spacing = effect === 'lastTicks' ? .16 : .29
      const beat = Math.floor(t / spacing), pulse = t - beat * spacing
      sample = .16 * Math.exp(-100 * pulse) * (Math.sin(turn * (beat === 0 ? 840 : 1130) * pulse) + .5 * noise)
    }
    const edge = effect === 'room' ? 1 : Math.min(1, i / 25, (pcm.length - 1 - i) / 48)
    pcm[i] = sample * edge
  }
  return pcm
}

export function createCrowdAudio() {
  let context: AudioContext | undefined
  const buffers = new Map<CrowdReaction | Effect, AudioBuffer>()
  const playing = new Map<Channel, Playing>()
  let enabled = false, roomWanted = false, onstage = true
  let lastVoice = -Infinity, lastTug = -Infinity, lastMove = -Infinity, distance = 0
  let lastHandle: StageHandle | undefined, lastSecond: number | undefined

  function silence(channel: Channel) {
    const active = playing.get(channel)
    if (!active) return
    playing.delete(channel)
    try {
      const at = active.source.context.currentTime
      active.gain.gain.cancelScheduledValues(at)
      active.gain.gain.setTargetAtTime(0, at, .003)
      active.source.stop(at + .016)
    } catch { /* The device can close between two gestures. */ }
  }

  function buffer(name: CrowdReaction | Effect, ctx: AudioContext) {
    const cached = buffers.get(name)
    if (cached) return cached
    const pcm = name === 'correct' || name === 'incorrect' ? renderCrowdReaction(name) : renderStageEffect(name)
    const sample = ctx.createBuffer(1, pcm.length, crowdSampleRate)
    sample.copyToChannel(pcm, 0)
    buffers.set(name, sample)
    return sample
  }

  function play(channel: Channel, name: CrowdReaction | Effect, speed = 1, level = 1) {
    if (!onstage || !enabled || !context || context.state !== 'running') return
    try {
      silence(channel)
      const source = context.createBufferSource(), gain = context.createGain()
      source.buffer = buffer(name, context)
      source.playbackRate.value = speed
      source.loop = channel === 'room'
      gain.gain.value = level
      source.connect(gain).connect(context.destination)
      const active = { source, gain }
      source.onended = () => {
        if (playing.get(channel) === active) playing.delete(channel)
        source.disconnect()
        gain.disconnect()
      }
      playing.set(channel, active)
      source.start()
      const bed = playing.get('room')?.gain.gain
      if (bed && (channel === 'voice' || channel === 'crowd')) {
        const now = context.currentTime
        bed.cancelScheduledValues(now)
        bed.setTargetAtTime(.25, now, .02)
        bed.setTargetAtTime(1, now + (channel === 'voice' ? .18 : .8), .16)
      }
    } catch { silence(channel) }
  }

  function updateRoom() {
    if (enabled && roomWanted && onstage) {
      if (!playing.has('room')) play('room', 'room')
    } else silence('room')
  }

  function stop() {
    for (const channel of playing.keys()) silence(channel)
  }
  function dispose() {
    enabled = false
    stop()
    const previous = context
    context = undefined
    buffers.clear()
    lastVoice = lastTug = lastMove = -Infinity
    distance = 0
    if (previous && previous.state !== 'closed') void previous.close().catch(() => {})
  }
  return {
    async enable(): Promise<boolean> {
      if (typeof window === 'undefined') return false
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Audio) return false
      let active: AudioContext | undefined
      try {
        if (!context || context.state === 'closed') context = new Audio()
        active = context
        if (active.state !== 'running') await active.resume()
        if (context !== active || active.state !== 'running') return false
        enabled = true
        updateRoom()
        return true
      } catch {
        if (context === active) dispose()
        return false
      }
    },
    setRoom(wanted: boolean) { roomWanted = wanted; updateRoom() },
    setOnstage(visible: boolean) {
      onstage = visible
      if (visible) updateRoom()
      else stop()
    },
    button(sound: ButtonSound) { play('button', sound, 1, .76) },
    speak(glyph: string) {
      if (!enabled || !onstage || !context || context.currentTime - lastVoice < .086) return
      lastVoice = context.currentTime
      play('voice', 'mutter', .9 + (glyph.charCodeAt(0) % 9) * .05)
    },
    tug(handle: StageHandle, travel: number, ms: number) {
      if (!enabled || !onstage || !context || travel <= 0) return
      const now = context.currentTime
      if (handle !== lastHandle || now - lastMove > .25) distance = 0
      lastHandle = handle
      lastMove = now
      distance += travel
      if (distance < 5 || now - lastTug < .22) return
      const speed = Math.min(1, travel / Math.max(ms, 8))
      const kind = /Knee|Ankle/.test(handle) ? 'shoe' : /head|chest|waist/.test(handle) ? 'spring' : 'squeak'
      play('puppet', kind, .82 + .51 * speed, .55 + .45 * speed)
      lastTug = now
      distance = 0
    },
    clock(reading: ClockReading | null) {
      if (!reading || reading.mode === 'paused' || reading.mode === 'finished') {
        silence('clock')
        if (!reading) lastSecond = undefined
        return
      }
      if (lastSecond === reading.seconds) return
      lastSecond = reading.seconds
      if (reading.mode === 'expired') play('clock', 'bell')
      else if (reading.seconds < 45) {
        const effect = reading.seconds <= 3 ? 'lastTicks' : reading.seconds <= 10 ? 'doubleTick' : 'tick'
        play('clock', effect, 1, reading.seconds <= 10 ? .8 : .42)
      }
    },
    play(reaction: CrowdReaction) { play('crowd', reaction) },
    stopVerdict() { silence('crowd') },
    stop, dispose,
  }
}
