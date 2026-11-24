import { ActingClock, type ClockReading } from './acting-clock'
import { audienceIssue, AudienceError } from './audience-issue'
import { failedReply, readAudienceStream } from './audience-stream'

export { AudienceError } from './audience-issue'

export type Verdict = 'correct' | 'incorrect' | 'uncertain' | 'unjudged'
type Frame = { roundId: string; observationId: string; image: string }
export type PendingGuess = Omit<Frame, 'image'> & { guess: string; used: number; limit: number }
export type Guess = PendingGuess & { verdict: Verdict; judgeFailure?: string }
export type Look = Guess & { image: string }
export type AudienceState = {
  phase: 'idle' | 'starting' | 'ready' | 'looking' | 'complete' | 'error'
  used: number
  limit: number
  history: Look[]
  pendingGuess?: PendingGuess
  issue?: string
  message?: string
  recovery?: 'restart' | 'daily-limit' | 'change-pose'
  end?: 'timeout'
}
export const quietAudience: AudienceState = { phase: 'idle', used: 0, limit: 5, history: [] }

type AudienceFetch = (path: string, options: RequestInit) => Promise<Response>

async function post<T>(fetchAudience: AudienceFetch, path: string, payload: unknown, signal: AbortSignal, stream?: (response: Response) => Promise<T>): Promise<T> {
  const request = new AbortController()
  const cancel = () => request.abort()
  if (signal.aborted) cancel()
  else signal.addEventListener('abort', cancel, { once: true })
  // Vision and refereeing each have their own upstream timeout.
  const timer = setTimeout(cancel, 75_000)
  try {
    const response = await fetchAudience(path, {
      method: 'POST', signal: request.signal,
      headers: { 'Content-Type': 'application/json', Accept: stream ? 'application/x-ndjson, application/json' : 'application/json' },
      body: JSON.stringify(payload),
    })
    const mediaType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (stream && response.ok && mediaType === 'application/x-ndjson') return await stream(response)
    if (mediaType !== 'application/json')
      throw new AudienceError('The AI audience is unavailable on this page.', response.status)
    if (!response.ok) throw failedReply(response.status, await response.json())
    return await response.json() as T
  } catch (error) {
    if (request.signal.aborted && !signal.aborted) throw new DOMException('The audience took too long to reply.', 'TimeoutError')
    throw error
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}

export function createAudience(mode: 'local' | 'hosted', getToken?: () => Promise<string | null>) {
  const prefix = mode === 'hosted' ? '/api/stage-ai/' : '/api/local-ai/'
  const send: AudienceFetch = async (path, options) => {
    const headers = new Headers(options.headers)
    const token = getToken && await getToken()
    if (token) headers.set('Authorization', 'Bearer ' + token)
    return fetch(prefix + path, { ...options, headers, credentials: mode === 'hosted' && !getToken ? 'omit' : 'same-origin', redirect: 'error' })
  }
  return {
    mode,
    async status(signal: AbortSignal): Promise<'live' | 'offline' | 'signin' | 'unconfigured'> {
      const response = await send('status', { cache: 'no-store', signal })
      if (response.status === 401 && mode === 'hosted') return 'signin'
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return 'offline'
      const result = await response.json() as { available?: boolean; requiresLogin?: boolean }
      if (result.requiresLogin && mode === 'hosted') return 'signin'
      if (result.available === true) return 'live'
      return result.available === false && mode === 'hosted' ? 'unconfigured' : 'offline'
    },
    start: (cue: number, signal: AbortSignal) => post<{ roundId: string; limit: number }>(send, 'rounds', { cue }, signal),
    observe: (frame: Frame, signal: AbortSignal, onGuess: (guess: PendingGuess) => void) =>
      post<Guess>(send, 'observe', frame, signal, response => readAudienceStream(response, onGuess)),
  }
}

export const localAudience = createAudience('local')
export type AudienceClient = ReturnType<typeof createAudience>

function matchesLook(guess: PendingGuess, frame: Frame, limit: number) {
  return guess?.roundId === frame.roundId && guess.observationId === frame.observationId &&
    typeof guess.guess === 'string' && guess.guess.trim().length > 0 && guess.guess.length <= 200 &&
    guess.limit === limit && Number.isInteger(guess.used) && guess.used >= 1 && guess.used <= limit
}

/** The player can keep acting while a look is in flight. Only the newest unsent pose is retained. */
export class AudienceRound {
  private roundId?: string
  private showOnStart = false
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
  private scoredAt?: { id: string; at: number }

  constructor(
    private cue: number,
    private send: Pick<AudienceClient, 'start' | 'observe'> & { mode?: 'local' | 'hosted' },
    private settled: () => boolean,
    private capture: () => Promise<string>,
    private publish: (state: AudienceState) => void,
    private visible: () => boolean = () => true,
    showTime?: (reading: ClockReading) => void,
    private heardAt?: (observationId: string) => number | undefined,
  ) {
    if (showTime) this.clock = new ActingClock(showTime, () => {
      clearTimeout(this.timer)
      this.pending = false
      this.update({ phase: 'complete', end: 'timeout', issue: undefined, message: undefined })
    })
  }

  private syncClock() {
    const acting = this.state.phase === 'ready' && !this.unresolved && this.state.recovery !== 'change-pose' && this.visible()
    const mode = this.state.phase === 'complete' ? 'finished' : acting ? 'running' : 'paused'
    this.clock?.set(mode)
  }

  private update(patch: Partial<AudienceState>) {
    if (this.abort.signal.aborted) return
    this.state = { ...this.state, ...patch }
    this.publish(this.state)
    this.syncClock()
  }

  async start(showCurrentPose = this.showOnStart) {
    if (this.busy || this.abort.signal.aborted || this.roundId) return
    this.busy = true
    this.showOnStart = showCurrentPose
    this.update({ phase: 'starting', issue: undefined, message: undefined })
    try {
      const result = await this.send.start(this.cue, this.abort.signal)
      if (this.abort.signal.aborted) return
      if (!result.roundId || result.limit !== 5) throw new Error('The audience booth returned an invalid round.')
      this.roundId = result.roundId
      if (showCurrentPose) this.pending = true
      this.showOnStart = false
      this.update({ phase: 'ready', limit: result.limit })
    } catch (error) {
      this.update({ phase: 'error', ...audienceIssue(error, 'start', this.state.limit, this.send.mode === 'hosted') })
    } finally {
      this.busy = false
      this.schedule()
    }
  }

  poseChanged() {
    if (this.state.phase === 'complete' || this.abort.signal.aborted) return
    ++this.revision
    if (this.state.recovery === 'change-pose') this.update({ recovery: undefined, issue: undefined, message: undefined })
    // After a connection failure, only the user can choose to retry.
    if (this.state.phase === 'error') return
    this.pending = true
    this.readyAt = Date.now() + 700
    this.schedule()
  }

  ask() {
    if (this.abort.signal.aborted || this.busy || this.state.phase === 'complete' ||
        this.state.recovery === 'daily-limit' || this.state.recovery === 'change-pose') return
    if (this.state.recovery === 'restart') {
      this.roundId = undefined
      this.lastImage = undefined
      this.scoredAt = undefined
      this.nextStart = 0
      this.state = { ...quietAudience, history: [] }
    }
    if (!this.roundId) { void this.start(); return }
    this.pending = true
    this.readyAt = Date.now()
    this.update({ phase: 'ready', issue: undefined, message: undefined })
    this.schedule()
  }

  schedule() {
    this.syncClock()
    clearTimeout(this.timer)
    if (!this.pending || !this.roundId || this.busy || this.abort.signal.aborted ||
        this.state.phase !== 'ready' || !this.visible()) return
    let next = Math.max(this.readyAt, this.nextStart)
    if (this.heardAt && this.scoredAt) {
      const heard = this.heardAt(this.scoredAt.id)
      if (heard === undefined) {
        this.timer = setTimeout(() => this.schedule(), 80)
        return
      }
      next = Math.max(next, Math.max(heard, this.scoredAt.at) + 750)
    }
    const wait = Math.max(0, next - Date.now())
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
    this.scoredAt = undefined
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
      this.update({ phase: 'looking', issue: undefined, message: undefined })
      const sent = frame
      const answer = await this.send.observe(sent, this.abort.signal, words => {
        if (this.abort.signal.aborted || this.unresolved !== sent) return
        const prior = this.state.pendingGuess
        if (!matchesLook(words, sent, this.state.limit) || (prior && (prior.guess !== words.guess || prior.used !== words.used)))
          throw new Error('The audience sent a mismatched guess.')
        if (!prior) {
          const { roundId, observationId, guess, used, limit } = words
          this.update({ used, pendingGuess: { roundId, observationId, guess, used, limit } })
        }
      })
      if (this.abort.signal.aborted) return
      const spoken = this.state.pendingGuess
      if (!matchesLook(answer, sent, this.state.limit) || !['correct','incorrect','uncertain','unjudged'].includes(answer.verdict) ||
          (spoken && (spoken.guess !== answer.guess || spoken.used !== answer.used)))
        throw new Error('The projector received an incomplete result. Try again.')
      this.unresolved = undefined
      this.lastImage = frame.image
      const complete = answer.verdict === 'correct' || answer.used >= this.state.limit
      if (complete) this.pending = false
      this.scoredAt = { id: answer.observationId, at: Date.now() }
      this.update({
        used: answer.used, pendingGuess: undefined, history: [...this.state.history, { ...answer, image: frame.image }],
        phase: complete ? 'complete' : 'ready', issue: undefined, message: undefined,
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
      const recovery = known?.code === 'stale_round' ? 'restart' : ['daily_limit','player_daily_limit','house_daily_limit'].includes(known?.code ?? '') ? 'daily-limit' : newPoseNeeded ? 'change-pose' : undefined
      const complete = (!this.unresolved && used >= this.state.limit) || known?.code === 'round_finished' || known?.code === 'round_limit'
      const spoken = this.unresolved ? this.state.pendingGuess : undefined
      this.update({
        phase: complete ? 'complete' : newPoseNeeded ? 'ready' : 'error',
        used, recovery, pendingGuess: spoken,
        ...(spoken ? { issue: 'The referee’s reply is missing.', message: 'Try again to check the score for this same picture.' }
          : audienceIssue(error, frame ? 'observe' : 'capture', this.state.limit - used, this.send.mode === 'hosted')),
      })
    } finally {
      this.busy = false
      this.schedule()
    }
  }

  dispose() {
    this.abort.abort()
    this.clock?.dispose()
    this.pending = false
    clearTimeout(this.timer)
  }
}
