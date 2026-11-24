import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { rankResults, scoreMatch, type RoundResult } from '../race'
import { RaceBoard } from './RaceBoard'
import type { useRaceRoom } from './race-client'

const players = [{ code: 'KXTP', userId: 'ann', name: 'Ann' }, { code: 'KXTP', userId: 'bo', name: 'Bo' }]
const won = (round: number, userId: string, ms: number): RoundResult & { code: string } =>
  ({ code: 'KXTP', round, userId, name: userId === 'ann' ? 'Ann' : 'Bo', outcome: 'guessed', ms, looks: 1 })

/** The board for Ann, the host, after `round` rounds of these finishes, with everyone done. */
function board(finishes: ReturnType<typeof won>[], round: number) {
  const results = rankResults(finishes.filter(result => result.round === round))
  const room = {
    loading: false, missing: false, round, players, results,
    race: { code: 'KXTP', host: 'ann', hostName: 'Ann', round, cue: 1, startedAt: 0 },
    mine: results.find(result => result.userId === 'ann'),
    online: () => true, progressOf: () => undefined,
    everyoneDone: true, match: scoreMatch(finishes, round, true),
  } as ReturnType<typeof useRaceRoom>
  return renderToStaticMarkup(<RaceBoard room={room} code="KXTP" me="ann" busy={false} onDeal={() => {}} onLeave={() => {}} />)
}

describe('the race board keeps the match score', () => {
  it('shows each round win as a star and the score so far', () => {
    const html = board([won(1, 'ann', 20_000), won(1, 'bo', 24_500), won(2, 'bo', 18_000), won(2, 'ann', 25_000)], 2)
    expect(html).toContain('Bo wins round 2! Match score 1–1, first to 3.')
    expect(html.match(/aria-label="1 of 3 round wins"/g)).toHaveLength(2)
    expect(html).toContain('>Next round<')
  })

  it('crowns whoever takes three rounds, and offers the host a new match', () => {
    const html = board([
      won(1, 'ann', 20_000), won(1, 'bo', 30_000), won(2, 'bo', 18_000), won(2, 'ann', 25_000),
      won(3, 'ann', 30_000), won(3, 'bo', 40_000), won(4, 'ann', 12_000), won(4, 'bo', 20_000),
    ], 4)
    expect(html).toContain('You win the match, 3–1!')
    expect(html).toContain('aria-label="3 of 3 round wins"')
    expect(html).toContain('data-champion="true"')
    expect(html).toContain('>New match<')
    expect(html).not.toContain('>Next round<')
  })
})
