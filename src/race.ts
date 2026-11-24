import { deck } from './deck'

/**
 * Race rules shared by the browser and the race actions. A race room has a four-letter code, like
 * a Jackbox room, made of consonants only so it can't spell a word, and is easy to read aloud.
 */
export const raceLetters = 'BCDFGHJKLMNPQRSTVWXZ'
export const raceCodeLength = 4
/** Two to six players, so every face on the board stays readable. */
export const minRacers = 2
export const maxRacers = 6
/** The AI booth's five looks per round. A player who spends them all is out. */
export const raceLooks = 5

export function newRaceCode(random: () => number = Math.random) {
  let code = ''
  for (let i = 0; i < raceCodeLength; i++) code += raceLetters[Math.floor(random() * raceLetters.length)]
  return code
}

/** Reads a typed or linked code: case and spaces don't matter, anything else is refused. */
export function readRaceCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.replace(/\s+/g, '').toUpperCase()
  return new RegExp(`^[${raceLetters}]{${raceCodeLength}}$`).test(code) ? code : null
}

/** A display name for the board: trimmed, one line, short. */
export function raceName(value: unknown): string {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 32) : ''
  return name || 'Player'
}

/** Deals a cue number (deck index + 1) for the next round, never the one just played. */
export function dealCue(previous: number, random: () => number = Math.random) {
  const choices = deck.map((_, index) => index + 1).filter(cue => cue !== previous)
  return choices[Math.floor(random() * choices.length)]
}

export type RaceOutcome = 'guessed' | 'out'
export type RaceResult = { userId: string; name: string; outcome: RaceOutcome; ms: number; looks: number }

/** Fastest guessed first, fewer looks breaking a tie; players who ran out of looks after them. */
export function rankResults<T extends RaceResult>(results: T[]): T[] {
  return [...results].sort((a, b) =>
    a.outcome !== b.outcome ? (a.outcome === 'guessed' ? -1 : 1)
      : a.outcome === 'guessed' ? a.ms - b.ms || a.looks - b.looks
        : a.name.localeCompare(b.name))
}

/** 23_456 ms reads "0:23.4". */
export function formatRaceTime(ms: number) {
  const tenths = Math.max(0, Math.floor(ms / 100))
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`
}
