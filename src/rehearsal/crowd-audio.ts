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

type Playing = { source: AudioBufferSourceNode; gain: GainNode }

/** Call enable directly from a user gesture. Creating the controller itself is silent. */
export function createCrowdAudio() {
  let context: AudioContext | undefined
  let buffers: Partial<Record<CrowdReaction, AudioBuffer>> = {}
  let playing: Playing | undefined
  let enabled = false

  function stop() {
    const active = playing
    playing = undefined
    if (!active) return
    try {
      const at = active.source.context.currentTime
      active.gain.gain.setTargetAtTime(0, at, .003)
      active.source.stop(at + .012)
    } catch { /* The browser already closed this output. */ }
  }

  function dispose() {
    enabled = false
    stop()
    const previous = context
    context = undefined
    buffers = {}
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
        for (const reaction of ['correct', 'incorrect'] as const) {
          if (buffers[reaction]) continue
          const pcm = renderCrowdReaction(reaction)
          const buffer = active.createBuffer(1, pcm.length, crowdSampleRate)
          buffer.copyToChannel(pcm, 0)
          buffers[reaction] = buffer
        }
        enabled = true
        return true
      } catch {
        if (context === active) dispose()
        return false
      }
    },
    play(reaction: CrowdReaction) {
      const buffer = buffers[reaction]
      if (!enabled || !context || context.state !== 'running' || !buffer) return
      stop()
      try {
        const source = context.createBufferSource()
        const gain = context.createGain()
        source.buffer = buffer
        source.connect(gain).connect(context.destination)
        const active = { source, gain }
        source.onended = () => {
          if (playing === active) playing = undefined
          source.disconnect()
          gain.disconnect()
        }
        playing = active
        source.start()
      } catch { stop() /* The round can continue if the audio device disappears. */ }
    },
    stop,
    dispose,
  }
}
