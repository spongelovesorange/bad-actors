import type { Env } from '../../worker'
import { createStageProvider, stageProviderEnabled } from './stage-provider'
import { StageGame } from './stage-game'
import { failure, type StageReply } from './stage-protocol'

const asJson = (reply: StageReply) => Response.json(reply.body, { status: reply.status })

/** Only the authenticated Worker route can obtain this object's stub. */
export class StageAudience {
  private game?: StageGame

  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (!stageProviderEnabled(this.env)) return asJson(failure(503, 'unavailable', 'The AI audience is offline.'))
    const user = request.headers.get('x-stage-user')
    if (!user) return asJson(failure(401, 'sign_in_required', 'Sign in to play with the AI audience.'))
    const path = new URL(request.url).pathname
    // The race actions ask where a player stands. Only the Worker holds this object's stub, and its
    // public stage route forwards rounds, observe and voice alone, so no browser can reach this.
    if (request.method === 'GET' && path === '/standing') {
      const game = this.game ??= new StageGame(this.state.storage, createStageProvider(this.env), Date.now,
        this.env.STAGE_OWNER_OPEN_REHEARSAL === 'true' ? this.env.OWNER_USER_ID : undefined)
      return Response.json({ standing: game.standing(user) })
    }
    if (request.method !== 'POST' || (path !== '/rounds' && path !== '/observe' && path !== '/voice'))
      return asJson(failure(404, 'not_found', 'Unknown stage action.'))
    let input: unknown
    try { input = await request.json() } catch { input = null }
    if (!input || Array.isArray(input) || typeof input !== 'object')
      return asJson(failure(400, 'invalid_request', 'Send a JSON object.'))
    const body = input as Record<string, unknown>
    const game = this.game ??= new StageGame(this.state.storage, createStageProvider(this.env), Date.now,
      this.env.STAGE_OWNER_OPEN_REHEARSAL === 'true' ? this.env.OWNER_USER_ID : undefined)
    if (path === '/rounds') return asJson(game.start(user, body))
    if (path === '/voice') {
      const reply = await game.voice(user, body)
      if (!('audio' in reply)) return asJson(reply)
      return new Response(reply.audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } })
    }
    if (!request.headers.get('accept')?.split(',').some(type => type.trim() === 'application/x-ndjson'))
      return asJson(await game.observe(user, body))

    const encoder = new TextEncoder()
    let connected = true
    const stream = new ReadableStream<Uint8Array>({
      start: controller => {
        const send = (event: unknown) => {
          if (connected) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        }
        const delivery = game.observe(user, body, words => send({ type: 'guess', ...words }))
          .catch(() => failure(503, 'unavailable', 'The stage could not finish this observation.'))
          .then(result => { send({ type: 'result', ...result }); if (connected) controller.close() })
        this.state.waitUntil(delivery)
      },
      cancel: () => { connected = false },
    })
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform' } })
  }
}
