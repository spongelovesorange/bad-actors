import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudience } from './audience-round'
import { AudienceError, audienceIssue } from './audience-issue'

afterEach(() => vi.unstubAllGlobals())

describe('the hosted theatre', () => {
  it('checks public availability without a session, login request or paid operation', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ available: false }))
      .mockResolvedValueOnce(Response.json({ available: false, requiresLogin: true }))
    vi.stubGlobal('fetch', fetch)
    const audience = createAudience('hosted')
    const { signal } = new AbortController()
    await expect(audience.status(signal)).resolves.toBe('unconfigured')
    await expect(audience.status(signal)).resolves.toBe('signin')
    for (const [url, settings] of fetch.mock.calls) {
      expect(url).toBe('/api/stage-ai/status')
      expect(settings?.credentials).toBe('omit')
      expect(settings?.method ?? 'GET').toBe('GET')
      expect(new Headers(settings?.headers).has('Authorization')).toBe(false)
    }
  })

  it('uses a fresh native bearer for status, round and the actor-only observation', async () => {
    const receipt = { roundId: 'r', observationId: 'o', limit: 5, used: 1, guess: 'A phone call.', verdict: 'correct' }
    const frame = { roundId: 'r', observationId: 'o', image: 'data:image/png;base64,...' }
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ available: true }))
      .mockResolvedValueOnce(Response.json({ roundId: 'r', limit: 5 }))
      .mockResolvedValueOnce(Response.json(receipt))
    vi.stubGlobal('fetch', fetch)
    const token = vi.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two').mockResolvedValueOnce('three')
    const client = createAudience('hosted', token)
    const { signal } = new AbortController()
    expect(await client.status(signal)).toBe('live')
    expect(await client.start(2, signal)).toEqual({ roundId: 'r', limit: 5 })
    expect(await client.observe(frame, signal, vi.fn())).toEqual(receipt)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/stage-ai/status', '/api/stage-ai/rounds', '/api/stage-ai/observe'])
    expect(fetch.mock.calls.map(([, opts]) => new Headers(opts?.headers).get('Authorization')))
      .toEqual(['Bearer one', 'Bearer two', 'Bearer three'])
    expect(fetch.mock.calls.every(([, opts]) => opts?.redirect === 'error')).toBe(true)
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ cue: 2 })
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual(frame)
  })

  it('handles a missing sign-in and a broken service as server-side failures', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'unauthorized' }, { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const client = createAudience('hosted', async () => null)
    const { signal } = new AbortController()
    expect(await client.status(signal)).toBe('signin')
    expect(await client.status(signal)).toBe('offline')
    expect(audienceIssue(new AudienceError('Unauthorized', 401), 'observe', 4, true).issue).toMatch(/sign-in/)
    expect(audienceIssue(new TypeError(), 'observe', 4, true).message).toMatch(/same picture/)
    expect(audienceIssue(new AudienceError('', 503, 'unavailable'), 'start', 5, true).message).toMatch(/public stage/)
  })
})
