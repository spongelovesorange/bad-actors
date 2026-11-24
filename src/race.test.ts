import { describe, expect, it } from 'vitest'
import { deck } from './deck'
import { dealCue, formatRaceTime, newRaceCode, raceName, rankResults, readRaceCode, type RaceResult } from './race'

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

  it('reads a time like a stopwatch', () => {
    expect(formatRaceTime(23_456)).toBe('0:23.4')
    expect(formatRaceTime(61_050)).toBe('1:01.0')
    expect(formatRaceTime(-5)).toBe('0:00.0')
  })
})
