import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudienceError, AudienceRound, localAudience, quietAudience, type AudienceState, type Guess, type Verdict } from './audience-round'
import { drawAnotherCue, type ClockReading } from './acting-clock'

type Frame = { roundId: string; observationId: string; image: string }

function reply(frame: Frame, used: number, verdict: Verdict = 'incorrect'): Guess {
  return { roundId: frame.roundId, observationId: frame.observationId, used, limit: 5, guess: 'Making a call', verdict }
}

function deferred<T>() {
  let resolve!: (result: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function booth(timed = false, heardAt?: (observationId: string) => number | undefined, waitForAsk = false) {
  const stage = { settled: true, visible: true, image: 'first image' }
  let used = 0
  let state: AudienceState = quietAudience
  const start = vi.fn(async () => ({ roundId: 'current', limit: 5 }))
  const observe = vi.fn<typeof localAudience.observe>(async frame => reply(frame, ++used))
  const capture = vi.fn(async () => stage.image)
  const times: ClockReading[] = []
  const round = new AudienceRound(3, { start, observe }, () => stage.settled, capture, s => { state = s }, () => stage.visible,
    timed ? reading => { times.push(reading) } : undefined, heardAt, waitForAsk)
  return { start, observe, capture, stage, round, times, state: () => state }
}

describe('AI audience at the stage', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

  it('enters free, waits for a stable visible authored pose and captures only the newest pose', async () => {
    const b = booth()
    await b.round.start()
    await vi.advanceTimersByTimeAsync(8000)
    expect(b.observe).not.toHaveBeenCalled()
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(600)
    b.stage.settled = false
    b.stage.image = 'second pose'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(900)
    expect(b.capture).not.toHaveBeenCalled()
    b.stage.settled = true
    b.stage.visible = false
    await vi.advanceTimersByTimeAsync(100)
    expect(b.capture).not.toHaveBeenCalled()
    b.stage.visible = true
    b.round.schedule()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.capture).toHaveBeenCalledTimes(1)
    expect(b.observe.mock.calls[0][0].image).toBe('second pose')
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(4000)
    expect(b.observe).toHaveBeenCalledTimes(1)
  })

  it('lets the player finish a pose: moving never sends a look until Ready is pressed', async () => {
    const b = booth(false, undefined, true)
    await b.round.start()
    b.stage.image = 'half a pose'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(8000)
    expect(b.observe).not.toHaveBeenCalled()
    b.stage.image = 'the finished pose'
    b.round.poseChanged()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(100)
    expect(b.observe.mock.calls.map(([frame]) => frame.image)).toEqual(['the finished pose'])
    b.stage.image = 'another pose'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(8000)
    expect(b.observe).toHaveBeenCalledTimes(1)
  })

  it('keeps Stubbs’s spoken line beside the scored guess and drops a malformed one', async () => {
    const b = booth()
    const line = 'A call! Tell them I want my cushion back.'
    b.observe.mockImplementationOnce(async (frame, _signal, onGuess) => {
      onGuess({ roundId: frame.roundId, observationId: frame.observationId, used: 1, limit: 5, guess: 'Making a call', line })
      return { ...reply(frame, 1), line }
    }).mockImplementationOnce(async frame => ({ ...reply(frame, 2), line: 'x'.repeat(300) }))
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(1000)
    expect(b.state().history[0]).toMatchObject({ guess: 'Making a call', line })
    b.stage.image = 'second pose'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(5000)
    expect(b.state().history).toHaveLength(2)
    expect(b.state().history[1].line).toBeUndefined()
  })

  it('shows an already posed actor once, even if the free round start needs a retry', async () => {
    const b = booth()
    b.stage.image = 'cup at the mouth'
    b.start.mockRejectedValueOnce(new TypeError('offline'))
    await b.round.start(true)
    expect(b.observe).not.toHaveBeenCalled()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(5000)
    expect(b.observe.mock.calls.map(([frame]) => frame.image)).toEqual(['cup at the mouth'])
  })

  it('drops a frame if the player moves while it is being encoded', async () => {
    const b = booth()
    const encoding = deferred<string>()
    b.capture.mockImplementationOnce(() => encoding.promise)
    await b.round.start()
    b.round.ask()
    b.stage.image = 'updated pose'
    b.round.poseChanged()
    encoding.resolve('discarded frame')
    await vi.advanceTimersByTimeAsync(699)
    expect(b.observe).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(b.observe.mock.calls.map(([frame]) => frame.image)).toEqual(['updated pose'])
  })

  it('keeps one look in flight and enforces four seconds before showing the latest pose', async () => {
    const b = booth()
    const first = deferred<Guess>()
    b.observe.mockImplementationOnce(() => first.promise)
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    for (const image of ['middle', 'last']) {
      b.stage.image = image
      b.round.poseChanged()
      await vi.advanceTimersByTimeAsync(800)
    }
    expect(b.observe).toHaveBeenCalledTimes(1)
    first.resolve(reply(b.observe.mock.calls[0][0], 1))
    await vi.advanceTimersByTimeAsync(2399)
    expect(b.observe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(b.observe.mock.calls.map(([frame]) => frame.image)).toEqual(['first image', 'last'])
    expect(b.state().history.map(entry => entry.image)).toEqual(['first image', 'last'])
  })

  it('accepts an earlier correct pose in the same round and ignores replies after departure', async () => {
    for (const leave of [true, false]) {
      const b = booth()
      const first = deferred<Guess>()
      b.observe.mockImplementationOnce(() => first.promise)
      await b.round.start()
      b.round.ask()
      await vi.advanceTimersByTimeAsync(0)
      b.stage.image = 'next pose'
      b.round.poseChanged()
      if (leave) b.round.dispose()
      first.resolve(reply(b.observe.mock.calls[0][0], 1, 'correct'))
      await vi.advanceTimersByTimeAsync(8000)
      expect(b.observe).toHaveBeenCalledTimes(1)
      expect(b.state().history.length).toBe(leave ? 0 : 1)
      if (!leave) expect(b.state().phase).toBe('complete')
    }
  })

  it('retries a lost response with its original snapshot and id, only on request', async () => {
    const b = booth()
    b.observe.mockRejectedValueOnce(new TypeError('connection lost'))
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    b.stage.image = 'another gesture'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(6000)
    expect(b.state().phase).toBe('error')
    expect(b.state().issue).toBe('I can’t reach the local game.')
    expect(b.state().message).toMatch(/same picture/)
    expect(b.observe).toHaveBeenCalledTimes(1)
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.observe.mock.calls[1][0]).toEqual(b.observe.mock.calls[0][0])
    expect(b.capture).toHaveBeenCalledTimes(1)
  })

  it('publishes the blind guess before the referee and keeps the acting clock paused', async () => {
    const b = booth(true)
    const score = deferred<Guess>()
    b.observe.mockImplementationOnce(async (frame, _signal, speak) => {
      speak(reply(frame, 1))
      return score.promise
    })
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.state()).toMatchObject({ phase: 'looking', pendingGuess: { guess: 'Making a call' }, used: 1, history: [] })
    b.stage.visible = false
    b.stage.image = 'new position'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(50_000)
    expect(b.times.at(-1)).toEqual({ mode: 'paused', seconds: 45 })
    score.resolve(reply(b.observe.mock.calls[0][0], 1, 'unjudged'))
    await vi.advanceTimersByTimeAsync(0)
    expect(b.state().pendingGuess).toBeUndefined()
    expect(b.state().history.at(-1)).toMatchObject({ verdict: 'unjudged', guess: 'Making a call' })
    expect(b.observe).toHaveBeenCalledTimes(1)
  })

  it('gives the finished line and its verdict time on stage before sending the newest queued pose', async () => {
    const heard = new Map<string, number>()
    const b = booth(false, id => heard.get(id))
    const score = deferred<Guess>()
    b.observe.mockImplementationOnce(() => score.promise)
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    b.stage.image = 'new pose'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(5100)
    const first = b.observe.mock.calls[0][0]
    score.resolve(reply(first, 1))
    await vi.advanceTimersByTimeAsync(1800)
    expect(b.observe).toHaveBeenCalledTimes(1)
    heard.set(first.observationId, Date.now())
    await vi.advanceTimersByTimeAsync(749)
    expect(b.observe).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2)
    expect(b.observe.mock.calls.map(([frame]) => frame.image)).toEqual(['first image', 'new pose'])
  })

  it('keeps the spoken fifth look after a broken stream and retrieves only its original score', async () => {
    const b = booth()
    await b.round.start()
    for (let n = 1; n <= 4; n++) {
      b.stage.image = 'pose ' + n
      b.round.poseChanged()
      await vi.advanceTimersByTimeAsync(4100)
    }
    b.observe.mockImplementationOnce(async (frame, _signal, speak) => {
      speak(reply(frame, 5))
      throw new Error('Truncated stream')
    })
    b.stage.image = 'pose 5'
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(4100)
    expect(b.state()).toMatchObject({ used: 5, phase: 'error', pendingGuess: { guess: 'Making a call' } })
    expect(b.state().history).toHaveLength(4)
    b.observe.mockImplementationOnce(async (frame, _signal, speak) => {
      speak(reply(frame, 5))
      return reply(frame, 5, 'correct')
    })
    b.round.ask()
    await vi.advanceTimersByTimeAsync(4000)
    expect(b.capture).toHaveBeenCalledTimes(5)
    expect(b.observe.mock.calls[5][0]).toEqual(b.observe.mock.calls[4][0])
    expect(b.state()).toMatchObject({ used: 5, phase: 'complete', pendingGuess: undefined })
    expect(b.state().history).toHaveLength(5)
  })

  it.each(['mismatched ID', 'changed words', 'discarded round'])('cannot score a %s', async fault => {
    const b = booth()
    b.observe.mockImplementationOnce(async (frame, _signal, speak) => {
      const guess = reply(frame, 1)
      if (fault === 'discarded round') b.round.dispose()
      speak(fault === 'mismatched ID' ? { ...guess, observationId: 'other' } : guess)
      return { ...guess, guess: 'Different action', verdict: 'correct' }
    })
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.state().history).toHaveLength(0)
    expect(b.state().phase).not.toBe('complete')
    expect(b.state().pendingGuess?.guess).toBe(fault === 'changed words' ? 'Making a call' : undefined)
  })

  it('distinguishes an unconnected start from a local camera failure without spending a look', async () => {
    const b = booth()
    b.start.mockRejectedValueOnce(new TypeError('fetch failed'))
    await b.round.start()
    expect(b.state().message).toMatch(/to start. No look was used/)
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    b.capture.mockRejectedValueOnce(new TypeError('Image decode failed'))
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.state()).toMatchObject({ phase: 'error', used: 0, issue: 'I couldn’t take a picture of the stage.' })
    expect(b.observe).not.toHaveBeenCalled()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.state().issue).toBeUndefined()
    expect(b.observe).toHaveBeenCalledTimes(1)
  })

  it('explains a counted image-model timeout and waits for an edited pose', async () => {
    const b = booth()
    b.observe.mockRejectedValueOnce(new AudienceError('Provider error', 502, 'vision_failed', 1, 'timeout'))
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.state()).toMatchObject({ issue: 'The image model took too long to reply.', recovery: 'change-pose', used: 1 })
    expect(b.state().message).toContain('This look was counted.')
    b.round.ask()
    await vi.advanceTimersByTimeAsync(5000)
    expect(b.capture).toHaveBeenCalledTimes(1)
    b.stage.image = 'changed'
    b.round.poseChanged()
    expect(b.state().issue).toBeUndefined()
    await vi.advanceTimersByTimeAsync(700)
    expect(b.observe).toHaveBeenCalledTimes(2)
  })

  it.each(['same_pose', 'vision_failed', 'observation_conflict'])('discards the rejected frame after %s', async (code) => {
    const b = booth()
    b.observe.mockRejectedValueOnce(new AudienceError('Change your pose.', code === 'vision_failed' ? 502 : 409, code, 1))
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    b.stage.image = 'different photograph'
    b.round.poseChanged()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(4100)
    expect(b.observe.mock.calls[1][0].observationId).not.toBe(b.observe.mock.calls[0][0].observationId)
    expect(b.observe.mock.calls[1][0].image).toBe('different photograph')
  })

  it('offers a fresh free round on an expired cookie and keeps the actor where the player left it', async () => {
    const b = booth()
    b.observe.mockRejectedValueOnce(new AudienceError('Round ended', 409, 'stale_round'))
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(5000)
    expect(b.state().recovery).toBe('restart')
    expect(b.start).toHaveBeenCalledTimes(1)
    b.start.mockResolvedValueOnce({ roundId: 'replacement', limit: 5 })
    b.round.ask()
    await vi.advanceTimersByTimeAsync(5000)
    expect(b.state().phase).toBe('ready')
    expect(b.observe).toHaveBeenCalledTimes(1)
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.observe.mock.calls[1][0].roundId).toBe('replacement')
    expect(b.observe.mock.calls[1][0].image).toBe(b.observe.mock.calls[0][0].image)
  })

  it('reaches curtain time on the fifth missed look and retains all five photos without another request', async () => {
    const b = booth()
    await b.round.start()
    for (let i = 1; i <= 6; i++) {
      b.stage.image = 'pose ' + i
      b.round.poseChanged()
      await vi.advanceTimersByTimeAsync(4100)
    }
    b.round.ask()
    await vi.advanceTimersByTimeAsync(4100)
    expect(b.state().phase).toBe('complete')
    expect(b.state().history).toHaveLength(5)
    expect(b.observe).toHaveBeenCalledTimes(5)
  })

  it('deals every other card evenly without repeating the current cue', () => {
    for (let current = 0; current < 6; current++) {
      const draws = Array.from({ length: 5 }, (_, i) => drawAnotherCue(current, 6, () => (i + 0.5) / 5))
      expect(new Set(draws).size).toBe(5)
      expect(draws).not.toContain(current)
      expect(draws.every(cue => cue >= 0 && cue < 6)).toBe(true)
    }
  })

  it('starts the 45 seconds at round readiness, pausing for hidden tabs and both model calls', async () => {
    const b = booth(true)
    const opening = deferred<{ roundId: string; limit: number }>()
    const verdict = deferred<Guess>()
    b.start.mockImplementationOnce(() => opening.promise)
    b.observe.mockImplementationOnce(() => verdict.promise)
    const ready = b.round.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(b.times.at(-1)).toEqual({ seconds: 45, mode: 'paused' })
    opening.resolve({ roundId: 'current', limit: 5 })
    await ready
    await vi.advanceTimersByTimeAsync(1250)
    b.stage.visible = false
    b.round.schedule()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(b.times.at(-1)).toEqual({ seconds: 44, mode: 'paused' })
    b.stage.visible = true
    b.round.schedule()
    await vi.advanceTimersByTimeAsync(750)
    expect(b.times.at(-1)).toEqual({ seconds: 43, mode: 'running' })
    b.round.ask()
    await vi.advanceTimersByTimeAsync(90_000)
    expect(b.times.at(-1)).toEqual({ seconds: 43, mode: 'paused' })
    verdict.resolve(reply(b.observe.mock.calls[0][0], 1, 'correct'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(b.times.at(-1)).toEqual({ seconds: 43, mode: 'finished' })
    expect(b.state().end).toBeUndefined()
  })

  it('closes the curtain on time and does not observe an encoding pose at or after zero', async () => {
    const b = booth(true)
    const encoding = deferred<string>()
    b.capture.mockImplementationOnce(() => encoding.promise)
    await b.round.start()
    await vi.advanceTimersByTimeAsync(35_000)
    expect(b.times.at(-1)).toEqual({ seconds: 10, mode: 'running' })
    await vi.advanceTimersByTimeAsync(9999)
    b.round.ask()
    await vi.advanceTimersByTimeAsync(1)
    encoding.resolve('a late shutter')
    b.round.ask()
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(6000)
    expect(b.state().end).toBe('timeout')
    expect(b.times.at(-1)).toEqual({ seconds: 0, mode: 'expired' })
    expect(b.observe).not.toHaveBeenCalled()
  })

  it('pauses the clock on connection failure until an explicit retry', async () => {
    const b = booth(true)
    b.observe.mockRejectedValueOnce(new TypeError('Lost reply'))
    await b.round.start()
    await vi.advanceTimersByTimeAsync(6000)
    b.round.ask()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(b.state().phase).toBe('error')
    expect(b.times.at(-1)).toEqual({ seconds: 39, mode: 'paused' })
    b.round.poseChanged()
    await vi.advanceTimersByTimeAsync(1000)
    expect(b.observe).toHaveBeenCalledTimes(1)
    b.round.ask()
    await vi.advanceTimersByTimeAsync(2000)
    expect(b.times.at(-1)).toEqual({ seconds: 37, mode: 'running' })
  })

  it.each(['vision failure', 'missing referee'])('waits for a changed pose after a %s', async (failure) => {
    const b = booth(true)
    if (failure === 'vision failure') b.observe.mockRejectedValueOnce(new AudienceError('Look counted', 502, 'vision_failed', 1))
    else b.observe.mockImplementationOnce(async frame => reply(frame, 1, 'unjudged'))
    await b.round.start()
    b.round.ask()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(b.times.at(-1)).toEqual({ seconds: 45, mode: 'paused' })
    expect(b.state().recovery).toBe('change-pose')
    b.stage.image = 'new performance'
    b.round.poseChanged()
    expect(b.times.at(-1)).toEqual({ seconds: 45, mode: 'running' })
    await vi.advanceTimersByTimeAsync(700)
    expect(b.observe).toHaveBeenCalledTimes(2)
  })

  it('leaves a chosen cue untimed', async () => {
    const b = booth()
    await b.round.start()
    await vi.advanceTimersByTimeAsync(90_000)
    expect(b.times).toEqual([])
    expect(b.state().phase).toBe('ready')
    b.round.ask()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.observe).toHaveBeenCalledTimes(1)
  })
})
