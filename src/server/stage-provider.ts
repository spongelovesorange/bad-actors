import { apiWorkerFetch } from 'deepspace/server'
import type { Env } from '../../worker'
import { ProviderFailure, refereePrompt, scoreVerdict, visionPrompt, type Completion, type StageProvider } from './charades-provider'

export const stageModel = 'claude-haiku-4-5'
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

function spokenGuess(raw: string): string {
  const [first, ...rest] = raw.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const isHeading = /^#{1,6}\s+/
  const guess = first.replace(isHeading, '').replace(/^(\*\*|__|`|"|')(.+)\1$/, '$2').trim()
  // The model sometimes follows its headline with a prose explanation. A
  // second headline or an explicit alternative cannot be read as one guess.
  if (!/[A-Za-z]/.test(guess) || guess.length > 200 || guess.split(/\s+/).length > 12 ||
      /\bor\b/i.test(guess) || rest.some(line => isHeading.test(line) || /^or\b/i.test(line)) ||
      (rest.length && !isHeading.test(first))) return 'unclear'
  return guess
}

/** Called after the game has authenticated the player and reserved their observation. */
export function createStageProvider(env: StageBindings): StageProvider {
  async function complete(kind: 'vision' | 'referee', body: Record<string, unknown>): Promise<Completion> {
    if (!stageProviderEnabled(env)) throw new ProviderFailure('http_auth')
    const signal = AbortSignal.timeout(25_000)
    let response: Response
    try {
      response = await apiWorkerFetch(env, '/api/integrations/anthropic/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.APP_OWNER_JWT },
        body: JSON.stringify({ model: stageModel, temperature: 0, ...body }),
        // workerd supports manual redirects; the status check rejects every 3xx.
        redirect: 'manual',
        signal,
      })
    } catch { throw new ProviderFailure(signal.aborted ? 'timeout' : 'connection') }
    if (!response.ok) throw httpFailure(response.status)

    let envelope: { success?: boolean; code?: string; status?: number; data?: Message } | null
    try { envelope = await response.json() }
    catch { throw new ProviderFailure(signal.aborted ? 'timeout' : 'invalid_response') }
    if (envelope?.success === false) {
      if (envelope.code === 'insufficient_credits') throw new ProviderFailure('http_limit')
      throw httpFailure(envelope.status ?? 502)
    }
    const data = envelope?.data
    if (envelope?.success !== true || !data || !Array.isArray(data.content)) throw new ProviderFailure('invalid_response')
    const { input_tokens, output_tokens } = data.usage ?? {}
    const details = {
      model: typeof data.model === 'string' && /^[\w./:-]{1,96}$/.test(data.model) ? data.model : stageModel,
      tokens: typeof input_tokens === 'number' && typeof output_tokens === 'number' &&
        Number.isSafeInteger(input_tokens) && Number.isSafeInteger(output_tokens) && input_tokens >= 0 && output_tokens >= 0
        ? input_tokens + output_tokens : undefined,
    }
    if (data.stop_reason === 'max_tokens') throw new ProviderFailure('output_limit', details)
    if (data.stop_reason === 'refusal') throw new ProviderFailure('refused', details)
    if (data.stop_reason !== 'end_turn' && data.stop_reason !== 'stop_sequence') throw new ProviderFailure('invalid_response', details)
    const raw = data.content.filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text).join(kind === 'vision' ? '\n' : ' ').trim()
    if (!raw) throw new ProviderFailure('empty_output', details)
    if (raw.length > (kind === 'vision' ? 2048 : 200)) throw new ProviderFailure('invalid_response', details)
    return { ...details, text: kind === 'vision' ? spokenGuess(raw) : raw }
  }

  return {
    visionModel: stageModel,
    judgeModel: stageModel,
    async guess(image) {
      if (!image.startsWith(pngPrefix)) throw new ProviderFailure('http_request')
      return complete('vision', { max_tokens: 80, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image.slice(pngPrefix.length) } },
        { type: 'text', text: visionPrompt },
      ] }] })
    },
    async judge(cue, guess) {
      const result = await complete('referee', { max_tokens: 24, system: refereePrompt,
        messages: [{ role: 'user', content: JSON.stringify({ assignedAction: cue, guess }) }] })
      return scoreVerdict(result)
    },
  }
}
