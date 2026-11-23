import { createHash, randomUUID } from 'node:crypto'
import { refereeFailure, type OwnProvider } from './local-ai-provider'

const cues = ['Drinking water', 'Talking on the phone', 'Taking a selfie', 'Covering your eyes', 'Surrendering', 'Carrying a tray']
const limit = 5
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const pngPrefix = 'data:image/png;base64,'
export const maxBodyBytes = 820_000
type Reply = { status: number; body: Record<string, unknown>; cookie?: string }
type Observation = { hash: string; response: Promise<Reply> }
type Round = { id: string; cue: string; lastAt: number; closed: boolean; observations: Map<string, Observation> }
type Session = { round: Round; busy: boolean; activeAt: number; starts: number[] }
type Options = { provider?: OwnProvider; claim: (session: string, at: number) => boolean; now?: () => number }

export const failure = (status: number, error: string, message: string, used?: number): Reply => ({
  status, body: { error, message, ...(used === undefined ? {} : { used, limit }) },
})

function imageHash(image: unknown): string | undefined {
  if (typeof image !== 'string' || !image.startsWith(pngPrefix) || image.length > maxBodyBytes - 128) return
  const encoded = image.slice(pngPrefix.length)
  if (!encoded.length || encoded.length % 4 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) return
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length < 45 || bytes.length > 600_000 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex')) ||
      bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii',12,16) !== 'IHDR' ||
      !bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex'))) return
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20)
  if (w < 64 || h < 64 || w > 1024 || h > 1024) return
  return createHash('sha256').update(bytes).digest('hex')
}

// The active round is private to one local browser cookie. Only fingerprints and
// short results live here; raw image data is released after the provider request.
export function createLocalAudience({ provider, claim, now = Date.now }: Options) {
  const sessions = new Map<string, Session>()
  const staleRound = () => failure(409, 'stale_round', 'That round has ended. Start a fresh one.')
  return {
    status(): Reply {
      return { status: 200, body: provider ? { available: true, model: provider.model } : { available: false } }
    },
    start(sessionId: string, input: Record<string, unknown>): Reply {
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
      const round: Round = { id: randomUUID(), cue: cues[n-1], lastAt: -Infinity, closed: false, observations: new Map() }
      const session = old ?? { round, activeAt: at, busy: false, starts }
      Object.assign(session, { round, starts: [...starts, at], activeAt: at })
      sessions.set(cookie, session)
      return { status: 200, body: { roundId: round.id, limit }, cookie }
    },
    async observe(sessionId: string, input: Record<string, unknown>): Promise<Reply> {
      if (!provider) return failure(503, 'unavailable', 'The AI audience is offline.')
      const { roundId, observationId, image } = input
      const session = sessions.get(sessionId)
      if (!session || session.round.id !== roundId) return staleRound()
      const round = session.round
      const used = round.observations.size
      if (typeof observationId !== 'string' || !uuid.test(observationId) || typeof image !== 'string' || Object.keys(input).length !== 3) {
        return failure(400, 'invalid_observation', 'The stage could not freeze that observation.', used)
      }
      const hash = imageHash(image)
      if (!hash) return failure(400, 'invalid_image', 'The stage needs a small PNG snapshot.', used)
      const prior = round.observations.get(observationId)
      if (prior) return prior.hash === hash ? prior.response : failure(409, 'observation_conflict', 'This observation belongs to a different pose.', used)
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
      const response = (async (): Promise<Reply> => {
        const slot = used + 1
        try {
          const read = await provider.guess(image)
          if (session.round !== round) return staleRound()
          const base = { roundId, observationId, used: slot, limit, guess: read.text, visionModel: read.model, visionTokens: read.tokens }
          try {
            const score = await provider.judge(round.cue, read.text)
            if (session.round !== round) return staleRound()
            if (score.verdict === 'correct') round.closed = true
            return { status: 200, body: { ...base, verdict: score.verdict, judgeModel: score.model, judgeTokens: score.tokens } }
          } catch (error) {
            return session.round === round ? { status: 200, body: { ...base, verdict: 'unjudged', ...refereeFailure(error) } } : staleRound()
          }
        } catch {
          return session.round === round ? failure(502, 'vision_failed', 'The audience could not read this snapshot. This look was counted.', slot) : staleRound()
        } finally {
          session.busy = false
        }
      })()
      round.observations.set(observationId, { hash, response })
      return response
    },
  }
}
