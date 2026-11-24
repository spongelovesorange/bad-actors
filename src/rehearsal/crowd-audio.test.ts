import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCrowdAudio, crowdSampleRate, renderCrowdReaction, renderStageEffect } from './crowd-audio'
import { renderMusic, trackSeconds, type Track } from './pit-band'

afterEach(() => vi.unstubAllGlobals())

describe('the audience in the cheap seats', () => {
  it('renders two finite, quiet reactions with an audible performance and silent endings', () => {
    for (const [reaction, seconds, limit] of [['correct', 1.03, .32], ['incorrect', .68, .24]] as const) {
      const pcm = renderCrowdReaction(reaction)
      expect(pcm.length).toBe(Math.round(crowdSampleRate * seconds))
      expect(Math.max(...pcm.map(Math.abs))).toBeCloseTo(limit, 5)
      expect(pcm.slice(0, 100).every(x => x === 0)).toBe(true)
      expect(pcm.slice(-500).every(x => x === 0)).toBe(true)
      const rms = Math.sqrt(pcm.reduce((sum, v) => sum + v * v, 0) / pcm.length)
      expect(rms).toBeGreaterThan(.018)
      expect(rms).toBeLessThan(.12)
    }
  })

  it('leaves a comic pause before the chair knocks shut', () => {
    const pcm = renderCrowdReaction('incorrect')
    const region = (a: number, b: number) => pcm.subarray(a * crowdSampleRate, b * crowdSampleRate)
    expect(region(.42, .52).every(x => x === 0)).toBe(true)
    expect(region(.54, .56).some(x => Math.abs(x) > .01)).toBe(true)
  })

  it('stays silent until opted in, reuses its samples, and stops and closes on mute', async () => {
    const start = vi.fn(), stop = vi.fn(), close = vi.fn().mockResolvedValue(undefined)
    const fill = vi.fn(), resumed = vi.fn()
    class TestAudioContext {
      currentTime = 1
      state = 'suspended'
      destination = {}
      close = close
      resume = async () => { this.state = 'running'; resumed() }
      createBuffer = () => ({ copyToChannel: fill })
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } })
      createBufferSource = () => ({ context: this, start, stop, playbackRate: { value: 1 }, disconnect: vi.fn(), connect: (node: unknown) => node })
    }
    vi.stubGlobal('window', { AudioContext: TestAudioContext })
    const house = createCrowdAudio()
    house.play('correct')
    expect(start).not.toHaveBeenCalled()
    expect(await house.enable()).toBe(true)
    expect(resumed).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(fill).not.toHaveBeenCalled()
    house.play('correct')
    house.play('incorrect')
    expect(fill).toHaveBeenCalledTimes(2)
    expect(start).toHaveBeenCalledTimes(2)
    expect(stop).toHaveBeenCalledTimes(1)
    house.dispose()
    house.play('correct')
    expect(stop).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('decodes Stubbs’s recorded line only with sound on and keeps the tin syllables quiet while it plays', async () => {
    const start = vi.fn()
    const decoded = { duration: 2.5 }
    let ended: (() => void) | undefined
    class TestAudioContext {
      currentTime = 1
      state = 'suspended'
      destination = {}
      close = vi.fn().mockResolvedValue(undefined)
      resume = async () => { this.state = 'running' }
      decodeAudioData = vi.fn(async () => decoded)
      createBuffer = () => ({ copyToChannel: vi.fn() })
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } })
      createBufferSource = () => {
        const source = { context: this, start, stop: vi.fn(), playbackRate: { value: 1 }, disconnect: vi.fn(),
          connect: (node: unknown) => node, buffer: undefined as unknown, set onended(done: () => void) { if (source.buffer === decoded) ended = done } }
        return source
      }
    }
    vi.stubGlobal('window', { AudioContext: TestAudioContext })
    const house = createCrowdAudio()
    expect(await house.prepareLine(new ArrayBuffer(8))).toBeUndefined()
    expect(await house.enable()).toBe(true)
    const line = await house.prepareLine(new ArrayBuffer(8))
    expect(line).toBe(decoded)
    expect(house.speakLine(line!)).toBe(true)
    expect(start).toHaveBeenCalledTimes(1)
    house.speak('a')
    expect(start).toHaveBeenCalledTimes(1)
    ended!()
    house.speak('a')
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('paces the jaw and joints, pauses clock sounds, and resumes only the room on return', async () => {
    let now = 0
    const starts: { loop: boolean; duration: number }[] = []
    const stops = vi.fn(), ducks = vi.fn()
    class Audio {
      state = 'running'
      get currentTime() { return now }
      destination = {}
      createBuffer = (_channels: number, length: number) => ({ duration: length / crowdSampleRate, copyToChannel: vi.fn() })
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { cancelScheduledValues: vi.fn(), setTargetAtTime: ducks } })
      createBufferSource() {
        return { context: this, loop: false, buffer: { duration: 0 }, playbackRate: { value: 1 }, disconnect: vi.fn(),
          connect: (next: unknown) => next, start() { starts.push({ loop: this.loop, duration: this.buffer.duration }) }, stop: stops }
      }
      close = vi.fn().mockResolvedValue(undefined)
    }
    vi.stubGlobal('window', { AudioContext: Audio })
    const desk = createCrowdAudio()
    desk.setRoom(true)
    desk.tug('waist', 20, 16)
    desk.speak('A')
    expect(starts).toHaveLength(0)
    await desk.enable()
    desk.setRoom(true)
    expect(starts).toEqual([{ loop: true, duration: 8 }])
    desk.speak('a'); desk.speak('b')
    desk.tug('leftKnee', 2, 16); desk.tug('leftKnee', 4, 16); desk.tug('leftKnee', 10, 16)
    expect(starts.map(sound => sound.duration)).toEqual([8, .081, .11])
    expect(ducks).toHaveBeenCalledWith(.25, 0, .02)
    now = 1
    desk.clock({ seconds: 11, mode: 'running' })
    desk.clock({ seconds: 10, mode: 'running' })
    desk.clock({ seconds: 10, mode: 'paused' })
    desk.clock({ seconds: 10, mode: 'running' })
    desk.clock({ seconds: 3, mode: 'running' })
    desk.clock({ seconds: 0, mode: 'expired' })
    expect(starts.slice(3).map(sound => sound.duration)).toEqual([.06, .37, .44, .68])
    desk.setOnstage(false)
    desk.speak('x'); desk.tug('head', 20, 10)
    desk.setOnstage(true)
    expect(starts).toHaveLength(8)
    expect(starts.at(-1)?.loop).toBe(true)
    desk.setRoom(false)
    desk.setOnstage(false); desk.setOnstage(true)
    expect(starts).toHaveLength(8)
    desk.dispose()
    expect(stops).toHaveBeenCalled()
  })

  it('renders each stage effect with bounded, finite samples', () => {
    for (const effect of ['paper','wood','punch','mutter','squeak','spring','shoe','tick','doubleTick','lastTicks','bell','room'] as const) {
      const pcm = renderStageEffect(effect)
      const peak = pcm.reduce((max, v) => Math.max(max, Math.abs(v)), 0)
      expect(peak).toBeGreaterThan(.01)
      expect(peak).toBeLessThan(.4)
      expect(Math.abs(pcm[0] - pcm[pcm.length - 1])).toBeLessThan(.001)
    }
  })

  it('renders the stage cues at their set peaks, with clean edges', () => {
    const peaks = { clack: .22, whoosh: .2, thud: .26, pop: .2, boing: .2, click: .12, zap: .18, clunk: .22, heckle: .2, sparkle: .17, fanfare: .2, rattle: .16 }
    for (const [effect, peak] of Object.entries(peaks) as [keyof typeof peaks, number][]) {
      const pcm = renderStageEffect(effect)
      expect(pcm.every(Number.isFinite)).toBe(true)
      expect(pcm.reduce((max, v) => Math.max(max, Math.abs(v)), 0)).toBeCloseTo(peak, 5)
      expect(Math.abs(pcm[0])).toBeLessThan(.02)
      expect(Math.abs(pcm[pcm.length - 1])).toBeLessThan(.001)
    }
  })

  it('arranges one tune six ways, each a seamless loop at half scale', () => {
    const tracks: Track[] = ['lobby', 'opening', 'props', 'feelings', 'blackout', 'gala']
    for (const track of tracks) {
      const pcm = renderMusic(track, crowdSampleRate)
      expect(pcm.length).toBe(Math.round(trackSeconds(track) * crowdSampleRate))
      expect(pcm.every(Number.isFinite)).toBe(true)
      expect(pcm.reduce((max, v) => Math.max(max, Math.abs(v)), 0)).toBeCloseTo(.5, 5)
      const rms = Math.sqrt(pcm.reduce((sum, v) => sum + v * v, 0) / pcm.length)
      expect(rms).toBeGreaterThan(.03)
      // The seam is no rougher than the music itself: notes ringing past the end wrapped round.
      let roughest = 0
      for (let i = 1; i < pcm.length; i++) roughest = Math.max(roughest, Math.abs(pcm[i] - pcm[i - 1]))
      expect(Math.abs(pcm[0] - pcm[pcm.length - 1])).toBeLessThanOrEqual(roughest)
    }
    expect(new Set(tracks.map(trackSeconds)).size).toBe(tracks.length)
  })

  it('plays the night’s tune on a loop, keeps it through repeats, ducks it for Stubbs and stops it on request', async () => {
    const starts: { loop: boolean }[] = []
    const stops = vi.fn(), levels = vi.fn()
    class Audio {
      state = 'running'
      currentTime = 0
      destination = {}
      createBuffer = (_channels: number, length: number) => ({ duration: length / crowdSampleRate, copyToChannel: vi.fn() })
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1, cancelScheduledValues: vi.fn(), setTargetAtTime: levels } })
      createBufferSource() {
        return { context: this, loop: false, buffer: { duration: 1 }, playbackRate: { value: 1 }, disconnect: vi.fn(),
          connect: (next: unknown) => next, start() { starts.push({ loop: this.loop }) }, stop: stops }
      }
      close = vi.fn().mockResolvedValue(undefined)
    }
    vi.stubGlobal('window', { AudioContext: Audio })
    const desk = createCrowdAudio()
    desk.music('opening')
    expect(starts).toHaveLength(0)
    await desk.enable()
    expect(starts).toEqual([{ loop: true }])
    desk.music('opening')
    expect(starts).toHaveLength(1)
    desk.speak('a')
    expect(levels).toHaveBeenCalledWith(.15 * .35, 0, .04)
    desk.music('gala')
    expect(starts.at(-1)).toEqual({ loop: true })
    expect(stops).toHaveBeenCalled()
    const before = starts.length
    desk.setMusic(false)
    desk.music('lobby')
    expect(starts).toHaveLength(before)
    desk.effect('clack')
    expect(starts).toHaveLength(before + 1)
    desk.dispose()
  })

  it('plays in Safari, whose connect() returns nothing to chain from', async () => {
    const starts: { loop: boolean }[] = []
    const wired = vi.fn()
    class SafariAudio {
      state = 'running'
      currentTime = 0
      destination = { kind: 'speakers' }
      createBuffer = (_channels: number, length: number) => ({ duration: length / crowdSampleRate, copyToChannel: vi.fn() })
      createGain = () => ({ connect: (node: unknown) => { wired(node) }, disconnect: vi.fn(), gain: { value: 1, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() } })
      createBufferSource() {
        return { context: this, loop: false, buffer: { duration: 1 }, playbackRate: { value: 1 }, disconnect: vi.fn(),
          connect: () => undefined, start() { starts.push({ loop: this.loop }) }, stop: vi.fn() }
      }
      close = vi.fn().mockResolvedValue(undefined)
    }
    vi.stubGlobal('window', { AudioContext: SafariAudio })
    const desk = createCrowdAudio()
    desk.setRoom(true)
    desk.music('lobby')
    expect(await desk.enable()).toBe(true)
    desk.button('punch')
    expect(starts).toEqual([{ loop: true }, { loop: true }, { loop: false }])
    expect(wired).toHaveBeenCalledWith({ kind: 'speakers' })
    desk.dispose()
  })

  it('leaves the stage usable without a browser audio device', async () => {
    vi.stubGlobal('window', {})
    const house = createCrowdAudio()
    expect(await house.enable()).toBe(false)
    expect(() => { house.play('incorrect'); house.dispose() }).not.toThrow()
  })

  it('cannot turn sound back on if a pending activation finishes after muting', async () => {
    let allow: () => void = () => {}
    const fill = vi.fn()
    class SlowContext {
      state = 'suspended'
      resume = () => new Promise<void>(resolve => { allow = () => { this.state = 'running'; resolve() } })
      close = vi.fn().mockResolvedValue(undefined)
      createBuffer = fill
    }
    vi.stubGlobal('window', { AudioContext: SlowContext })
    const house = createCrowdAudio()
    const activation = house.enable()
    house.dispose()
    allow()
    expect(await activation).toBe(false)
    expect(fill).not.toHaveBeenCalled()
  })
})
