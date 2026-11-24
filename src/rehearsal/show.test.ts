import { afterEach, describe, expect, it, vi } from 'vitest'
import { cueTitles, deck, levels } from '../deck'
import { cues } from '../server/stage-protocol'
import { actsPerShow, cuesInLevel, drawShow, levelOf, mergeBest, nextLevel, readBest, recordBest, reviewFor, scoreOf, starsFor, unlocked } from './show'

afterEach(() => vi.unstubAllGlobals())

describe('the deck and five nights at the hall', () => {
  it('shares one list of thirty distinct cues, six per night, with the referee', () => {
    expect(cues).toEqual(cueTitles)
    expect(new Set(cueTitles).size).toBe(30)
    expect(levels.map(level => level.id)).toEqual([1, 2, 3, 4, 5])
    for (const { id } of levels) expect(cuesInLevel(id)).toHaveLength(6)
    expect(deck.slice(0, 6).every(cue => cue.sketch)).toBe(true)
    // The first eighteen keep their numbers, so a round started before the new cues still scores.
    expect(cueTitles.slice(0, 3)).toEqual(['Drinking water', 'Talking on the phone', 'Taking a selfie'])
    expect(cueTitles[17]).toBe('Yawning')
  })

  it('gives every night its own trouble, opener and pace, and every cue a director’s note', () => {
    expect(new Set(levels.map(level => level.twist.id)).size).toBe(levels.length)
    expect(new Set(levels.map(level => level.opener)).size).toBe(levels.length)
    expect(levels.map(level => level.seconds)).toEqual([45, 45, 45, 40, 30])
    for (const cue of deck) expect(cue.quip.length).toBeGreaterThan(10)
    // The Catch! night flings a prop for every act; the Feel it night has a mood on every card.
    expect(cuesInLevel(2).every(index => deck[index].prop)).toBe(true)
    expect(cuesInLevel(3).every(index => deck[index].mood)).toBe(true)
    expect(levelOf(4).twist.name).toBe('Lights out')
  })

  it('draws five different cues from the chosen night', () => {
    for (const { id } of levels) {
      const show = drawShow(id)
      expect(show.queue).toHaveLength(actsPerShow)
      expect(new Set(show.queue).size).toBe(actsPerShow)
      expect(show.queue.every(index => deck[index].level === id)).toBe(true)
      expect(show.results).toEqual([])
    }
  })

  it('awards stars for quick hits, one more for method acting, none for a miss, and a notice per night', () => {
    expect([1, 2, 3, 4, 5].map(looks => starsFor({ guessed: true, looks }))).toEqual([3, 2, 2, 1, 1])
    expect(starsFor({ guessed: true, looks: 1, feeling: true })).toBe(4)
    expect(starsFor({ guessed: false, looks: 1, feeling: true })).toBe(0)
    const results = [
      { cue: 0, guessed: true, looks: 1 }, { cue: 1, guessed: false, looks: 5 }, { cue: 2, guessed: true, looks: 3, feeling: true },
    ]
    expect(scoreOf(results)).toEqual({ score: 2, stars: 6 })
    for (const { id } of levels) {
      for (let score = -1; score <= 6; score++) expect(reviewFor(score, id)).toMatch(/\w/)
      expect(reviewFor(5, id)).not.toBe(reviewFor(0, id))
    }
    expect(reviewFor(0, 4)).not.toBe(reviewFor(0, 1))
  })

  it('opens a night after three acts guessed in the one before and keeps the best evening', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) } })
    expect(unlocked(1, {})).toBe(true)
    expect(unlocked(2, {})).toBe(false)
    const two = [true, true, false, false, false].map((guessed, cue) => ({ cue, guessed, looks: 2 }))
    let best = recordBest({}, 1, two)
    expect(unlocked(2, best)).toBe(false)
    const three = [true, true, true, false, false].map((guessed, cue) => ({ cue, guessed, looks: 1 }))
    best = recordBest(best, 1, three)
    expect(best[1]).toEqual({ score: 3, stars: 9 })
    expect(unlocked(2, best)).toBe(true)
    expect(unlocked(5, best)).toBe(false)
    expect(recordBest(best, 1, two)[1]).toEqual({ score: 3, stars: 9 })
    best = recordBest(best, 4, three)
    expect(unlocked(5, best)).toBe(true)
    expect(readBest()).toEqual(best)
    expect(nextLevel(1)).toBe(2)
    expect(nextLevel(4)).toBe(5)
    expect(nextLevel(5)).toBeUndefined()
  })

  it('merges this browser’s evenings with the account’s, night by night, keeping the better of each', () => {
    const browser = { 1: { score: 3, stars: 7 }, 2: { score: 1, stars: 2 } }
    const account = { 1: { score: 3, stars: 9 }, 2: { score: 0, stars: 0 }, 4: { score: 5, stars: 15 } }
    expect(mergeBest(browser, account)).toEqual({ 1: { score: 3, stars: 9 }, 2: { score: 1, stars: 2 }, 4: { score: 5, stars: 15 } })
    expect(mergeBest(account, browser)).toEqual(mergeBest(browser, account))
    expect(mergeBest({}, {})).toEqual({})
  })
})
