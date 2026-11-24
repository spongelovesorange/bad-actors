import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { raceActions } from './race'

/** Exposed at POST /api/actions/<name>. The route verifies the caller before any of these runs. */
export const actions: Record<string, ActionHandler<Env>> = { ...raceActions }
