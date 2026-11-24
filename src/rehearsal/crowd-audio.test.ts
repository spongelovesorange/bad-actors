import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCrowdAudio, crowdSampleRate, renderCrowdReaction } from './crowd-audio'

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
      createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setTargetAtTime: vi.fn() } })
      createBufferSource = () => ({ context: this, start, stop, disconnect: vi.fn(), connect: (node: unknown) => node })
    }
    vi.stubGlobal('window', { AudioContext: TestAudioContext })
    const house = createCrowdAudio()
    house.play('correct')
    expect(start).not.toHaveBeenCalled()
    expect(await house.enable()).toBe(true)
    expect(resumed).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(fill).toHaveBeenCalledTimes(2)
    house.play('correct')
    house.play('incorrect')
    expect(start).toHaveBeenCalledTimes(2)
    expect(stop).toHaveBeenCalledTimes(1)
    house.dispose()
    house.play('correct')
    expect(stop).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledTimes(2)
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
