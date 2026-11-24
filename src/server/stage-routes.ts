import type { Context, Hono } from 'hono'
import { isAnonymousUserId, type VerifyResult } from 'deepspace/worker'
import type { AppContext, Env } from '../../worker.js'
import { maxBodyBytes } from './stage-protocol.js'
import { stageModel, stageProviderEnabled } from './stage-provider.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

function configured(env: Env) {
  return Boolean(env.STAGE_AUDIENCE) && stageProviderEnabled(env)
}

// Bound the actual bytes, including requests with no Content-Length. Only the
// named internal game action parses the payload or interprets it as a picture.
async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get('Content-Length')) > limit) return null
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        void reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function registerStageRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth) {
  app.use('/api/stage-ai/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'private, no-store, no-transform')
  })

  app.get('/api/stage-ai/status', async (c) => {
    if (!configured(c.env)) return c.json({ available: false, requiresLogin: false })
    const auth = await resolveAuth(c.req.raw, c.env)
    const requiresLogin = !auth?.userId || isAnonymousUserId(auth.userId)
    const available = !requiresLogin
    return c.json({ available, requiresLogin, ...(available && { visionModel: stageModel, judgeModel: stageModel }) })
  })

  async function forward(c: Context<AppContext>, action: 'rounds' | 'observe') {
    const request = c.req.raw
    if (!configured(c.env))
      return c.json({ error: 'unavailable', message: 'The AI audience is unavailable on this stage.' }, 503)
    const auth = await resolveAuth(request, c.env)
    if (!auth?.userId || isAnonymousUserId(auth.userId))
      return c.json({ error: 'sign_in_required', message: 'Sign in to play with the AI audience.' }, 401)
    if (request.headers.get('Origin') !== new URL(request.url).origin ||
        request.headers.get('Sec-Fetch-Site') === 'cross-site')
      return c.json({ error: 'forbidden', message: 'Start the game on this stage.' }, 403)
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
        request.headers.has('Content-Encoding'))
      return c.json({ error: 'invalid_type', message: 'Send an uncompressed JSON request.' }, 415)
    const bytes = await readBody(request, action === 'rounds' ? 1024 : maxBodyBytes)
    if (!bytes) return c.json({ error: 'too_large', message: 'The stage request is too large.' }, 413)
    if (!bytes.length) return c.json({ error: 'invalid_request', message: 'The stage request is empty.' }, 400)

    const namespace = c.env.STAGE_AUDIENCE
    const stub = namespace.get(namespace.idFromName('app:' + c.env.DEEPSPACE_APP_ID))
    return stub.fetch(new Request('https://stage.internal/' + action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: request.headers.get('Accept') || 'application/json',
        'X-Stage-User': auth.userId,
      },
      body: bytes,
    }))
  }

  app.post('/api/stage-ai/rounds', c => forward(c, 'rounds'))
  app.post('/api/stage-ai/observe', c => forward(c, 'observe'))
}
