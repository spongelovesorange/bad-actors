/**
 * Each signed-in player's best timed show on each night, so progress and unlocked nights follow the
 * account from one device to the next. A player reads and writes only their own rows: the user
 * column is bound to the caller by the server, and one row per player per night is enforced there.
 */
import type { CollectionSchema } from 'deepspace/schema'

export const showBestsSchema: CollectionSchema = {
  name: 'show_bests',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'level', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'score', storage: 'number', interpretation: 'plain', required: true },
    { name: 'stars', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['userId', 'level'],
  ownerField: 'userId',
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}
