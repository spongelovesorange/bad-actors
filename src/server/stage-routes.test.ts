import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { AppContext, Env } from '../../worker.js'
import type { VerifyResult } from 'deepspace/worker'
import { registerStageRoutes } from './stage-routes.js'

const origin = 'https://the-hall.example'
const auth = { Authorization: 'Bearer session', Origin: origin, 'Content-Type': 'application/json' }

function game(overrides: Partial<Env> = {}) {
  const forwarded = vi.fn<(req: Request) => Promise<Response>>(async () => Response.json({ limit: 5 }))
  const idFromName = vi.fn(() => 'our-instance')
  const bindings = {
    DEEPSPACE_APP_ID: 'app_registered',
    STAGE_AI_PROVIDER: 'anthropic',
    STAGE_AUDIENCE: { get: () => ({ fetch: forwarded }), idFromName },
    API_WORKER: { fetch: vi.fn() },
    APP_OWNER_JWT: 'mock-owner',
    ...overrides,
  } as unknown as Env
  const app = new Hono<AppContext>()
  registerStageRoutes(app, async req => {
    const token = req.headers.get('authorization')
    if (!token) return null
    return { userId: token === auth.Authorization ? 'member-from-auth' : 'anon-guest' } as VerifyResult
  })
  const request = (path: string, init?: RequestInit) => app.request(origin + '/api/stage-ai/' + path, init, bindings)
  return { request, forwarded, idFromName }
}

describe('hosted stage entrypoints', () => {
  it('reports only a configured game and a verified player as available', async () => {
    const { request, forwarded } = game()
    expect(await (await request('status')).json()).toEqual({ available: false, requiresLogin: true })
    const signed = await request('status', { headers: auth })
    expect(await signed.json()).toMatchObject({ available: true, requiresLogin: false })
    expect(signed.headers.get('cache-control')).toContain('no-store')
    expect(forwarded).not.toHaveBeenCalled()
  })

  it.each([{ STAGE_AI_PROVIDER: undefined }, { STAGE_AI_PROVIDER: 'other' }, { APP_OWNER_JWT: '' }])(
    'leaves the free stage closed to paid calls when the provider is unavailable', async controls => {
      const { request, forwarded } = game(controls)
      expect(await (await request('status')).json()).toEqual({ available: false, requiresLogin: false })
      for (const action of ['rounds', 'observe', 'voice']) {
        const response = await request(action, { method: 'POST', headers: auth, body: '{}' })
        expect(response.status).toBe(503)
        expect(await response.json()).toMatchObject({ error: 'unavailable' })
      }
      expect(forwarded).not.toHaveBeenCalled()
    },
  )

  it('rejects a cookie or spoofed user header, anonymous claims and cross-origin writes', async () => {
    const { request, forwarded } = game()
    const unsignedHeaders: HeadersInit[] = [
      { Origin: origin, Cookie: 'fake', 'X-Stage-User': 'other', 'Content-Type': 'application/json' },
      { ...auth, Authorization: 'Bearer guest' },
    ]
    for (const headers of unsignedHeaders) {
      expect((await request('observe', { method: 'POST', headers, body: '{}' })).status).toBe(401)
    }
    for (const headers of [{ ...auth, Origin: 'https://other.example' }, { ...auth, 'Sec-Fetch-Site': 'cross-site' }])
      expect((await request('rounds', { method: 'POST', headers, body: '{}' })).status).toBe(403)
    expect(forwarded).not.toHaveBeenCalled()
  })

  it('rejects unsupported types and enforces byte limits before the game receives the body', async () => {
    const { request, forwarded } = game()
    expect((await request('observe', { method: 'POST', headers: { ...auth, 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415)
    expect((await request('rounds', { method: 'POST', headers: auth, body: '' })).status).toBe(400)
    expect((await request('rounds', { method: 'POST', headers: auth, body: ' '.repeat(1025) })).status).toBe(413)
    expect((await request('observe', { method: 'POST', headers: auth, body: ' '.repeat(820_001) })).status).toBe(413)
    expect(forwarded).not.toHaveBeenCalled()
  })

  it('forwards a small, signed-in voice request and passes the clip straight through', async () => {
    const { request, forwarded } = game()
    forwarded.mockResolvedValueOnce(new Response(new Uint8Array([73, 68, 51]), { headers: { 'Content-Type': 'audio/mpeg' } }))
    const response = await request('voice', { method: 'POST', headers: auth, body: '{"roundId":"r","observationId":"o"}' })
    expect(response.headers.get('content-type')).toBe('audio/mpeg')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([73, 68, 51]))
    const internal = forwarded.mock.calls[0][0]
    expect(new URL(internal.url).pathname).toBe('/voice')
    expect(internal.headers.get('x-stage-user')).toBe('member-from-auth')
    expect((await request('voice', { method: 'POST', headers: auth, body: ' '.repeat(1025) })).status).toBe(413)
    expect((await request('voice', { method: 'POST', headers: { ...auth, Authorization: 'Bearer guest' }, body: '{}' })).status).toBe(401)
    expect(forwarded).toHaveBeenCalledTimes(1)
  })

  it('uses one app ledger and forwards only the verified identity, negotiation and JSON payload', async () => {
    const { request, forwarded, idFromName } = game()
    const ndjson = '{"type":"guess"}\n{"type":"result"}\n'
    forwarded.mockResolvedValueOnce(new Response(ndjson, { headers: { 'Content-Type': 'application/x-ndjson' } }))
    const accept = 'application/x-ndjson, application/json'
    const response = await request('observe', {
      method: 'POST', headers: { ...auth, Accept: accept, 'X-Stage-User': 'forged', 'X-App-Id': 'other', Cookie: 'cookie' },
      body: '{"image":"mock-png"}',
    })
    expect(response.headers.get('content-type')).toBe('application/x-ndjson')
    expect(await response.text()).toBe(ndjson)
    expect(idFromName).toHaveBeenCalledWith('app:app_registered')
    const internal = forwarded.mock.calls[0][0]
    expect(new URL(internal.url).pathname).toBe('/observe')
    expect(Object.fromEntries(internal.headers)).toEqual({
      accept, 'content-type': 'application/json', 'x-stage-user': 'member-from-auth',
    })
    expect(await internal.json()).toEqual({ image: 'mock-png' })
  })
})
