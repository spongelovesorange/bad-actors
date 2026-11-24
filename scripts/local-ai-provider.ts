import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { parseEnv } from 'node:util'

import { drawAngle, ProviderFailure, readStubbsReply, refereePrompt, scoreVerdict, visionPrompt, visionRequest, type Completion, type StageProvider } from '../src/server/charades-provider'
export { providerFailureReason, refereeFailure, type Verdict } from '../src/server/charades-provider'
export type OwnProvider = StageProvider

// Vite's public assets are served and copied verbatim, outside server.fs.deny.
export function privateProfilePaths(path: string | undefined, publicDir: string): string[] {
  if (!path) return []
  const paths = new Set([resolve(path)])
  if (existsSync(path)) paths.add(realpathSync(path))
  const publicPaths = [resolve(publicDir)]
  if (existsSync(publicDir)) publicPaths.push(realpathSync(publicDir))
  for (const candidate of paths) {
    for (const dir of publicPaths) {
      const part = relative(dir, candidate)
      if (part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part)) {
        throw new Error('Move the local AI profile outside the public assets directory.')
      }
    }
  }
  return [...paths]
}

// Only the local Node process imports this module. Profiles are parsed without executing shell code.
export function readOwnProvider(profilePath: string, send: typeof fetch = fetch): OwnProvider {
  const config = parseEnv(readFileSync(profilePath, 'utf8'))
  const key = config.OPENAI_API_KEY || config.PLANB_AI_KEY
  const sharedModel = process.env.BAD_ACTORS_AI_MODEL || config.BAD_ACTORS_AI_MODEL || 'gpt-6.2-sol'
  const visionModel = process.env.BAD_ACTORS_VISION_MODEL || config.BAD_ACTORS_VISION_MODEL || sharedModel
  const judgeModel = process.env.BAD_ACTORS_REFEREE_MODEL || config.BAD_ACTORS_REFEREE_MODEL || sharedModel
  const endpoint = new URL(config.OPENAI_BASE_URL || config.PLANB_AI_BASE_URL || 'https://api.openai.com/v1')
  const prefix = endpoint.pathname.replace(/\/+$/, '')
  endpoint.pathname = prefix
  const approvedLocalExperiment = endpoint.href === 'http://38.92.25.168:3000/v1'
  if (!key || /[\r\n]/.test(key) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.hostname === '38.92.25.168' && !approvedLocalExperiment) ||
      (endpoint.protocol !== 'https:' && !approvedLocalExperiment)) {
    throw new Error('Invalid local AI profile.')
  }
  endpoint.pathname = prefix + '/chat/completions'

  async function complete(model: string, messages: unknown[], maxCompletionTokens: number, longest = 200): Promise<Completion> {
    const signal = AbortSignal.timeout(30_000)
    let response: Response
    try {
      response = await send(endpoint, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, max_completion_tokens: maxCompletionTokens, messages }),
      })
    } catch { throw new ProviderFailure(signal.aborted ? 'timeout' : 'connection') }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new ProviderFailure('http_auth')
      if (response.status === 429) throw new ProviderFailure('http_limit')
      throw new ProviderFailure(response.status >= 500 ? 'http_server' : 'http_request')
    }
    type Payload = {
      choices?: { finish_reason?: unknown; message?: { content?: unknown; refusal?: unknown } }[]
      model?: unknown; usage?: { total_tokens?: number }
    }
    let data: Payload | null
    try { data = await response.json() as Payload | null }
    catch { throw new ProviderFailure(signal.aborted ? 'timeout' : 'invalid_response') }
    if (!data || !Array.isArray(data.choices) || !data.choices[0]) throw new ProviderFailure('invalid_response')
    const choice = data.choices[0]
    const details = {
      model: typeof data.model === 'string' && /^[A-Za-z0-9_./:-]{1,96}$/.test(data.model) ? data.model : model,
      tokens: Number.isSafeInteger(data.usage?.total_tokens) ? data.usage?.total_tokens : undefined,
    }
    if (choice.finish_reason === 'length') throw new ProviderFailure('output_limit', details)
    if (choice.finish_reason === 'content_filter' || choice.message?.refusal) throw new ProviderFailure('refused', details)
    const content = choice.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new ProviderFailure('empty_output', details)
    if (content.length > longest) throw new ProviderFailure('invalid_response', details)
    return { ...details, text: content.trim() }
  }

  return {
    visionModel, judgeModel,
    // The same Stubbs brief and two-line reply as the hosted stage.
    async guess(image, missed = [], mood) {
      const read = await complete(visionModel, [
        { role: 'system', content: visionPrompt },
        { role: 'user', content: [{ type: 'text', text: visionRequest(missed, drawAngle(), mood) }, { type: 'image_url', image_url: { url: image } }] },
      ], 1024, 2048)
      const { guess, line } = readStubbsReply(read.text)
      return { ...read, text: guess, line }
    },
    async judge(cue, guess) {
      const result = await complete(judgeModel, [
        { role: 'system', content: refereePrompt },
        { role: 'user', content: JSON.stringify({ assignedAction: cue, guess }) },
      ], 1024)
      return scoreVerdict(result)
    },
  }
}
