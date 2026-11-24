import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { dealCue, maxRacers, minRacers, newRaceCode, raceLooks, raceName, readRaceCode, type RaceResult } from '../race'

/**
 * The race referee. Browsers only read the race collections; every write happens here, with the
 * caller's identity from the verified session. The deal time is this server's clock, and a finish
 * is accepted only when the AI booth itself has the player's round guessed (or spent) on this
 * round's cue, so a time can't be typed in, replayed, or carried over from an earlier game.
 */
type Race = { code: string; host: string; hostName: string; round: number; cue: number; startedAt: number }
type Player = { code: string; userId: string; name: string }
export type Standing = { cue: number; opened: number; lastLook: number; guessed: boolean; looks: number } | null

const refuse = (code: string, error: string): ActionResult => ({ success: false, code, error })
const duplicate = (result: ActionResult) => !result.success && /duplicate/i.test(result.error)

async function findRace(tools: ActionTools, code: string) {
  const found = await tools.query<Race>('races', { where: { code }, limit: 1 })
  return found.success ? found.data.records[0] : undefined
}
async function listPlayers(tools: ActionTools, code: string) {
  const found = await tools.query<Player>('race_players', { where: { code }, limit: maxRacers + 1 })
  return found.success ? found.data.records : []
}

/** Asks the AI booth where the player's current round stands. Only the Worker can reach it. */
export async function askStanding(env: Env, userId: string): Promise<Standing | undefined> {
  const booth = env.STAGE_AUDIENCE.get(env.STAGE_AUDIENCE.idFromName('app:' + env.DEEPSPACE_APP_ID))
  const reply = await booth.fetch('https://stage/standing', { headers: { 'x-stage-user': userId } })
  if (!reply.ok) return undefined
  return ((await reply.json()) as { standing: Standing }).standing
}

/** The booth is injected so the referee can be tested without a Durable Object. */
export function createRaceActions(standing: (env: Env, userId: string) => Promise<Standing | undefined> = askStanding,
  now: () => number = Date.now, random: () => number = Math.random): Record<string, ActionHandler<Env>> {
  return {
    /** Opens a room with a fresh code. The host is its first player. */
    raceCreate: async ({ userId, params, tools }) => {
      const name = raceName(params.name)
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = newRaceCode(random)
        const made = await tools.create('races', { code, host: userId, hostName: name, round: 0, cue: 0, startedAt: 0 })
        if (duplicate(made)) continue
        if (!made.success) return made
        const seated = await tools.create('race_players', { code, userId, name })
        if (!seated.success && !duplicate(seated)) return seated
        return { success: true, data: { code } }
      }
      return refuse('busy', 'Every code we tried was taken. Try again.')
    },

    /** Takes a seat. Joining twice is harmless; a seventh player is turned away. */
    raceJoin: async ({ userId, params, tools }) => {
      const code = readRaceCode(params.code)
      if (!code) return refuse('invalid_code', 'Race codes are four letters.')
      if (!await findRace(tools, code)) return refuse('not_found', `No race has the code ${code}.`)
      const players = await listPlayers(tools, code)
      if (players.some(player => player.data.userId === userId)) return { success: true, data: { code } }
      if (players.length >= maxRacers) return refuse('race_full', `This race already has ${maxRacers} players.`)
      const seated = await tools.create('race_players', { code, userId, name: raceName(params.name) })
      if (!seated.success && !duplicate(seated)) return seated
      return { success: true, data: { code } }
    },

    /** Deals a new cue to everyone. Only the host can, and only with someone to race. */
    raceStart: async ({ userId, params, tools }) => {
      const code = readRaceCode(params.code)
      const race = code && await findRace(tools, code)
      if (!code || !race) return refuse('not_found', 'That race is gone.')
      if (race.data.host !== userId) return refuse('not_host', 'Only the player who opened the room can deal.')
      if ((await listPlayers(tools, code)).length < minRacers) return refuse('need_players', 'Wait for someone to race.')
      const round = race.data.round + 1, cue = dealCue(race.data.cue, random)
      const dealt = await tools.update('races', race.recordId, { round, cue, startedAt: now() })
      if (!dealt.success) return dealt
      return { success: true, data: { round, cue } }
    },

    /** Records the caller's finish for this round, if the AI booth agrees they finished it. */
    raceFinish: async ({ userId, params, tools, env }) => {
      const code = readRaceCode(params.code)
      const race = code && await findRace(tools, code)
      if (!code || !race) return refuse('not_found', 'That race is gone.')
      const { round, cue, startedAt } = race.data
      if (!round) return refuse('not_started', 'The race has not started.')
      const me = (await listPlayers(tools, code)).find(player => player.data.userId === userId)
      if (!me) return refuse('not_in_race', 'Take a seat in this race first.')
      const earlier = await tools.query<RaceResult>('race_results', { where: { code, round, userId }, limit: 1 })
      if (earlier.success && earlier.data.records[0]) return { success: true, data: earlier.data.records[0].data }
      const seat = await standing(env, userId)
      if (seat === undefined) return refuse('booth_unavailable', 'The AI booth is not answering. Try again.')
      if (!seat || seat.cue !== cue || seat.opened < startedAt) return refuse('no_round', 'Act out this round’s cue first.')
      const outcome = seat.guessed ? 'guessed' : seat.looks >= raceLooks ? 'out' : undefined
      if (!outcome) return refuse('not_finished', 'Stubbs hasn’t guessed it yet.')
      // The winning look's Ready press, not the model's reply, stops the clock: a slow answer costs nobody.
      const result = { code, round, userId, name: me.data.name, outcome, looks: seat.looks,
        ms: outcome === 'guessed' ? Math.max(0, seat.lastLook - startedAt) : 0 }
      const saved = await tools.create('race_results', result)
      if (!saved.success && !duplicate(saved)) return saved
      return { success: true, data: result }
    },
  }
}

export const raceActions = createRaceActions()
