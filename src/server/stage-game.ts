import { randomUUID } from 'node:crypto'
import { providerFailureReason, refereeFailure, type StageProvider } from './charades-provider'
import { cues, failure, imageHash, limit, uuid, type StageReply, type VisionGuess } from './stage-protocol'

const day = 86_400_000
const roundLifetime = 3_600_000
const stale = () => failure(409, 'stale_round', 'That round has ended. Start a fresh one.')
const interrupted = (used: number) => failure(502, 'vision_failed', 'The observation was interrupted. This look was counted.', used)
type Seat = { round: string; cue: number; lastLook: number; opened: number; starts: string; closed: number }
type Receipt = { hash: string; used: number; words: string | null; result: string | null }
type LiveObservation = { user: string; words: Promise<VisionGuess | undefined>; result: Promise<StageReply> }
type Input = Record<string, unknown>

/** One app-wide SQLite authority reserves a paid look and both daily counters in one turn. */
export class StageGame {
  private readonly live = new Map<string, LiveObservation>()
  private readonly sql: SqlStorage

  constructor(private storage: Pick<DurableObjectStorage, 'sql' | 'transactionSync'>,
    private provider: StageProvider, private now: () => number = Date.now) {
    this.sql = storage.sql
    this.sql.exec(`CREATE TABLE IF NOT EXISTS stage_seats (
      user TEXT PRIMARY KEY, round TEXT NOT NULL, cue INTEGER NOT NULL, opened INTEGER NOT NULL,
      lastLook INTEGER NOT NULL, closed INTEGER NOT NULL, starts TEXT NOT NULL)`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS stage_looks (
      round TEXT NOT NULL, id TEXT NOT NULL, user TEXT NOT NULL, day INTEGER NOT NULL,
      hash TEXT NOT NULL, used INTEGER NOT NULL, words TEXT, result TEXT,
      PRIMARY KEY(round,id), UNIQUE(round,hash))`)
    this.sql.exec('CREATE INDEX IF NOT EXISTS stage_daily ON stage_looks(day,user)')
  }

  private seat(user: string) {
    return this.sql.exec<Seat>('SELECT round,cue,opened,lastLook,closed,starts FROM stage_seats WHERE user=?', user).toArray()[0]
  }

  start(user: string, input: Input): StageReply {
    const cue = input.cue
    if (typeof cue !== 'number' || !Number.isInteger(cue) || !cues[cue - 1] || Object.keys(input).length !== 1)
      return failure(400, 'invalid_cue', 'Choose one of the six rehearsal cues.')
    const at = this.now()
    return this.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM stage_looks WHERE day < ?', Math.floor(at / day) - 1)
      this.sql.exec('DELETE FROM stage_seats WHERE opened < ? AND lastLook < ?', at - roundLifetime, at - roundLifetime)
      const previous = this.seat(user)
      const starts: number[] = previous ? JSON.parse(previous.starts) : []
      const recent = starts.filter(t => at - t < 60_000)
      if (recent.length >= 24) return failure(429, 'round_rate', 'Please wait a moment before drawing another cue.')
      const roundId = randomUUID()
      this.sql.exec('INSERT OR REPLACE INTO stage_seats (user,round,cue,opened,lastLook,closed,starts) VALUES (?,?,?,?,0,0,?)',
        user, roundId, cue, at, JSON.stringify([...recent, at]))
      return { status: 200, body: { roundId, limit } }
    })
  }

  /** SQLite is written before the first outbound call. A crash never authorizes a second charge. */
  async observe(user: string, input: Input, onWords?: (words: VisionGuess) => void): Promise<StageReply> {
    const { roundId, observationId, image } = input
    const seat = this.seat(user)
    const at = this.now()
    if (!seat || seat.round !== roundId || at - Math.max(seat.opened, seat.lastLook) > roundLifetime) return stale()
    if (typeof observationId !== 'string' || !uuid.test(observationId) || typeof image !== 'string' || Object.keys(input).length !== 3)
      return failure(400, 'invalid_observation', 'The stage could not freeze that observation.')
    const hash = imageHash(image)
    if (!hash) return failure(400, 'invalid_image', 'The stage needs a small PNG snapshot.')
    const key = seat.round + ':' + observationId
    const prior = this.sql.exec<Receipt>('SELECT hash,used,words,result FROM stage_looks WHERE round=? AND id=?',
      seat.round, observationId).toArray()[0]
    if (prior && prior.hash !== hash) return failure(409, 'observation_conflict', 'This observation belongs to a different pose.', prior.used)
    let pending = this.live.get(key)
    if (!pending && prior) {
      const words: VisionGuess | undefined = prior.words ? JSON.parse(prior.words) : undefined
      if (words) onWords?.(words)
      if (prior.result) return JSON.parse(prior.result) as StageReply
      // An earlier instance died with a reserved slot. Recover any spoken guess without billing again.
      return words ? { status: 200, body: { ...words, verdict: 'unjudged', judgeFailure: 'unavailable' } } : interrupted(prior.used)
    }
    if (!pending) {
      const reservation = this.reserve(user, seat, observationId, hash, at)
      if (typeof reservation !== 'number') return reservation
      let heard!: (words: VisionGuess | undefined) => void
      const words = new Promise<VisionGuess | undefined>(resolve => { heard = resolve })
      const result = this.perform(user, seat, observationId, image, reservation, heard)
        .finally(() => { heard(undefined); this.live.delete(key) })
      pending = { user, words, result }
      this.live.set(key, pending)
    }
    if (onWords) {
      const words = await pending.words
      if (words && this.seat(user)?.round === seat.round) onWords(words)
    }
    return pending.result
  }

  private reserve(user: string, seat: Seat, id: string, hash: string, at: number): number | StageReply {
    return this.storage.transactionSync(() => {
      const used = this.sql.exec<{ n: number }>('SELECT COUNT(*) n FROM stage_looks WHERE round=?', seat.round).one().n
      if (seat.closed) return failure(409, 'round_finished', 'This cue was already guessed.', used)
      if (used >= limit) return failure(429, 'round_limit', 'All five looks for this round have been used.', used)
      if ([...this.live.values()].some(work => work.user === user)) return failure(409, 'in_flight', 'The audience is still looking at a pose.', used)
      if (this.sql.exec('SELECT 1 FROM stage_looks WHERE round=? AND hash=?', seat.round, hash).toArray().length)
        return failure(409, 'same_pose', 'Change the pose before asking for another look.', used)
      if (seat.lastLook && at - seat.lastLook < 4_000) return failure(429, 'cooldown', 'Give the audience four seconds between looks.', used)
      const today = Math.floor(at / day)
      const counters = this.sql.exec<{ personal: number; total: number }>(
        'SELECT count(CASE WHEN user=? THEN 1 END) personal, count(*) total FROM stage_looks WHERE day=?', user, today).one()
      if (counters.personal >= 12 || counters.total >= 24)
        return failure(429, 'daily_limit', 'The daily audience allowance has been used.', used)
      this.sql.exec('INSERT INTO stage_looks (round,id,user,day,hash,used) VALUES (?,?,?,?,?,?)', seat.round, id, user, today, hash, used + 1)
      this.sql.exec('UPDATE stage_seats SET lastLook=? WHERE user=? AND round=?', at, user, seat.round)
      return used + 1
    })
  }

  private async perform(user: string, seat: Seat, id: string, image: string, used: number,
    heard: (words: VisionGuess | undefined) => void): Promise<StageReply> {
    let words: VisionGuess | undefined
    let reply: StageReply
    try {
      const read = await this.provider.guess(image)
      if (this.seat(user)?.round !== seat.round) return stale()
      words = { roundId: seat.round, observationId: id, used, limit, guess: read.text, visionModel: read.model, visionTokens: read.tokens }
      this.sql.exec('UPDATE stage_looks SET words=? WHERE round=? AND id=?', JSON.stringify(words), seat.round, id)
      heard(words)
      const score = await this.provider.judge(cues[seat.cue - 1], read.text)
      reply = { status: 200, body: { ...words, verdict: score.verdict, judgeModel: score.model, judgeTokens: score.tokens } }
    } catch (error) {
      if (words) reply = { status: 200, body: { ...words, verdict: 'unjudged', ...refereeFailure(error) } }
      else {
        reply = interrupted(used)
        reply.body.visionFailure = providerFailureReason(error)
      }
    }
    if (this.seat(user)?.round !== seat.round) return stale()
    this.storage.transactionSync(() => {
      this.sql.exec('UPDATE stage_looks SET result=? WHERE round=? AND id=?', JSON.stringify(reply), seat.round, id)
      if (reply.body.verdict === 'correct') this.sql.exec('UPDATE stage_seats SET closed=1 WHERE user=? AND round=?', user, seat.round)
    })
    return reply
  }
}
