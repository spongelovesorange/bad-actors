import { useEffect, useMemo } from 'react'
import { getAuthToken, usePresenceRoom, useQuery } from 'deepspace'
import { rankResults, scoreMatch, type RaceOutcome } from '../race'

export type RaceAnswer<T> = { ok: true; data: T } | { ok: false; code?: string; error: string }

/** Calls a race action as the signed-in player. The worker checks the session before it runs. */
export async function raceAction<T = Record<string, unknown>>(name: string, params: Record<string, unknown>): Promise<RaceAnswer<T>> {
  try {
    const token = await getAuthToken()
    const reply = await fetch('/api/actions/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
      body: JSON.stringify(params),
    })
    const body = await reply.json().catch(() => ({})) as { success?: boolean; data?: T; code?: string; error?: string }
    if (body.success) return { ok: true, data: body.data as T }
    return { ok: false, code: body.code, error: body.error ?? 'The race desk didn’t answer. Try again.' }
  } catch {
    return { ok: false, code: 'offline', error: 'The race desk didn’t answer. Check the connection and try again.' }
  }
}

type RaceRow = { code: string; host: string; hostName: string; round: number; cue: number; startedAt: number }
type PlayerRow = { code: string; userId: string; name: string }
type ResultRow = { code: string; round: number; userId: string; name: string; outcome: RaceOutcome; ms: number; looks: number }
/** What each player's stage tells the others while they act: never stored, gone when they leave. */
export type RaceProgress = { phase: 'lobby' | 'posing' | 'looking' | 'done'; looks: number }

/**
 * Everything one race room shows, live: the room, its players and this round's finishes come from
 * DeepSpace collections; who is here and what they are doing right now comes from a presence room.
 */
export function useRaceRoom(code: string, me: string, progress: RaceProgress) {
  const races = useQuery<RaceRow>('races', { where: { code }, limit: 1 })
  const seats = useQuery<PlayerRow>('race_players', { where: { code }, orderBy: 'createdAt', orderDir: 'asc', limit: 12 })
  const finishes = useQuery<ResultRow>('race_results', { where: { code }, orderBy: 'createdAt', orderDir: 'asc', limit: 200 })
  const { peers, updateState, connected } = usePresenceRoom('race:' + code)
  useEffect(() => { updateState(progress) }, [updateState, progress, connected])
  const race = races.records[0]?.data
  const round = race?.round ?? 0
  return useMemo(() => {
    const live = new Map(peers.map(peer => [peer.userId, peer.state as Partial<RaceProgress>]))
    const players = seats.records.map(record => record.data)
    const every = finishes.records.map(record => record.data)
    const results = rankResults(every.filter(result => result.round === round))
    const mine = results.find(result => result.userId === me)
    const everyoneDone = players.length > 0 && players.every(player => results.some(result => result.userId === player.userId))
    return {
      loading: races.status === 'loading' || seats.status === 'loading',
      missing: races.status === 'ready' && !race,
      race, round, players, results, mine,
      online: (userId: string) => userId === me || live.has(userId),
      progressOf: (userId: string) => userId === me ? progress : live.get(userId),
      everyoneDone,
      // Every finish of every round is in the collection, so every stage works out the same score.
      match: scoreMatch(every, round, everyoneDone),
    }
  }, [peers, seats.records, finishes.records, round, me, races.status, seats.status, race, progress])
}
