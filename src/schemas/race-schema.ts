/**
 * Race rooms: two to six signed-in players act out the same cue, and whoever gets Stubbs to say it
 * first wins. Every player reads these collections live. Nobody writes them from the browser: the
 * race actions in src/actions/race.ts do, so the start time, the finish times and who won all come
 * from the server.
 */
import type { CollectionSchema } from 'deepspace/schema'

const readOnly = { read: true, create: false, update: false, delete: false } as const
const closed = { read: false, create: false, update: false, delete: false } as const

export const racesSchema: CollectionSchema = {
  name: 'races',
  columns: [
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 8 },
    { name: 'host', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'hostName', storage: 'text', interpretation: 'plain', maxLength: 40 },
    // 0 in the lobby; each start or rematch deals a new round.
    { name: 'round', storage: 'number', interpretation: 'plain' },
    // The cue's number in the deck (index + 1), the same number the AI booth uses.
    { name: 'cue', storage: 'number', interpretation: 'plain' },
    // When the round was dealt, in server milliseconds. Finish times count from here.
    { name: 'startedAt', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['code'],
  permissions: { viewer: closed, member: readOnly, admin: readOnly },
}

export const racePlayersSchema: CollectionSchema = {
  name: 'race_players',
  columns: [
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 8 },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', maxLength: 40 },
  ],
  uniqueOn: ['code', 'userId'],
  permissions: { viewer: closed, member: readOnly, admin: readOnly },
}

export const raceResultsSchema: CollectionSchema = {
  name: 'race_results',
  columns: [
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 8 },
    { name: 'round', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', maxLength: 40 },
    // 'guessed' when Judge Monitor ruled a guess correct, 'out' after five looks without one.
    { name: 'outcome', storage: 'text', interpretation: 'plain', required: true },
    // From the deal to the Ready press that won it, measured on the server.
    { name: 'ms', storage: 'number', interpretation: 'plain' },
    { name: 'looks', storage: 'number', interpretation: 'plain' },
  ],
  uniqueOn: ['code', 'round', 'userId'],
  permissions: { viewer: closed, member: readOnly, admin: readOnly },
}

export const raceSchemas = [racesSchema, racePlayersSchema, raceResultsSchema]
