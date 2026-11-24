import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StageProvider } from './charades-provider'
import { StageGame } from './stage-game'

const frames = Array.from({ length: 6 }, (_, index) => 'data:image/png;base64,' + readFileSync(new URL(
  '../../docs/verification/six-poses-2026-11-23/' + (index + 1) + '.png', import.meta.url)).toString('base64'))
const databases: DatabaseSync[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })

function fixture(owner?: string) {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const sql = { exec(query: string, ...args: string[]) {
    const stmt = db.prepare(query)
    const rows = stmt.columns().length ? stmt.all(...args) : (stmt.run(...args), [])
    return { one: () => rows[0], toArray: () => rows }
  } } as unknown as SqlStorage
  const storage = { sql, transactionSync<T>(work: () => T) {
    db.exec('BEGIN')
    try { const value = work(); db.exec('COMMIT'); return value }
    catch (error) { db.exec('ROLLBACK'); throw error }
  } }
  const provider = { visionModel: 'mock', judgeModel: 'judge',
    guess: vi.fn<StageProvider['guess']>(async () => ({ model: 'mock', text: 'making a call' })),
    judge: vi.fn<StageProvider['judge']>(async () => ({ model: 'judge', verdict: 'incorrect' })),
  }
  let now = Date.UTC(2026, 0, 1)
  function reboot() { return new StageGame(storage, provider, () => now, owner) }
  const game = reboot()
  const draw = (user: string, cue = 2) => game.start(user, { cue }).body.roundId as string
  const frame = (roundId: string, index: number) => ({ roundId, image: frames[index], observationId: randomUUID() })
  return { db, provider, game, reboot, draw, frame, tick: (ms = 4100) => { now += ms } }
}

describe('hosted stage durable reservations', () => {
  it('keeps two identities private and a completed ruling replayable after an isolate restart', async () => {
    const { game, provider, draw, frame, reboot } = fixture()
    const id = draw('alice'), shot = frame(id, 0)
    expect((await game.observe('bob', shot)).body.error).toBe('stale_round')
    provider.judge.mockResolvedValueOnce({ model: 'judge', verdict: 'correct' })
    const words = vi.fn(), scored = await game.observe('alice', shot, words)
    expect(scored.body).toMatchObject({ roundId: id, used: 1, verdict: 'correct' })
    expect(provider.guess.mock.calls).toEqual([[shot.image]])
    expect(provider.judge.mock.calls).toEqual([['Talking on the phone', 'making a call']])
    expect(words.mock.calls[0][0]).not.toHaveProperty('verdict')
    const second = reboot(), replay = vi.fn()
    expect(await second.observe('alice', shot, replay)).toEqual(scored)
    expect(replay.mock.calls).toEqual(words.mock.calls)
    expect((await second.observe('alice', frame(id, 1))).body.error).toBe('round_finished')
    expect(provider.guess).toHaveBeenCalledTimes(1)
  })

  it('delivers the early words and joins a concurrent retry, rejecting a competing pose', async () => {
    const { game, provider, draw, frame } = fixture()
    const id = draw('a'), shot = frame(id, 0)
    let resolve!: (answer: { model: string; verdict: 'incorrect' }) => void
    provider.judge.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const heard = vi.fn()
    const first = game.observe('a', shot, heard), twin = game.observe('a', shot, heard)
    await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(2))
    expect((await game.observe('a', frame(id, 1))).body.error).toBe('in_flight')
    expect((await game.observe('a', { ...shot, image: frames[1] })).body.error).toBe('observation_conflict')
    resolve({ model: 'judge', verdict: 'incorrect' })
    expect(await first).toEqual(await twin)
    expect(provider.guess).toHaveBeenCalledTimes(1)
    expect(provider.judge).toHaveBeenCalledTimes(1)
  })

  it('does not reissue paid calls if an isolate dies between reservation and the final receipt', async () => {
    const { game, reboot, provider, draw, frame, db } = fixture()
    const shot = frame(draw('a'), 1)
    await game.observe('a', shot)
    db.prepare('UPDATE stage_looks SET result=NULL').run()
    expect((await reboot().observe('a', shot)).body).toMatchObject({ guess: 'making a call', verdict: 'unjudged' })
    db.prepare('UPDATE stage_looks SET words=NULL').run()
    expect((await reboot().observe('a', shot)).body).toMatchObject({ error: 'vision_failed', used: 1 })
    expect(provider.guess).toHaveBeenCalledTimes(1)
    expect(provider.judge).toHaveBeenCalledTimes(1)
  })

  it('caps each round at five, enforces per-user and app-wide limits across rounds and restarts, and resets at UTC midnight', async () => {
    const { game, reboot, provider, draw, frame, tick } = fixture('owner')
    for (const user of ['owner','a','b','c','d']) {
      const rounds = user === 'owner' ? 13 : 12
      for (let n = 0; n < rounds; n++) {
        const id = draw(user)
        for (let i = 0; i < 5; i++) {
          expect((await game.observe(user, frame(id, i))).status).toBe(200)
          tick()
        }
        expect((await game.observe(user, frame(id, 5))).body.error).toBe('round_limit')
      }
      if (user !== 'owner')
        expect((await reboot().observe(user, frame(draw(user), 0))).body.error).toBe('player_daily_limit')
    }
    expect((await reboot().observe('visitor', frame(draw('visitor'), 0))).body.error).toBe('house_daily_limit')
    expect((await reboot().observe('owner', frame(draw('owner'), 0))).status).toBe(200)
    expect(provider.guess).toHaveBeenCalledTimes(306)
    tick(86_400_000)
    expect((await reboot().observe('a', frame(draw('a'), 0))).status).toBe(200)
  })

  it('does not score a superseded cue, spend on a malformed image, or store raw pixels', async () => {
    const { game, provider, draw, frame, db } = fixture()
    const old = frame(draw('a'), 0)
    expect((await game.observe('a', { ...old, image: 'not a picture' })).body.error).toBe('invalid_image')
    let resolve!: (v: { model: string; text: string }) => void
    provider.guess.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const late = game.observe('a', old)
    draw('a', 4)
    resolve({ model: 'mock', text: 'making a call' })
    expect((await late).body.error).toBe('stale_round')
    expect(provider.guess).toHaveBeenCalledTimes(1)
    expect(provider.judge).not.toHaveBeenCalled()
    expect(JSON.stringify(db.prepare('SELECT * FROM stage_looks').all())).not.toContain('base64')
  })
})
