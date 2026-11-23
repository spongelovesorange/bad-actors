import { ActingClock, type ClockReading } from './acting-clock'

export type Verdict = 'correct' | 'incorrect' | 'uncertain' | 'unjudged'
type Frame = { roundId: string; observationId: string; image: string }
export type Guess = Omit<Frame, 'image'> & { guess: string; verdict: Verdict; used: number; limit: number }
export type Look = Guess & { image: string }
export type AudienceState = {
  phase: 'idle' | 'starting' | 'ready' | 'looking' | 'complete' | 'error'
  used: number
  limit: number
  history: Look[]
  message?: string
  recovery?: 'restart' | 'daily-limit' | 'change-pose'
  end?: 'timeout'
}
export const quietAudience: AudienceState = { phase: 'idle', used: 0, limit: 5, history: [] }

export class AudienceError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly used?: number) {
    super(message)
  }
}

async function post<T>(path: string, payload: unknown, signal: AbortSignal): Promise<T> {
  const request = new AbortController()
  const cancel = () => request.abort()
  if (signal.aborted) cancel()
  else signal.addEventListener('abort', cancel, { once: true })
  // Vision and refereeing each have their own upstream timeout.
  const timer = setTimeout(cancel, 75_000)
  try {
    const response = await fetch('/api/local-ai/' + path, {
      method: 'POST', credentials: 'same-origin', signal: request.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new AudienceError('The live audience booth is unavailable on this page.', response.status)
    if (!response.ok) {
      const data = await response.json() as { message?: string; error?: string; used?: number }
      throw new AudienceError(data.message || 'The audience booth lost its connection.', response.status, data.error, data.used)
    }
    return await response.json() as T
  } catch (error) {
    if (request.signal.aborted && !signal.aborted) throw new Error('The booth took too long. Try again to check this look.')
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}

export const localAudience = {
  start: (cue: number, signal: AbortSignal) => post<{ roundId: string; limit: number }>('rounds', { cue }, signal),
  observe: (frame: Frame, signal: AbortSignal) => post<Guess>('observe', frame, signal),
}

/** The player can keep acting while a look is in flight. Only the newest unsent pose is retained. */
export class AudienceRound {
  private roundId?: string
  private pending = false
  private revision = 0
  private readyAt = 0
  private nextStart = 0
  private busy = false
  private lastImage?: string
  private unresolved?: Frame
  private timer?: ReturnType<typeof setTimeout>
  private abort = new AbortController()
  private state: AudienceState = { ...quietAudience, history: [] }
  private clock?: ActingClock

  constructor(
    private cue: number,
    private send: typeof localAudience,
    private settled: () => boolean,
    private capture: () => Promise<string>,
    private publish: (state: AudienceState) => void,
    private visible: () => boolean = () => true,
    showTime?: (reading: ClockReading) => void,
  ) {
    if (showTime) this.clock = new ActingClock(showTime, () => {
      clearTimeout(this.timer)
      this.pending = false
      this.update({ phase: 'complete', end: 'timeout', message: undefined })
    })
  }

  private syncClock() {
    const acting = this.state.phase === 'ready' && this.state.recovery !== 'change-pose' && this.visible()
    const mode = this.state.phase === 'complete' ? 'finished' : acting ? 'running' : 'paused'
    this.clock?.set(mode)
  }

  private update(patch: Partial<AudienceState>) {
    if (this.abort.signal.aborted) return
    this.state = { ...this.state, ...patch }
    this.publish(this.state)
    this.syncClock()
  }

  async start() {
    if (this.busy || this.abort.signal.aborted || this.roundId) return
    this.busy = true
    this.update({ phase: 'starting', message: undefined })
    try {
      const result = await this.send.start(this.cue, this.abort.signal)
      if (this.abort.signal.aborted) return
      if (!result.roundId || result.limit !== 5) throw new Error('The audience booth returned an invalid round.')
      this.roundId = result.roundId
      this.update({ phase: 'ready', limit: result.limit })
    } catch (error) {
      this.update({ phase: 'error', message: this.explain(error) })
    } finally {
      this.busy = false
      this.schedule()
    }
  }

  poseChanged() {
    if (this.state.phase === 'complete' || this.abort.signal.aborted) return
    ++this.revision
    if (this.state.recovery === 'change-pose') this.update({ recovery: undefined, message: undefined })
    // After a connection failure, only the user can choose to retry.
    if (this.state.phase === 'error') return
    this.pending = true
    this.readyAt = Date.now() + 700
    this.schedule()
  }

  ask() {
    if (this.abort.signal.aborted || this.busy || this.state.phase === 'complete' ||
        this.state.recovery === 'daily-limit') return
    if (this.state.recovery === 'restart') {
      this.roundId = undefined
      this.lastImage = undefined
      this.nextStart = 0
      this.state = { ...quietAudience, history: [] }
    }
    if (!this.roundId) { void this.start(); return }
    this.pending = true
    this.readyAt = Date.now()
    this.update({ phase: 'ready', message: undefined })
    this.schedule()
  }

  schedule() {
    this.syncClock()
    clearTimeout(this.timer)
    if (!this.pending || !this.roundId || this.busy || this.abort.signal.aborted ||
        this.state.phase !== 'ready' || !this.visible()) return
    const wait = Math.max(0, this.readyAt - Date.now(), this.nextStart - Date.now())
    if (wait > 0 || !this.settled()) {
      this.timer = setTimeout(() => this.schedule(), wait || 100)
      return
    }
    void this.look()
  }

  private async look() {
    const revision = this.revision
    const roundId = this.roundId!
    let frame = this.unresolved
    this.busy = true
    this.pending = false
    try {
      if (!frame) {
        const image = await this.capture()
        if (this.abort.signal.aborted) return
        this.syncClock()
        if (this.state.phase === 'complete') return
        // No charge if the player moved during PNG encoding, or if it is the very same pose.
        if (revision !== this.revision || !this.visible() || !this.settled()) {
          this.pending = true
          this.readyAt = Date.now() + 700
          return
        }
        if (image === this.lastImage) {
          this.update({ message: 'Same pose. Move a hand, a prop or a joint for another look.' })
          return
        }
        frame = { roundId, observationId: crypto.randomUUID(), image }
      }
      this.syncClock()
      if (this.state.phase === 'complete') return
      this.unresolved = frame
      this.nextStart = Date.now() + 4000
      this.update({ phase: 'looking', message: undefined })
      const answer = await this.send.observe(frame, this.abort.signal)
      if (this.abort.signal.aborted) return
      if (answer.roundId !== roundId || answer.observationId !== frame.observationId ||
          !answer.guess || !['correct','incorrect','uncertain','unjudged'].includes(answer.verdict) ||
          !Number.isInteger(answer.used) || answer.used < 1 || answer.used > this.state.limit)
        throw new Error('The projector received an incomplete result. Try again.')
      this.unresolved = undefined
      this.lastImage = frame.image
      const complete = answer.verdict === 'correct' || answer.used >= this.state.limit
      if (complete) this.pending = false
      this.update({
        used: answer.used, history: [...this.state.history, { ...answer, image: frame.image }],
        phase: complete ? 'complete' : 'ready', message: undefined,
        recovery: !complete && answer.verdict === 'unjudged' ? 'change-pose' : undefined,
      })
    } catch (error) {
      this.syncClock()
      if (this.abort.signal.aborted || this.state.phase === 'complete') return
      this.pending = false
      // Explicit structured errors are settled. A lost reply can be retrieved with its original ID.
      const known = error instanceof AudienceError ? error : undefined
      if (known?.code && known.code !== 'in_flight') this.unresolved = undefined
      const used = known?.used ?? this.state.used
      if (frame && (known?.code === 'same_pose' || known?.code === 'vision_failed')) this.lastImage = frame.image
      const newPoseNeeded = known?.code === 'same_pose' || known?.code === 'vision_failed'
      const recovery = known?.code === 'stale_round' ? 'restart' : known?.code === 'daily_limit' ? 'daily-limit' : newPoseNeeded ? 'change-pose' : undefined
      const complete = used >= this.state.limit || known?.code === 'round_finished' || known?.code === 'round_limit'
      this.update({
        phase: complete ? 'complete' : newPoseNeeded ? 'ready' : 'error',
        used, recovery, message: this.explain(error),
      })
    } finally {
      this.busy = false
      this.schedule()
    }
  }

  private explain(error: unknown) {
    if (error instanceof TypeError) return 'The booth lost the connection. Try again to check this look.'
    return error instanceof Error ? error.message : 'The booth lost the connection.'
  }

  dispose() {
    this.abort.abort()
    this.clock?.dispose()
    this.pending = false
    clearTimeout(this.timer)
  }
}
