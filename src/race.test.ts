import { describe, expect, it } from 'vitest'
import { deck } from './deck'
import {
  dealCue, formatMatchScore, formatRaceTime, matchWins, newRaceCode, raceName, rankResults, readRaceCode, scoreMatch,
  type RaceResult, type RoundResult,
} from './race'

describe('race rules', () => {
  it('makes four-consonant codes and reads them back however they are typed', () => {
    const codes = Array.from({ length: 200 }, (_, i) => newRaceCode(() => (i * 7919 % 997) / 997))
    for (const code of codes) expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
    expect(readRaceCode(' kx tp ')).toBe('KXTP')
    expect(readRaceCode('KAT')).toBeNull()
    expect(readRaceCode('KATE')).toBeNull()
    expect(readRaceCode(42)).toBeNull()
  })

  it('keeps names short and on one line', () => {
    expect(raceName('  Shi\n Qiu ')).toBe('Shi Qiu')
    expect(raceName('x'.repeat(80))).toHaveLength(32)
    expect(raceName('')).toBe('Player')
  })

  it('never deals the cue just played', () => {
    for (let previous = 1; previous <= deck.length; previous++)
      for (const roll of [0, .5, .999]) {
        const cue = dealCue(previous, () => roll)
        expect(cue).not.toBe(previous)
        expect(cue).toBeGreaterThanOrEqual(1)
        expect(cue).toBeLessThanOrEqual(deck.length)
      }
  })

  it('ranks the fastest guess first, fewer looks breaking a tie, and anyone out of looks last', () => {
    const results: RaceResult[] = [
      { userId: 'a', name: 'Ann', outcome: 'out', ms: 0, looks: 5 },
      { userId: 'b', name: 'Bo', outcome: 'guessed', ms: 31_000, looks: 1 },
      { userId: 'c', name: 'Cy', outcome: 'guessed', ms: 23_400, looks: 3 },
      { userId: 'd', name: 'Di', outcome: 'guessed', ms: 23_400, looks: 2 },
    ]
    expect(rankResults(results).map(result => result.name)).toEqual(['Di', 'Cy', 'Bo', 'Ann'])
  })

  describe('the match: first to three round wins', () => {
    const won = (round: number, userId: string, ms = 20_000): RoundResult => ({ round, userId, name: userId, outcome: 'guessed', ms, looks: 1 })
    const out = (round: number, userId: string): RoundResult => ({ round, userId, name: userId, outcome: 'out', ms: 0, looks: 5 })
    const players = [{ userId: 'ann' }, { userId: 'bo' }]

    it('gives each round to its fastest guess, and a round nobody guessed to no one', () => {
      const results = [won(1, 'ann', 30_000), won(1, 'bo', 21_000), out(2, 'ann'), out(2, 'bo'), won(3, 'ann'), out(3, 'bo')]
      const score = scoreMatch(results, 3, true)
      expect(score.wins).toEqual(new Map([['bo', 1], ['ann', 1]]))
      expect(score.winner).toBeUndefined()
      expect(formatMatchScore(score, players)).toBe('1–1')
    })

    it('counts the round being played only once it is over', () => {
      const results = [won(1, 'ann'), won(2, 'ann')]
      expect(scoreMatch(results, 2, false).wins.get('ann')).toBe(1)
      expect(scoreMatch(results, 2, true).wins.get('ann')).toBe(2)
    })

    it('ends at three round wins, then the next deal starts a new match at nothing each', () => {
      const results = [won(1, 'ann'), won(2, 'bo'), won(3, 'ann'), won(4, 'ann'), won(5, 'bo')]
      const ended = scoreMatch(results, 4, true)
      expect(ended).toMatchObject({ number: 1, winner: 'ann' })
      expect(formatMatchScore(ended, players)).toBe(`${matchWins}–1`)
      const next = scoreMatch(results, 5, false)
      expect(next.number).toBe(2)
      expect(next.winner).toBeUndefined()
      expect(formatMatchScore(next, players)).toBe('0–0')
      expect(scoreMatch(results, 5, true).wins).toEqual(new Map([['bo', 1]]))
    })

    it('scores nothing before the first deal', () => {
      expect(scoreMatch([], 0, false)).toEqual({ number: 1, wins: new Map() })
    })
  })

  it('reads a time like a stopwatch', () => {
    expect(formatRaceTime(23_456)).toBe('0:23.4')
    expect(formatRaceTime(61_050)).toBe('1:01.0')
    expect(formatRaceTime(-5)).toBe('0:00.0')
  })
})
