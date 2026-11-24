import { randomUUID } from 'node:crypto'
import { cues, limit, uuid, imageHash, failure, type StageReply, type VisionGuess } from '../src/server/stage-protocol'
import { providerFailureReason, refereeFailure, type OwnProvider } from './local-ai-provider'

export { failure, maxBodyBytes, type VisionGuess } from '../src/server/stage-protocol'
export type LocalReply = StageReply & { cookie?: string }
type Observation = { hash: string; vision: Promise<VisionGuess | LocalReply>; response: Promise<LocalReply> }
type GuessListener = (guess: VisionGuess) => void
type Round = { id: string; cue: string; lastAt: number; closed: boolean; missed: string[]; observations: Map<string, Observation> }
type Session = { round: Round; busy: boolean; activeAt: number; starts: number[] }
type Options = { provider?: OwnProvider; claim: (session: string, at: number) => boolean; now?: () => number }

// The active round is private to one local browser cookie. Only fingerprints and
// short results live here; raw image data is released after the provider request.
export function createLocalAudience({ provider, claim, now = Date.now }: Options) {
  const sessions = new Map<string, Session>()
  const staleRound = () => failure(409, 'stale_round', 'That round has ended. Start a fresh one.')
  return {
    status(): LocalReply {
      if (!provider) return { status: 200, body: { available: false } }
      const { visionModel, judgeModel } = provider
      return { status: 200, body: { available: true, model: visionModel, visionModel, judgeModel } }
    },
    start(sessionId: string, input: Record<string, unknown>): LocalReply {
      if (!provider) return failure(503, 'unavailable', 'The AI audience is offline.')
      const n = input.cue
      if (typeof n !== 'number' || !Number.isInteger(n) || !cues[n-1] || Object.keys(input).length !== 1) {
        return failure(400, 'invalid_cue', 'Choose one of the six rehearsal cues.')
      }
      const at = now()
      for (const [id, old] of sessions) if (!old.busy && at - old.activeAt > 3_600_000) sessions.delete(id)
      const cookie = uuid.test(sessionId) ? sessionId : randomUUID()
      const old = sessions.get(cookie)
      if (!old && sessions.size >= 256) return failure(429, 'busy', 'The local stage is busy. Try again later.')
      const starts = old?.starts.filter(t => at - t < 60_000) ?? []
      if (starts.length >= 24) return failure(429, 'round_rate', 'Please wait a moment before drawing another cue.')
      const round: Round = { id: randomUUID(), cue: cues[n-1], lastAt: -Infinity, closed: false, missed: [], observations: new Map() }
      const session = old ?? { round, activeAt: at, busy: false, starts }
      Object.assign(session, { round, starts: [...starts, at], activeAt: at })
      sessions.set(cookie, session)
      return { status: 200, body: { roundId: round.id, limit }, cookie }
    },
    async observe(sessionId: string, input: Record<string, unknown>, onGuess?: GuessListener): Promise<LocalReply> {
      if (!provider) return failure(503, 'unavailable', 'The AI audience is offline.')
      const { roundId, observationId, image } = input
      const session = sessions.get(sessionId)
      if (!session || session.round.id !== roundId) return staleRound()
      const round = session.round
      const deliver = async (observation: Observation) => {
        if (onGuess) {
          const vision = await observation.vision
          if (session.round === round && 'guess' in vision) onGuess(vision)
        }
        return observation.response
      }
      const used = round.observations.size
      if (typeof observationId !== 'string' || !uuid.test(observationId) || typeof image !== 'string' || Object.keys(input).length !== 3) {
        return failure(400, 'invalid_observation', 'The stage could not freeze that observation.', used)
      }
      const hash = imageHash(image)
      if (!hash) return failure(400, 'invalid_image', 'The stage needs a small PNG snapshot.', used)
      const prior = round.observations.get(observationId)
      if (prior) return prior.hash === hash ? deliver(prior) : failure(409, 'observation_conflict', 'This observation belongs to a different pose.', used)
      if (round.closed) return failure(409, 'round_finished', 'This cue was already guessed.', used)
      if (used >= limit) return failure(429, 'round_limit', 'All five looks for this round have been used.', used)
      if (session.busy) return failure(409, 'in_flight', 'The audience is still looking at a pose.', used)
      if ([...round.observations.values()].some(o => o.hash === hash)) {
        return failure(409, 'same_pose', 'Change the pose before asking for another look.', used)
      }
      const at = now()
      if (at - round.lastAt < 4_000) return failure(429, 'cooldown', 'Give the audience four seconds between looks.', used)
      if (!claim(sessionId, at)) return failure(429, 'daily_limit', 'The daily AI rehearsal allowance has been used.', used)
      // Reserve synchronously before any asynchronous work. An upstream failure
      // remains charged to the slot and a retry with the same ID shares its result.
      session.busy = true
      session.activeAt = round.lastAt = at
      const slot = used + 1
      const vision = (async (): Promise<VisionGuess | LocalReply> => {
        try {
          const read = await provider.guess(image, [...round.missed])
          if (session.round !== round) return staleRound()
          return { roundId: round.id, observationId, used: slot, limit, guess: read.text,
            ...(read.line && { line: read.line }), visionModel: read.model, visionTokens: read.tokens }
        } catch (error) {
          if (session.round !== round) return staleRound()
          const reply = failure(502, 'vision_failed', 'The image model did not return a guess. This look was counted.', slot)
          reply.body.visionFailure = providerFailureReason(error)
          return reply
        }
      })()
      const response = vision.then(async (base): Promise<LocalReply> => {
        try {
          if ('status' in base) return base
          if (session.round !== round) return staleRound()
          const score = await provider.judge(round.cue, base.guess)
          if (session.round !== round) return staleRound()
          if (score.verdict === 'correct') round.closed = true
          else round.missed.push(base.guess)
          return { status: 200, body: { ...base, verdict: score.verdict, judgeModel: score.model, judgeTokens: score.tokens } }
        } catch (error) {
          return session.round === round ? { status: 200, body: { ...base, verdict: 'unjudged', ...refereeFailure(error) } } : staleRound()
        } finally {
          session.busy = false
        }
      })
      const observation = { hash, vision, response }
      round.observations.set(observationId, observation)
      return deliver(observation)
    },
  }
}
