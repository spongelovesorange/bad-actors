import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../../worker'
import { providerFailureReason, refereeFailure } from './charades-provider'
import { createStageProvider, stageModel, stageProviderEnabled } from './stage-provider'

const frame = 'data:image/png;base64,c3RhZ2U='
function message(text: string, extra = {}) {
  return { success: true, data: { model: 'claude-haiku-4-5-20251001', stop_reason: 'end_turn',
    content: [{ type: 'text', text }], usage: { input_tokens: 80, output_tokens: 7 }, ...extra } }
}

function booth(respond: () => Response) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => respond())
  const provider = createStageProvider({ APP_OWNER_JWT: 'test-owner-token', STAGE_AI_PROVIDER: 'anthropic',
    API_WORKER: { fetch } as unknown as Env['API_WORKER'] })
  return { provider, fetch }
}

describe('hosted Anthropic stage audience', () => {
  it('sends only the frozen picture and blind prompt and sends only text to the referee', async () => {
    const outputs = [message('Taking a sip.'), message('**CORRECT**')]
    const { provider, fetch } = booth(() => Response.json(outputs.shift()))
    await expect(provider.guess(frame)).resolves.toEqual({ text: 'Taking a sip.', model: 'claude-haiku-4-5-20251001', tokens: 87 })
    await expect(provider.judge('Drinking water', 'Taking a sip.')).resolves.toEqual({ verdict: 'correct', model: 'claude-haiku-4-5-20251001', tokens: 87 })
    const bodies = fetch.mock.calls.map(([url, init]) => {
      expect(url).toBe('https://api-worker/api/integrations/anthropic/chat-completion')
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-owner-token')
      expect(init.redirect).toBe('manual')
      expect(init.method).toBe('POST')
      return JSON.parse(String(init.body))
    })
    expect(bodies[0].model).toBe(stageModel)
    expect(bodies[0].messages[0].content[0]).toEqual({ type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'c3RhZ2U=' } })
    expect(JSON.stringify(bodies[0])).not.toContain('Drinking water')
    expect(JSON.stringify(bodies[1])).not.toContain('c3RhZ2U=')
    expect(JSON.parse(bodies[1].messages[0].content)).toEqual({ assignedAction: 'Drinking water', guess: 'Taking a sip.' })
  })

  it.each([
    ['# Taking a selfie', 'Taking a selfie'],
    ['# Selfie\n\nThe performer is holding up a phone and making a peace sign.', 'Selfie'],
    ['# Carrying a casserole dish\n\n' + 'The performer is serving food. '.repeat(8), 'Carrying a casserole dish'],
    ['**Taking a sip.**', 'Taking a sip.'],
    ['# Hands up\n\nor\n\n# I give up', 'unclear'],
    ['# Drinking water\n# Eating cereal', 'unclear'],
    ['Using a phone or taking a picture', 'unclear'],
  ])('speaks one short guess from the returned text (%#)', async (output, expected) => {
    const { provider } = booth(() => Response.json(message(output)))
    await expect(provider.guess(frame)).resolves.toMatchObject({ text: expected, tokens: 87 })
  })

  it.each([
    [() => new Response('sensitive service details', { status: 429 }), 'http_limit'],
    [() => new Response('unauthorized', { status: 403 }), 'http_auth'],
    [() => Response.json({ success: false, code: 'insufficient_credits' }), 'http_limit'],
    [() => new Response('invalid JSON'), 'invalid_response'],
    [() => Response.json(message('guess', { stop_reason: 'max_tokens' })), 'output_limit'],
    [() => Response.json(message('guess', { stop_reason: 'refusal' })), 'refused'],
    [() => Response.json(message('  ')), 'empty_output'],
  ] as const)('does not reissue a failed or incomplete observation (%#)', async (respond, reason) => {
    const { provider, fetch } = booth(respond)
    await expect(provider.guess(frame).catch(providerFailureReason)).resolves.toBe(reason)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('preserves usage and the model identity on an unscorable answer', async () => {
    const { provider } = booth(() => Response.json(message('Yes, they are similar.')))
    await expect(provider.judge('Taking a selfie', 'Holding a camera').catch(refereeFailure))
      .resolves.toEqual({ judgeFailure: 'invalid_verdict', judgeModel: 'claude-haiku-4-5-20251001', judgeTokens: 87 })
  })

  it('requires explicit activation, owner billing and platform transport', () => {
    const settings = { STAGE_AI_PROVIDER: 'anthropic', APP_OWNER_JWT: 'test-owner-token', API_WORKER_URL: 'https://platform.example' }
    expect(stageProviderEnabled(settings)).toBe(true)
    expect(stageProviderEnabled({ ...settings, STAGE_AI_PROVIDER: undefined })).toBe(false)
    expect(stageProviderEnabled({ ...settings, APP_OWNER_JWT: '' })).toBe(false)
    expect(stageProviderEnabled({ ...settings, API_WORKER_URL: undefined })).toBe(false)
  })

  it('refuses externally hosted images and a missing billing identity before sending', async () => {
    const { provider, fetch } = booth(() => { throw Error('Unexpected upstream call') })
    await expect(provider.guess('https://images.example/a.png').catch(providerFailureReason)).resolves.toBe('http_request')
    const unprovisioned = createStageProvider({ STAGE_AI_PROVIDER: 'anthropic', APP_OWNER_JWT: '', API_WORKER: { fetch } as unknown as Env['API_WORKER'] })
    await expect(unprovisioned.guess(frame).catch(providerFailureReason)).resolves.toBe('http_auth')
    expect(fetch).not.toHaveBeenCalled()
  })
})
