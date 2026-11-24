import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { readOwnProvider, type OwnProvider } from './local-ai-provider'
import { openObservationQuota } from './local-ai-quota'
import { createLocalAudience, failure, maxBodyBytes, type LocalReply, type VisionGuess } from './local-ai-service'

const cookieName = 'ba_practice_audience'
const base = '/api/local-ai/'
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function localRequestAllowed(remoteAddress: string | undefined, host: string | undefined, origin: string | undefined, method: string | undefined) {
  if (!loopback.has(remoteAddress ?? '') || !host || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i.test(host)) return false
  if (!origin) return method === 'GET'
  return origin === 'http://' + host || origin === 'https://' + host
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const bytes: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > maxBodyBytes) return null
    chunks.push(bytes)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch { return null }
}

async function streamObservation(res: ServerResponse, observe: (onGuess: (guess: VisionGuess) => void) => Promise<LocalReply>) {
  if (res.destroyed) return
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-transform')
  res.flushHeaders()
  let reply: LocalReply
  try {
    reply = await observe(guess => {
      if (!res.destroyed) res.write(JSON.stringify({ type: 'guess', ...guess }) + '\n')
    })
  } catch {
    reply = failure(503, 'unavailable', 'The local audience could not take a look.')
  }
  // Finishing the reserved work lets a disconnected player recover the same result by ID.
  if (!res.destroyed) res.end(JSON.stringify({ type: 'result', status: reply.status, body: reply.body }) + '\n')
}

export function localAudiencePlugin(project: string, profile?: string): Plugin {
  return {
    name: 'local-charades-audience',
    apply: 'serve',
    configureServer(server) {
      let provider: OwnProvider | undefined
      let quota: ReturnType<typeof openObservationQuota> | undefined
      if (profile) {
        try {
          provider = readOwnProvider(profile)
          const dir = join(project, '.local')
          mkdirSync(dir, { recursive: true, mode: 0o700 })
          quota = openObservationQuota(join(dir, 'audience-quota.sqlite'))
        } catch {
          provider = undefined
          server.config.logger.warn('The local audience could not open its AI profile or quota ledger. Rehearsal is available.')
        }
      }
      const audience = createLocalAudience({ provider, claim: (id, at) => quota?.claim(id, at) ?? false })
      server.httpServer?.once('close', () => quota?.close())
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (!path?.startsWith(base)) return next()
        const send = (reply: ReturnType<typeof failure>) => {
          res.statusCode = reply.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          if (reply.cookie) res.setHeader('Set-Cookie', cookieName + '=' + reply.cookie + '; Path=/api/local-ai/; HttpOnly; SameSite=Strict; Max-Age=86400')
          res.end(JSON.stringify(reply.body))
        }
        if (!localRequestAllowed(req.socket.remoteAddress, req.headers.host, req.headers.origin, req.method) ||
            req.headers['sec-fetch-site'] === 'cross-site') {
          return send(failure(403, 'local_only', 'Open this rehearsal on the local computer.'))
        }
        if (req.method === 'GET' && path === base + 'status') return send(audience.status())
        if (req.method !== 'POST' || (path !== base + 'rounds' && path !== base + 'observe')) {
          return send(failure(404, 'not_found', 'Unknown rehearsal action.'))
        }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json' || req.headers['content-encoding']) {
          return send(failure(415, 'invalid_type', 'Send a JSON rehearsal request.'))
        }
        if (Number(req.headers['content-length']) > maxBodyBytes) return send(failure(413, 'too_large', 'That snapshot is too large.'))
        const sessionId = (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? ''
        try {
          const input = await readJson(req)
          if (!input) return send(failure(400, 'invalid_request', 'The rehearsal request could not be read.'))
          if (path === base + 'rounds') return send(audience.start(sessionId, input))
          if (req.headers.accept?.split(',').some(type => type.trim() === 'application/x-ndjson')) {
            return streamObservation(res, onGuess => audience.observe(sessionId, input, onGuess))
          }
          return send(await audience.observe(sessionId, input))
        } catch {
          return send(failure(503, 'unavailable', 'The local audience could not take a look.'))
        }
      })
    },
  }
}
