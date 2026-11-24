import { apiWorkerFetch } from 'deepspace/server'
import type { Env } from '../../worker'
import { drawAngle, ProviderFailure, readStubbsReply, refereePrompt, scoreVerdict, visionPrompt, visionRequest, type Completion, type StageProvider } from './charades-provider'

/**
 * Haiku 4.5 read the phone at the ear as a selfie and the hands over the eyes as a
 * lifted box on our puppet; Haiku 5.5 read both. The referee is a one-word text
 * classification that already passed on Haiku 4.5 at temperature 0, so it stays.
 */
export const visionModel = 'claude-haiku-5-5'
export const judgeModel = 'claude-haiku-4-5'
/** v3 acts out bracketed cues such as [snorts] and [laughs]; a short remark takes two or three seconds. */
export const voiceModel = 'eleven_v3'
/** "Georg": a quavering, gruff ninety-year-old, picked by ear from five comic voices for the front-row heckler. */
const stubbsVoice = 'LRpNiUBlcqgIsKUzcrlN'
const mp3Prefix = /^data:audio\/(?:mpeg|mp3);base64,/
const pngPrefix = 'data:image/png;base64,'
type StageBindings = Pick<Env, 'APP_OWNER_JWT' | 'API_WORKER' | 'API_WORKER_URL' | 'STAGE_AI_PROVIDER'>
type Message = {
  model?: unknown
  stop_reason?: unknown
  content?: { type?: string; text?: unknown }[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

export function stageProviderEnabled(env: StageBindings): boolean {
  return env.STAGE_AI_PROVIDER === 'anthropic' && Boolean(env.APP_OWNER_JWT && (env.API_WORKER || env.API_WORKER_URL))
}

function httpFailure(status: number) {
  if (status === 401 || status === 403) return new ProviderFailure('http_auth')
  if (status === 402 || status === 429) return new ProviderFailure('http_limit')
  return new ProviderFailure(status >= 500 ? 'http_server' : 'http_request')
}

/** Called after the game has authenticated the player and reserved their observation. */
export function createStageProvider(env: StageBindings): StageProvider {
  async function complete(kind: 'vision' | 'referee', body: Record<string, unknown>): Promise<Completion> {
    if (!stageProviderEnabled(env)) throw new ProviderFailure('http_auth')
    const model = kind === 'vision' ? visionModel : judgeModel
    // Haiku 5.5 thinks before it answers and rejects sampling overrides. The integration
    // does not forward thinking or effort settings, so the budget leaves room for both.
    const request = kind === 'vision' ? { model, max_tokens: 3000, ...body } : { model, temperature: 0, max_tokens: 24, ...body }
    const signal = AbortSignal.timeout(25_000)
    let response: Response
    try {
      response = await apiWorkerFetch(env, '/api/integrations/anthropic/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.APP_OWNER_JWT },
        body: JSON.stringify(request),
        // workerd supports manual redirects; the status check rejects every 3xx.
        redirect: 'manual',
        signal,
      })
    } catch { throw new ProviderFailure(signal.aborted ? 'timeout' : 'connection') }

    let envelope: { success?: boolean; code?: string; status?: number; data?: Message } | null
    try { envelope = await response.json() }
    catch {
      if (!response.ok) throw httpFailure(response.status)
      throw new ProviderFailure(signal.aborted ? 'timeout' : 'invalid_response')
    }
    // The integration reports a reply whose whole budget went to reasoning as its own failure.
    if (envelope?.code === 'output_budget_exhausted') throw new ProviderFailure('output_limit', { model })
    if (!response.ok) throw httpFailure(response.status)
    if (envelope?.success === false) {
      if (envelope.code === 'insufficient_credits') throw new ProviderFailure('http_limit')
      throw httpFailure(envelope.status ?? 502)
    }
    const data = envelope?.data
    if (envelope?.success !== true || !data || !Array.isArray(data.content)) throw new ProviderFailure('invalid_response')
    const { input_tokens, output_tokens } = data.usage ?? {}
    const details = {
      model: typeof data.model === 'string' && /^[\w./:-]{1,96}$/.test(data.model) ? data.model : model,
      tokens: typeof input_tokens === 'number' && typeof output_tokens === 'number' &&
        Number.isSafeInteger(input_tokens) && Number.isSafeInteger(output_tokens) && input_tokens >= 0 && output_tokens >= 0
        ? input_tokens + output_tokens : undefined,
    }
    if (data.stop_reason === 'max_tokens') throw new ProviderFailure('output_limit', details)
    if (data.stop_reason === 'refusal') throw new ProviderFailure('refused', details)
    if (data.stop_reason !== 'end_turn' && data.stop_reason !== 'stop_sequence') throw new ProviderFailure('invalid_response', details)
    // Thinking blocks never reach the stage; only the visible answer does.
    const raw = data.content.filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text).join(kind === 'vision' ? '\n' : ' ').trim()
    if (!raw) throw new ProviderFailure('empty_output', details)
    if (raw.length > (kind === 'vision' ? 2048 : 200)) throw new ProviderFailure('invalid_response', details)
    if (kind === 'referee') return { ...details, text: raw }
    const { guess, line, delivery } = readStubbsReply(raw)
    return { ...details, text: guess, line, ...(delivery && { delivery }) }
  }

  /** Mono 32 kbps MP3: a five-second line is about 20 KB, small enough to keep beside its look. */
  async function speak(text: string): Promise<string> {
    if (!stageProviderEnabled(env)) throw new ProviderFailure('http_auth')
    const signal = AbortSignal.timeout(15_000)
    let response: Response
    try {
      response = await apiWorkerFetch(env, '/api/integrations/elevenlabs/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.APP_OWNER_JWT },
        body: JSON.stringify({ text, voice_id: stubbsVoice, model_id: voiceModel, output_format: 'mp3_22050_32' }),
        redirect: 'manual',
        signal,
      })
    } catch { throw new ProviderFailure(signal.aborted ? 'timeout' : 'connection') }
    let envelope: { success?: boolean; code?: string; status?: number; data?: { audioUrl?: unknown } } | null
    try { envelope = await response.json() }
    catch {
      if (!response.ok) throw httpFailure(response.status)
      throw new ProviderFailure(signal.aborted ? 'timeout' : 'invalid_response')
    }
    if (!response.ok) throw httpFailure(response.status)
    if (envelope?.success === false) {
      if (envelope.code === 'insufficient_credits') throw new ProviderFailure('http_limit')
      throw httpFailure(envelope.status ?? 502)
    }
    const url = envelope?.data?.audioUrl
    if (envelope?.success !== true || typeof url !== 'string' || !mp3Prefix.test(url)) throw new ProviderFailure('invalid_response')
    const audio = url.replace(mp3Prefix, '')
    if (!audio || audio.length > 400_000 || audio.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) throw new ProviderFailure('invalid_response')
    return audio
  }

  return {
    visionModel,
    judgeModel,
    speak,
    async guess(image, missed = [], mood) {
      if (!image.startsWith(pngPrefix)) throw new ProviderFailure('http_request')
      return complete('vision', { system: visionPrompt, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image.slice(pngPrefix.length) } },
        { type: 'text', text: visionRequest(missed, drawAngle(), mood) },
      ] }] })
    },
    async judge(cue, guess) {
      const result = await complete('referee', { system: refereePrompt,
        messages: [{ role: 'user', content: JSON.stringify({ assignedAction: cue, guess }) }] })
      return scoreVerdict(result)
    },
  }
}
