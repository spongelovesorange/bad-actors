import { describe, expect, it } from 'vitest'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createRaceActions, type Standing } from './race'

type Row = { recordId: string; data: Record<string, unknown> }

/** An in-memory record room with the race collections' uniqueness rules, as the Durable Object enforces them. */
function recordRoom() {
  const tables = new Map<string, Row[]>()
  const unique: Record<string, string[]> = { races: ['code'], race_players: ['code', 'userId'], race_results: ['code', 'round', 'userId'] }
  let serial = 0
  const rows = (collection: string) => tables.get(collection) ?? tables.set(collection, []).get(collection)!
  const matches = (data: Record<string, unknown>, where: Record<string, unknown> = {}) => Object.entries(where).every(([key, value]) => data[key] === value)
  const tools = {
    async create(collection: string, data: Record<string, unknown>) {
      const keys = unique[collection]
      if (keys && rows(collection).some(row => keys.every(key => row.data[key] === data[key])))
        return { success: false, error: `Duplicate: a record with ${keys.join(', ')} already exists in ${collection}` }
      const recordId = 'r' + ++serial
      rows(collection).push({ recordId, data: { ...data } })
      return { success: true, data: { recordId } }
    },
    async update(collection: string, recordId: string, patch: Record<string, unknown>) {
      const row = rows(collection).find(entry => entry.recordId === recordId)
      if (!row) return { success: false, error: 'Record not found' }
      Object.assign(row.data, patch)
      return { success: true, data: { recordId } }
    },
    async query(collection: string, options: { where?: Record<string, unknown>; limit?: number } = {}) {
      const found = rows(collection).filter(row => matches(row.data, options.where)).slice(0, options.limit ?? 100)
      return { success: true, data: { records: found.map(row => ({ ...row, createdBy: '', createdAt: '', updatedAt: '' })), count: found.length } }
    },
  } as unknown as ActionTools
  return { tools, rows }
}

function referee(seats: Record<string, Standing>, clock = { now: 50_000 }) {
  const room = recordRoom()
  const actions = createRaceActions(async (_env, userId) => seats[userId] ?? null, () => clock.now, () => 0.42)
  const call = (name: string, userId: string, params: Record<string, unknown> = {}) =>
    actions[name]({ userId, params, tools: room.tools, env: {} as Env, callerJwt: 'token' }) as Promise<ActionResult<Record<string, unknown>>>
  return { call, room, clock }
}
const ok = <T,>(result: ActionResult<T>) => { if (!result.success) throw Error(result.error); return result.data }

describe('the race referee', () => {
  it('opens a room for its host, seats a friend once, and turns away a seventh player', async () => {
    const { call, room } = referee({})
    const { code } = ok(await call('raceCreate', 'host', { name: '  Shi  ' }))
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
    expect(room.rows('races')[0].data).toMatchObject({ code, host: 'host', hostName: 'Shi', round: 0 })
    ok(await call('raceJoin', 'alex', { code: (code as string).toLowerCase(), name: 'Alex' }))
    ok(await call('raceJoin', 'alex', { code, name: 'Alex again' }))
    expect(room.rows('race_players').map(row => row.data.name)).toEqual(['Shi', 'Alex'])
    for (const friend of ['c', 'd', 'e', 'f']) ok(await call('raceJoin', friend, { code }))
    expect(await call('raceJoin', 'seventh', { code })).toMatchObject({ success: false, code: 'race_full' })
    expect(await call('raceJoin', 'alex', { code: 'AEIO' })).toMatchObject({ success: false, code: 'invalid_code' })
    expect(await call('raceJoin', 'alex', { code: 'ZZZZ' })).toMatchObject({ success: false, code: 'not_found' })
  })

  it('lets only the host deal, only with someone to race, and times each new round on the server', async () => {
    const { call, room, clock } = referee({})
    const { code } = ok(await call('raceCreate', 'host', { name: 'Shi' }))
    expect(await call('raceStart', 'host', { code })).toMatchObject({ success: false, code: 'need_players' })
    ok(await call('raceJoin', 'alex', { code, name: 'Alex' }))
    expect(await call('raceStart', 'alex', { code })).toMatchObject({ success: false, code: 'not_host' })
    const first = ok(await call('raceStart', 'host', { code }))
    expect(room.rows('races')[0].data).toMatchObject({ round: 1, cue: first.cue, startedAt: 50_000 })
    clock.now = 90_000
    const second = ok(await call('raceStart', 'host', { code }))
    expect(second.round).toBe(2)
    expect(second.cue).not.toBe(first.cue)
    expect(room.rows('races')[0].data.startedAt).toBe(90_000)
  })

  it('accepts a finish only when the booth has this round’s cue guessed, timed from the deal to the winning Ready', async () => {
    const seats: Record<string, Standing> = {}
    const { call, room } = referee(seats)
    const { code } = ok(await call('raceCreate', 'host', { name: 'Shi' }))
    ok(await call('raceJoin', 'alex', { code, name: 'Alex' }))
    const { cue } = ok(await call('raceStart', 'host', { code })) as { cue: number }

    expect(await call('raceFinish', 'stranger', { code })).toMatchObject({ success: false, code: 'not_in_race' })
    expect(await call('raceFinish', 'alex', { code })).toMatchObject({ success: false, code: 'no_round' })
    // A cue guessed before the deal, or a different cue, doesn't count.
    seats.alex = { cue, opened: 49_000, lastLook: 49_500, guessed: true, looks: 1 }
    expect(await call('raceFinish', 'alex', { code })).toMatchObject({ success: false, code: 'no_round' })
    seats.alex = { cue: cue + 1, opened: 51_000, lastLook: 60_000, guessed: true, looks: 1 }
    expect(await call('raceFinish', 'alex', { code })).toMatchObject({ success: false, code: 'no_round' })
    // Still acting: no result yet.
    seats.alex = { cue, opened: 51_000, lastLook: 60_000, guessed: false, looks: 2 }
    expect(await call('raceFinish', 'alex', { code })).toMatchObject({ success: false, code: 'not_finished' })

    seats.alex = { cue, opened: 51_000, lastLook: 73_400, guessed: true, looks: 3 }
    expect(ok(await call('raceFinish', 'alex', { code }))).toMatchObject({ outcome: 'guessed', ms: 23_400, looks: 3, name: 'Alex', round: 1 })
    // Asking again returns the same finish, never a second row.
    seats.alex = { cue, opened: 51_000, lastLook: 99_000, guessed: true, looks: 4 }
    expect(ok(await call('raceFinish', 'alex', { code }))).toMatchObject({ ms: 23_400 })
    expect(room.rows('race_results')).toHaveLength(1)

    seats.host = { cue, opened: 50_500, lastLook: 80_000, guessed: false, looks: 5 }
    expect(ok(await call('raceFinish', 'host', { code }))).toMatchObject({ outcome: 'out', ms: 0, looks: 5 })
  })

  it('says so when the AI booth cannot be asked, rather than guessing', async () => {
    const room = recordRoom()
    const actions = createRaceActions(async () => undefined, () => 1000, () => .1)
    const call = (name: string, userId: string, params: Record<string, unknown>) =>
      actions[name]({ userId, params, tools: room.tools, env: {} as Env, callerJwt: 'token' }) as Promise<ActionResult<Record<string, unknown>>>
    const { code } = ok(await call('raceCreate', 'host', { name: 'Shi' }))
    ok(await call('raceJoin', 'alex', { code }))
    ok(await call('raceStart', 'host', { code }))
    expect(await call('raceFinish', 'alex', { code })).toMatchObject({ success: false, code: 'booth_unavailable' })
  })
})
