import { describe, expect, it, vi } from 'vitest'
import type { Env } from '../../worker'
import { providerFailureReason, refereeFailure, visionPrompt, visionRequest } from './charades-provider'
import { createStageProvider, judgeModel, stageProviderEnabled, visionModel } from './stage-provider'

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
  it('sends only the frozen picture and Stubbs’s brief to the reader and only text to the referee', async () => {
    const outputs = [message('GUESS: Taking a sip\nLINE: A sip! My tea urn weeps with envy.'), message('**CORRECT**')]
    const { provider, fetch } = booth(() => Response.json(outputs.shift()))
    await expect(provider.guess(frame)).resolves.toEqual({ text: 'Taking a sip', line: 'A sip! My tea urn weeps with envy.',
      model: 'claude-haiku-4-5-20251001', tokens: 87 })
    await expect(provider.judge('Drinking water', 'Taking a sip')).resolves.toEqual({ verdict: 'correct', model: 'claude-haiku-4-5-20251001', tokens: 87 })
    const bodies = fetch.mock.calls.map(([url, init]) => {
      expect(url).toBe('https://api-worker/api/integrations/anthropic/chat-completion')
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-owner-token')
      expect(init.redirect).toBe('manual')
      expect(init.method).toBe('POST')
      return JSON.parse(String(init.body))
    })
    // Haiku 5.5 rejects sampling overrides and spends part of its budget thinking.
    expect(bodies[0]).toMatchObject({ model: visionModel, max_tokens: 3000, system: visionPrompt })
    expect(bodies[0]).not.toHaveProperty('temperature')
    expect(bodies[0].messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'c3RhZ2U=' } },
      { type: 'text', text: 'Here is the frozen pose.' },
    ])
    expect(bodies[1]).toMatchObject({ model: judgeModel, temperature: 0, max_tokens: 24 })
    expect(JSON.stringify(bodies[0])).not.toContain('Drinking water')
    expect(JSON.stringify(bodies[1])).not.toContain('c3RhZ2U=')
    expect(JSON.parse(bodies[1].messages[0].content)).toEqual({ assignedAction: 'Drinking water', guess: 'Taking a sip' })
  })

  it('keeps every cue out of Stubbs’s brief and names only his own ruled-out guesses', async () => {
    expect(visionPrompt + visionRequest(['Waving'])).not.toMatch(/drink|sip|selfie|photo|surrender|phone|call|tray|carry|cover/i)
    const { provider, fetch } = booth(() => Response.json(message('GUESS: Answering a phone call\nLINE: A phone call! Not a selfie, you vain sandbag.')))
    const missed = ['Taking a selfie', 'Waving', 'Hailing a taxi', 'Stretching', 'Checking a message']
    await expect(provider.guess(frame, missed)).resolves.toMatchObject({ text: 'Answering a phone call' })
    const text: string = JSON.parse(String(fetch.mock.calls[0][1].body)).messages[0].content[1].text
    expect(text).toContain('shook their head')
    expect(text).not.toContain('Taking a selfie')
    for (const guess of missed.slice(1)) expect(text).toContain(JSON.stringify(guess))
  })

  it.each([
    ['GUESS: Answering a phone call\nLINE: A phone call! Tell the caller I want my cushion back.',
      'Answering a phone call', 'A phone call! Tell the caller I want my cushion back.'],
    ['**GUESS:** carrying a tray or a baking dish\n\n**LINE:** "A tray! Mind the trifle."', 'carrying a tray', 'A tray! Mind the trifle.'],
    ['GUESS: unclear\nLINE: I cannot make head nor tail of it.', 'unclear', 'I cannot make head nor tail of it.'],
    ['GUESS: Taking a selfie.', 'Taking a selfie', 'Taking a selfie'],
  ])('splits the scored guess from Stubbs’s line (%#)', async (output, guess, line) => {
    const { provider } = booth(() => Response.json(message(output)))
    await expect(provider.guess(frame)).resolves.toMatchObject({ text: guess, line })
  })

  it('trims an overlong line to the sentences that fit the balloon', async () => {
    const { provider } = booth(() => Response.json(message('GUESS: Drinking from a cup\nLINE: ' + 'Sip, sip, hooray! '.repeat(20))))
    const { line } = await provider.guess(frame)
    expect(line!.length).toBeLessThanOrEqual(160)
    expect(line).toMatch(/^Sip, sip, hooray!.*hooray!$/)
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
    [() => Response.json({ ok: false, success: false, code: 'output_budget_exhausted' }, { status: 400 }), 'output_limit'],
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

  it('asks ElevenLabs for one short MP3 in Stubbs’s fixed voice and keeps only its bytes', async () => {
    const { provider, fetch } = booth(() => Response.json({ success: true,
      data: { audioUrl: 'data:audio/mpeg;base64,SUQzBA==', voice_id: 'v', model_id: 'm', output_format: 'f' } }))
    await expect(provider.speak!('A selfie!')).resolves.toBe('SUQzBA==')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api-worker/api/integrations/elevenlabs/generate-speech')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-owner-token')
    expect(init.redirect).toBe('manual')
    expect(JSON.parse(String(init.body))).toEqual({ text: 'A selfie!', voice_id: 'JBFqnCBsd6RMkjVDRZzb',
      model_id: 'eleven_flash_v2_5', output_format: 'mp3_22050_32' })
  })

  it.each([
    [() => Response.json({ success: true, data: { audioUrl: 'https://cdn.example/line.mp3' } }), 'invalid_response'],
    [() => Response.json({ success: true, data: { audioUrl: 'data:audio/mpeg;base64,not base64!' } }), 'invalid_response'],
    [() => Response.json({ success: false, code: 'insufficient_credits' }), 'http_limit'],
    [() => new Response('busy', { status: 503 }), 'http_server'],
  ] as const)('reports a failed clip without asking again (%#)', async (respond, reason) => {
    const { provider, fetch } = booth(respond)
    await expect(provider.speak!('A selfie!').catch(providerFailureReason)).resolves.toBe(reason)
    expect(fetch).toHaveBeenCalledTimes(1)
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
