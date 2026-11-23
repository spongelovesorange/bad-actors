import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '../../worker'
import { registerAuthAndIntegrationRoutes } from './http-routes'

describe('public rehearsal', () => {
  it.each([
    'anthropic/chat-completion',
    'elevenlabs/generate-speech',
    'speech/speech-to-text',
  ])('keeps the generic %s billing route closed', async (endpoint) => {
    const app = new Hono<AppContext>()
    registerAuthAndIntegrationRoutes(app)
    const upstream = vi.fn()
    const response = await app.request('/api/integrations/' + endpoint, {
      method: 'POST',
    }, { API_WORKER: { fetch: upstream } })
    expect(response.status).toBe(404)
    expect(upstream).not.toHaveBeenCalled()
  })
})
