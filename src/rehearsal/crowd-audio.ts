import type { StageHandle } from '../puppet/geometry'
import type { ClockReading } from './acting-clock'
import { renderMusic, type Track } from './pit-band'

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
/** The stage's own little noises: a clapperboard, a flung prop, a fuse, a heckler, a fanfare. */
export type StageCue = 'clack' | 'whoosh' | 'thud' | 'pop' | 'boing' | 'click' | 'zap' | 'clunk' | 'heckle' | 'sparkle' | 'fanfare' | 'rattle'
type Effect = ButtonSound | StageCue | 'mutter' | 'squeak' | 'spring' | 'shoe' | 'tick' | 'doubleTick' | 'lastTicks' | 'bell' | 'room'
type Channel = 'button' | 'crowd' | 'voice' | 'line' | 'puppet' | 'clock' | 'room' | 'fx' | 'stage'
type Playing = { source: AudioBufferSourceNode; gain: GainNode }
const lengths: Record<Effect, number> = {
  paper: .093, wood: .077, punch: .104, mutter: .081, squeak: .14, spring: .19, shoe: .11, tick: .06,
  doubleTick: .37, lastTicks: .44, bell: .68, room: 8,
  clack: .15, whoosh: .42, thud: .26, pop: .12, boing: .45, click: .045, zap: .62, clunk: .2, heckle: .38,
  sparkle: .72, fanfare: 1.45, rattle: .52,
}
// The newer cues are normalised to these peaks, in line with the button sounds.
const peaks: Partial<Record<Effect, number>> = {
  clack: .22, whoosh: .2, thud: .26, pop: .2, boing: .2, click: .12, zap: .18, clunk: .22, heckle: .2,
  sparkle: .17, fanfare: .2, rattle: .16,
}
const stageCues = Object.keys(peaks) as StageCue[]
const isStageCue = (effect: Effect): effect is StageCue => (stageCues as Effect[]).includes(effect)
/** A struck note that starts at `at` seconds and dies away at `decay` per second. */
const ping = (t: number, at: number, hz: number, decay: number) => t < at ? 0 : Math.exp(-decay * (t - at)) * Math.sin(turn * hz * (t - at))

/** One sample of a newer stage cue. `noise` is white noise; `air` and `state` carry filters between samples. */
function stageCue(effect: StageCue, t: number, u: number, noise: number, air: number, state: { phase: number; swish: number }) {
  switch (effect) {
    case 'clack': {
      // Two boards of a clapperboard, the second a hair late.
      const board = (at: number) => t < at ? 0 : Math.exp(-120 * (t - at)) * (.6 * Math.sin(turn * 1400 * (t - at)) + .5 * noise)
      return board(0) + .8 * board(.05)
    }
    case 'whoosh': {
      state.swish += (.02 + .3 * Math.sin(Math.PI * u)) * (noise - state.swish)
      return state.swish * Math.sin(Math.PI * u) ** 1.6
    }
    case 'thud': {
      state.phase += turn * (95 - 45 * u) / crowdSampleRate
      return Math.exp(-16 * t) * Math.sin(state.phase) + .25 * noise * Math.exp(-90 * t) + .4 * ping(t, .1, 70, 30)
    }
    case 'pop': {
      state.phase += turn * (900 * Math.exp(-28 * t) + 250) / crowdSampleRate
      return Math.exp(-35 * t) * Math.sin(state.phase) + .4 * noise * Math.exp(-200 * t)
    }
    case 'boing': {
      state.phase += turn * 190 * (1 + .45 * Math.sin(turn * 11 * t) * Math.exp(-5 * t)) * (1 + .15 * u) / crowdSampleRate
      return Math.exp(-4 * t) * (Math.sin(state.phase) + .3 * Math.sin(2 * state.phase))
    }
    case 'click': return Math.exp(-400 * t) * Math.sin(turn * 2200 * t)
    case 'zap': {
      // Mains hum frying in the fuse box, then the lights die with a falling whine.
      state.phase += turn * 110 * (1 - .55 * u) / crowdSampleRate
      const crackle = noise > .82 ? noise : 0
      return Math.min(1, t / .01) * Math.exp(-3.5 * t) * (.55 * Math.tanh(4 * Math.sin(state.phase)) + .45 * crackle + .2 * (noise - air))
    }
    case 'clunk': return Math.exp(-35 * t) * (Math.sin(turn * 140 * t) + .5 * Math.sin(turn * 620 * t) * Math.exp(-60 * t)) + .3 * noise * Math.exp(-150 * t)
    case 'heckle': {
      // "Oi!": a gruff voice sliding from an open O to a pinched I.
      const pitch = 175 - 45 * u
      state.phase += turn * pitch / crowdSampleRate
      const vowel = Math.min(1, Math.max(0, (u - .35) / .25))
      const first = 550 - 250 * vowel, second = 900 + 1400 * vowel
      let voice = 0
      for (let k = 1; k <= 16; k++) {
        const partial = k * pitch
        voice += Math.sin(k * state.phase) * (Math.exp(-(((partial - first) / 180) ** 2)) + .7 * Math.exp(-(((partial - second) / 260) ** 2)) + .15 / k)
      }
      return Math.sin(Math.PI * u) ** .6 * voice
    }
    case 'sparkle': return [1047, 1319, 1568, 2093].reduce((sum, hz, i) =>
      sum + ping(t, i * .06, hz, 9) + .35 * ping(t, i * .06, hz * 2.76, 14), 0)
    case 'fanfare': {
      // Four bright brass notes up to a held top note, and a splash of cymbal under it.
      let sound = 0
      for (const [at, held, hz] of [[0, .16, 392], [.17, .16, 523.25], [.34, .16, 659.25], [.51, .75, 783.99]]) {
        if (t < at) continue
        const s = t - at
        const env = Math.min(1, s / .02) * (s < held ? 1 : Math.exp(-(s - held) * 10))
        const bright = .4 + .6 * Math.exp(-5 * s)
        for (let k = 1; k <= 6; k++) sound += env * Math.sin(turn * k * hz * s) * (k === 1 ? 1 : bright / k)
      }
      return sound + (t > .51 ? .6 * (noise - air) * Math.exp(-4 * (t - .51)) : 0)
    }
    case 'rattle': return [0, .055, .1, .16, .21, .27, .33, .38, .44].reduce((sum, at) =>
      sum + (t < at ? 0 : Math.exp(-150 * (t - at)) * (Math.sin(turn * 950 * (t - at)) + .5 * noise)), 0)
  }
}

/** Original mono samples. Pitch variation at playback gives the ticket punch vowels and the actor weight. */
export function renderStageEffect(effect: Effect) {
  const seconds = lengths[effect]
  const pcm = new Float32Array(Math.round(crowdSampleRate * seconds))
  let phase = 0, air = 0, seed = 92731
  const state = { phase: 0, swish: 0 }
  for (let i = 0; i < pcm.length; i++) {
    const t = i / crowdSampleRate, u = t / seconds
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 0x80000000 - 1
    air += .075 * (noise - air)
    let sample = 0
    if (isStageCue(effect)) sample = stageCue(effect, t, u, noise, air, state)
    else if (effect === 'room') {
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
  const target = peaks[effect]
  if (target) {
    let peak = 0
    for (const value of pcm) peak = Math.max(peak, Math.abs(value))
    if (peak) for (let i = 0; i < pcm.length; i++) pcm[i] *= target / peak
  }
  return pcm
}

/** The pit band plays this far under everything else, and dips further while anyone speaks. */
const musicLevel = .15
const musicDuck = .35

export function createCrowdAudio() {
  let context: AudioContext | undefined
  const buffers = new Map<CrowdReaction | Effect, AudioBuffer>()
  const playing = new Map<Channel, Playing>()
  let enabled = false, roomWanted = false, onstage = true
  let musicWanted = true, track: Track | null = null
  let band: (Playing & { track: Track }) | undefined
  const scores = new Map<Track, AudioBuffer>()
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
    start(channel, buffer(name, context), speed, level)
  }

  function start(channel: Channel, sample: AudioBuffer, speed = 1, level = 1) {
    if (!onstage || !enabled || !context || context.state !== 'running') return false
    try {
      silence(channel)
      const source = context.createBufferSource(), gain = context.createGain()
      source.buffer = sample
      source.playbackRate.value = speed
      source.loop = channel === 'room'
      gain.gain.value = level
      // Two separate calls, so an engine whose connect() returns nothing still plays.
      source.connect(gain)
      gain.connect(context.destination)
      const active = { source, gain }
      source.onended = () => {
        if (playing.get(channel) === active) playing.delete(channel)
        source.disconnect()
        gain.disconnect()
      }
      playing.set(channel, active)
      source.start()
      if (channel === 'voice' || channel === 'line' || channel === 'crowd') {
        const now = context.currentTime, back = now + (channel === 'line' ? sample.duration : channel === 'voice' ? .18 : .8)
        const bed = playing.get('room')?.gain.gain
        if (bed) {
          bed.cancelScheduledValues(now)
          bed.setTargetAtTime(.25, now, .02)
          bed.setTargetAtTime(1, back, .16)
        }
        // The band drops under Stubbs and the crowd, then comes back up.
        const music = band?.gain.gain
        if (music) {
          music.cancelScheduledValues(now)
          music.setTargetAtTime(musicLevel * musicDuck, now, .04)
          music.setTargetAtTime(musicLevel, back, .3)
        }
      }
      return true
    } catch {
      silence(channel)
      return false
    }
  }

  function updateRoom() {
    if (enabled && roomWanted && onstage) {
      if (!playing.has('room')) play('room', 'room')
    } else silence('room')
  }

  /** Fades the old tune out and the night's tune in. Each arrangement is rendered once, on first use. */
  function updateMusic() {
    const wanted = enabled && musicWanted && onstage && context && context.state === 'running' ? track : null
    if (band?.track === wanted) return
    const old = band
    band = undefined
    if (old) {
      try {
        const at = old.source.context.currentTime
        old.gain.gain.cancelScheduledValues(at)
        old.gain.gain.setTargetAtTime(0, at, .18)
        old.source.stop(at + .9)
      } catch { /* The device can close between two gestures. */ }
    }
    if (!wanted || !context) return
    try {
      let score = scores.get(wanted)
      if (!score) {
        const pcm = renderMusic(wanted, crowdSampleRate)
        score = context.createBuffer(1, pcm.length, crowdSampleRate)
        score.copyToChannel(pcm, 0)
        scores.set(wanted, score)
      }
      const source = context.createBufferSource(), gain = context.createGain()
      source.buffer = score
      source.loop = true
      gain.gain.value = 0
      gain.gain.setTargetAtTime(musicLevel, context.currentTime, .4)
      source.connect(gain)
      gain.connect(context.destination)
      const tune = { source, gain, track: wanted }
      source.onended = () => {
        if (band === tune) band = undefined
        source.disconnect()
        gain.disconnect()
      }
      band = tune
      source.start()
    } catch { band = undefined }
  }

  function stop() {
    for (const channel of playing.keys()) silence(channel)
    if (band) {
      try { band.source.stop() } catch { /* Already stopped. */ }
      band = undefined
    }
  }
  function dispose() {
    enabled = false
    stop()
    const previous = context
    context = undefined
    buffers.clear()
    scores.clear()
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
        if (!context || context.state === 'closed') {
          const fresh = new Audio()
          // Safari can pause a long-lived context on its own. When it runs again, the room tone and the
          // band come back; both start only on a running context.
          fresh.onstatechange = () => {
            if (context === fresh && enabled && fresh.state === 'running') { updateRoom(); updateMusic() }
          }
          context = fresh
        }
        active = context
        if (active.state !== 'running') await active.resume()
        if (context !== active || active.state !== 'running') return false
        enabled = true
        updateRoom()
        updateMusic()
        return true
      } catch {
        if (context === active) dispose()
        return false
      }
    },
    /** Resumes a context the browser paused while sound stayed on. Safari allows this only inside a click or key press. */
    wake() {
      const active = context
      if (!enabled || !active || active.state === 'running' || active.state === 'closed') return
      void active.resume().then(() => { if (context === active) { updateRoom(); updateMusic() } }, () => {})
    },
    setRoom(wanted: boolean) { roomWanted = wanted; updateRoom() },
    /** Whether the pit band plays at all. */
    setMusic(wanted: boolean) { musicWanted = wanted; updateMusic() },
    /** Which arrangement the band should be playing: the lobby tune, or tonight's. */
    music(next: Track | null) { track = next; updateMusic() },
    setOnstage(visible: boolean) {
      onstage = visible
      if (visible) { updateRoom(); updateMusic() }
      else stop()
    },
    /** A stage cue on its own channel, so it never cuts off a button or Stubbs. */
    effect(cue: StageCue, level = 1) { play(['zap', 'clunk', 'whoosh', 'thud', 'heckle', 'rattle'].includes(cue) ? 'stage' : 'fx', cue, 1, level) },
    button(sound: ButtonSound) { play('button', sound, 1, .76) },
    /** Decodes Stubbs's recorded line once stage sound is on. Undefined if this browser cannot. */
    async prepareLine(bytes: ArrayBuffer): Promise<AudioBuffer | undefined> {
      const active = context
      if (!enabled || !active || active.state !== 'running') return undefined
      try { return await active.decodeAudioData(bytes.slice(0)) } catch { return undefined }
    },
    /** Plays the recorded line; the ticket punch's tin syllables stay quiet underneath it. */
    speakLine(sample: AudioBuffer) { return start('line', sample) },
    speak(glyph: string) {
      if (!enabled || !onstage || !context || playing.has('line') || context.currentTime - lastVoice < .086) return
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
