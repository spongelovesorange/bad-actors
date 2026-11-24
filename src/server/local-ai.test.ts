import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { localAudiencePlugin, localRequestAllowed } from '../../scripts/local-ai-api'
import { privateProfilePaths, readOwnProvider, refereeFailure, type OwnProvider } from '../../scripts/local-ai-provider'
import { openObservationQuota } from '../../scripts/local-ai-quota'
import { createLocalAudience } from '../../scripts/local-ai-service'

const frames = Array.from({ length: 6 }, (_, i) => 'data:image/png;base64,' + readFileSync(
  new URL('../../docs/verification/six-poses-2026-11-23/' + (i + 1) + '.png', import.meta.url),
).toString('base64'))
const dirs: string[] = []
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'bad-actors-audience-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fake() {
  return {
    visionModel: 'vision', judgeModel: 'referee',
    guess: vi.fn<OwnProvider['guess']>(async () => ({ text: 'make a call', model: 'vision' })),
    judge: vi.fn<OwnProvider['judge']>(async () => ({ verdict: 'incorrect', model: 'referee' })),
  }
}
function fixture(provider = fake()) {
  let at = 1_700_000_000_000
  const claim = vi.fn(() => true)
  const game = createLocalAudience({ provider, claim, now: () => at })
  const round = game.start('', { cue: 2 })
  const cookie = round.cookie!
  const input = (i: number) => ({ roundId: round.body.roundId, observationId: randomUUID(), image: frames[i] })
  return { game, claim, provider, round, cookie, input, tick: () => { at += 4_010 } }
}

describe('local AI observation and independent referee', () => {
  it('sends only pixels to the spectator, then judges its original words and closes a correct round', async () => {
    const f = fixture()
    f.provider.judge.mockResolvedValue({ verdict: 'correct', model: 'referee' })
    const request = f.input(0)
    const result = await f.game.observe(f.cookie, request)
    expect(result.body).toMatchObject({ guess: 'make a call', verdict: 'correct', used: 1, limit: 5, visionModel: 'vision', judgeModel: 'referee' })
    expect(f.provider.guess.mock.calls).toEqual([[frames[0]]])
    expect(f.provider.judge).toHaveBeenCalledWith('Talking on the phone', 'make a call')
    expect(await f.game.observe(f.cookie, request)).toEqual(result)
    expect((await f.game.observe(f.cookie, f.input(1))).body.error).toBe('round_finished')
    expect(f.claim).toHaveBeenCalledTimes(1)
  })

  it('joins concurrent duplicate requests and rejects other in-flight observations and changed bytes under the same ID', async () => {
    const f = fixture()
    let resolve!: (v: { text: string; model: string }) => void
    f.provider.guess.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const request = f.input(0)
    const first = f.game.observe(f.cookie, request)
    const repeat = f.game.observe(f.cookie, request)
    expect((await f.game.observe(f.cookie, { ...request, image: frames[1] })).body.error).toBe('observation_conflict')
    expect((await f.game.observe(f.cookie, f.input(1))).body.error).toBe('in_flight')
    resolve({ text: 'Holding a book', model: 'vision' })
    expect(await first).toEqual(await repeat)
    expect((await f.game.observe(f.cookie, f.input(0))).body.error).toBe('same_pose')
    expect((await f.game.observe(f.cookie, f.input(1))).body.error).toBe('cooldown')
    expect(f.provider.guess).toHaveBeenCalledTimes(1)
    expect(f.claim).toHaveBeenCalledTimes(1)
  })

  it('publishes real vision before scoring and replays both stages of a duplicate without new work', async () => {
    const f = fixture()
    let finish!: (value: { verdict: 'correct'; model: string }) => void
    f.provider.judge.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const request = f.input(0)
    const firstGuess = vi.fn()
    const first = f.game.observe(f.cookie, request, firstGuess)
    await vi.waitFor(() => expect(firstGuess).toHaveBeenCalledTimes(1))
    const guess = firstGuess.mock.calls[0][0]
    expect(guess).toMatchObject({ roundId: request.roundId, observationId: request.observationId, used: 1, limit: 5, guess: 'make a call' })
    expect(guess).not.toHaveProperty('verdict')
    expect(JSON.stringify(guess)).not.toContain('Talking on the phone')
    const repeatedGuess = vi.fn()
    const repeat = f.game.observe(f.cookie, request, repeatedGuess)
    await vi.waitFor(() => expect(repeatedGuess).toHaveBeenCalledExactlyOnceWith(guess))
    finish({ verdict: 'correct', model: 'referee' })
    const final = await first
    expect(final.body.verdict).toBe('correct')
    expect(await repeat).toEqual(final)
    const replayGuess = vi.fn()
    expect(await f.game.observe(f.cookie, request, replayGuess)).toEqual(final)
    expect(replayGuess).toHaveBeenCalledExactlyOnceWith(guess)
    expect(f.provider.guess).toHaveBeenCalledTimes(1)
    expect(f.provider.judge).toHaveBeenCalledTimes(1)
    expect(f.claim).toHaveBeenCalledTimes(1)
  })

  it('streams a guess on a real loopback connection before the referee answers, and recovers a disconnected observer', async () => {
    const project = temp()
    const profile = join(project, '.profile')
    writeFileSync(profile, 'OPENAI_API_KEY=offline-test\nOPENAI_BASE_URL=https://provider.invalid/v1\n')
    const localFetch = globalThis.fetch
    let release!: () => void
    const judgeGate = new Promise<void>(resolve => { release = resolve })
    const providerTransport = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe('https://provider.invalid/v1/chat/completions')
      const vision = JSON.parse(String(init?.body)).messages.length === 1
      if (!vision) await judgeGate
      return Response.json({ choices: [{ message: { content: vision ? 'Calling someone.' : 'CORRECT' } }] })
    })
    vi.stubGlobal('fetch', providerTransport)
    const app = await createServer({
      configFile: false, root: project, logLevel: 'silent',
      plugins: [localAudiencePlugin(project, profile)],
      server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null, hmr: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    }).finally(() => vi.unstubAllGlobals())
    try {
      await app.listen()
      const address = app.httpServer!.address()
      if (!address || typeof address === 'string') throw new Error('Could not open the local rehearsal fixture.')
      const origin = 'http://127.0.0.1:' + address.port
      const post = (path: string, body: unknown, cookie = '', accept = 'application/json') =>
        localFetch(origin + '/api/local-ai/' + path, {
          method: 'POST', headers: { origin, cookie, accept, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
      const start = await post('rounds', { cue: 2 })
      expect(start.status).toBe(200)
      const cookie = start.headers.get('set-cookie')!.split(';')[0]
      const { roundId } = await start.json() as { roundId: string }
      const frame = { roundId, observationId: randomUUID(), image: frames[0] }
      const ndjson = 'application/x-ndjson'
      const first = await post('observe', frame, cookie, ndjson)
      expect(first.headers.get('content-type')).toContain(ndjson)
      const reader = first.body!.getReader()
      const decoder = new TextDecoder()
      let firstLine = ''
      while (!firstLine.includes('\n')) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('The first guess was missing.')
        firstLine += decoder.decode(chunk.value, { stream: true })
      }
      const guess = JSON.parse(firstLine)
      expect(guess).toMatchObject({ type: 'guess', guess: 'Calling someone.', used: 1, roundId, observationId: frame.observationId })
      expect(guess).not.toHaveProperty('verdict')
      expect(providerTransport).toHaveBeenCalledTimes(2)
      await reader.cancel()
      const jsonRetry = post('observe', frame, cookie)
      release()
      const fallback = await jsonRetry
      expect(fallback.headers.get('content-type')).toContain('application/json')
      const final = await fallback.json()
      expect(final).toMatchObject({ guess: guess.guess, verdict: 'correct', used: 1 })
      const replay = await post('observe', frame, cookie, ndjson)
      const events = (await replay.text()).trimEnd().split('\n').map(line => JSON.parse(line))
      expect(events).toEqual([guess, { type: 'result', status: 200, body: final }])
      const stale = await post('observe', frame, '', ndjson)
      expect(JSON.parse(await stale.text())).toMatchObject({ type: 'result', status: 409, body: { error: 'stale_round' } })
      expect(providerTransport).toHaveBeenCalledTimes(2)
    } finally {
      release()
      await app.close()
    }
  })

  it('discards late results after a cue switch and skips the obsolete referee request', async () => {
    const f = fixture()
    let resolve!: (v: { text: string; model: string }) => void
    f.provider.guess.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const staleGuess = vi.fn()
    const first = f.game.observe(f.cookie, f.input(0), staleGuess)
    expect(f.game.start(f.cookie, { cue: 3 }).body.roundId).not.toBe(f.round.body.roundId)
    resolve({ text: 'Sipping', model: 'vision' })
    expect((await first).body.error).toBe('stale_round')
    expect(staleGuess).not.toHaveBeenCalled()
    expect(f.provider.judge).not.toHaveBeenCalled()
  })

  it('keeps an already running referee from awarding its old answer to a new cue', async () => {
    const f = fixture()
    let entered!: () => void
    let finish!: (v: { verdict: 'correct'; model: string }) => void
    const judging = new Promise<void>(resolve => { entered = resolve })
    f.provider.judge.mockImplementationOnce(() => {
      entered()
      return new Promise(resolve => { finish = resolve })
    })
    const old = f.game.observe(f.cookie, f.input(0))
    await judging
    const next = f.game.start(f.cookie, { cue: 3 })
    finish({ verdict: 'correct', model: 'referee' })
    expect((await old).body.error).toBe('stale_round')
    const current = await f.game.observe(f.cookie, { ...f.input(1), roundId: next.body.roundId })
    expect(current.body).toMatchObject({ roundId: next.body.roundId, used: 1, verdict: 'incorrect' })
  })

  it('reserves failed upstream attempts and returns a visible unjudged guess if the referee fails', async () => {
    const f = fixture()
    f.provider.guess.mockRejectedValueOnce(new Error('private upstream diagnostic'))
    const bad = f.input(0)
    const interim = vi.fn()
    expect((await f.game.observe(f.cookie, bad, interim)).body).toMatchObject({ error: 'vision_failed', used: 1 })
    expect(interim).not.toHaveBeenCalled()
    expect((await f.game.observe(f.cookie, bad)).status).toBe(502)
    f.tick()
    f.provider.judge.mockRejectedValueOnce(new Error('private referee diagnostic'))
    const body = (await f.game.observe(f.cookie, f.input(1))).body
    expect(body).toMatchObject({ verdict: 'unjudged', judgeFailure: 'unavailable', guess: 'make a call', used: 2 })
    expect(JSON.stringify(body)).not.toContain('private')
    f.tick()
    f.provider.judge.mockResolvedValueOnce({ verdict: 'uncertain', model: 'referee' })
    expect((await f.game.observe(f.cookie, f.input(2))).body.verdict).toBe('uncertain')
    expect(f.claim).toHaveBeenCalledTimes(3)
  })

  it('allows five total observations even when the last one was wrong', async () => {
    const f = fixture()
    for (let i = 0; i < 5; i++) {
      f.tick()
      expect((await f.game.observe(f.cookie, f.input(i))).body.used).toBe(i + 1)
    }
    expect((await f.game.observe(f.cookie, f.input(5))).body.error).toBe('round_limit')
    expect(f.claim).toHaveBeenCalledTimes(5)
  })

  it('rejects other sessions, oversized images, invalid cues and caller-supplied prompt fields before charging', async () => {
    const f = fixture()
    expect(f.game.start('', {cue: 0}).status).toBe(400)
    expect(f.game.start('', {cue: 2, prompt: 'supplied'}).status).toBe(400)
    expect((await f.game.observe(randomUUID(), f.input(0))).status).toBe(409)
    expect((await f.game.observe(f.cookie, { ...f.input(0), prompt: 'supplied' })).status).toBe(400)
    expect((await f.game.observe(f.cookie, { ...f.input(0), image: 'data:image/png;base64,' + 'A'.repeat(900_000) })).status).toBe(400)
    expect((await f.game.observe(f.cookie, { ...f.input(0), image: 'https://example.com/a.png' })).status).toBe(400)
    expect(f.claim).not.toHaveBeenCalled()
    f.claim.mockReturnValue(false)
    expect((await f.game.observe(f.cookie, f.input(0))).body.error).toBe('daily_limit')
    expect(f.provider.guess).not.toHaveBeenCalled()
    expect(createLocalAudience({ claim: () => true }).status().body.available).toBe(false)
  })

  it('holds session and app reservations across restarts and resets on the next UTC date', () => {
    const path = join(temp(), 'quota.sqlite')
    const day = Date.UTC(2026, 10, 23)
    let quota = openObservationQuota(path)
    try {
      for (let i = 0; i < 12; i++) expect(quota.claim('alice', day)).toBe(true)
      quota.close()
      quota = openObservationQuota(path)
      expect(quota.claim('alice', day)).toBe(false)
      for (let i = 0; i < 12; i++) expect(quota.claim('bob', day)).toBe(true)
      expect(quota.claim('charlie', day)).toBe(false)
      expect(quota.claim('alice', day + 86_400_000)).toBe(true)
    } finally { quota.close() }
  })

  it('limits billing requests to a loopback connection with an exact same origin', () => {
    const host = '127.0.0.1:5173', origin = 'http://' + host
    expect(localRequestAllowed('127.0.0.1', host, origin, 'POST')).toBe(true)
    expect(localRequestAllowed('::1', '[::1]:5173', undefined, 'GET')).toBe(true)
    expect(localRequestAllowed('192.168.0.2', host, origin, 'POST')).toBe(false)
    expect(localRequestAllowed('127.0.0.1', host, 'https://other.example', 'POST')).toBe(false)
    expect(localRequestAllowed('127.0.0.1', 'other.example', 'https://other.example', 'POST')).toBe(false)
    expect(localRequestAllowed('127.0.0.1', host, undefined, 'POST')).toBe(false)
  })

  it('checks the actual provider payloads, keeps the judge textual and disables redirects', async () => {
    const path = join(temp(), '.profile')
    writeFileSync(path, 'OPENAI_API_KEY=offline-test\nOPENAI_BASE_URL=http://38.92.25.168:3000/v1\n')
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'call sombody' } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '**CORRECT**.' } }] }))
    const provider = readOwnProvider(path, send)
    const seen = await provider.guess(frames[0])
    expect((await provider.judge('Talking on the phone', seen.text)).verdict).toBe('correct')
    const vision = JSON.parse(send.mock.calls[0][1]!.body as string)
    const judge = JSON.parse(send.mock.calls[1][1]!.body as string)
    expect(vision.messages).toHaveLength(1)
    expect(vision.messages[0].content.map((x: { type: string }) => x.type)).toEqual(['text', 'image_url'])
    expect(vision.messages[0].content[0].text).not.toMatch(/drinking|selfie|surrender|call|eyes|tray/)
    expect(judge.messages[1]).toEqual({ role: 'user', content: JSON.stringify({ assignedAction: 'Talking on the phone', guess: 'call sombody' }) })
    expect(JSON.stringify(judge)).not.toContain('image_url')
    expect(judge.max_completion_tokens).toBe(1024)
    expect(judge.messages[0].content).toContain('phone held to the ear')
    expect(send.mock.calls[0][1]?.redirect).toBe('error')
    writeFileSync(path, 'OPENAI_API_KEY=offline-test\nOPENAI_BASE_URL=http://other.example/v1\n')
    expect(() => readOwnProvider(path, send)).toThrow()
    writeFileSync(path, 'OPENAI_API_KEY=offline-test\nOPENAI_BASE_URL=https://38.92.25.168:3000/v1\n')
    expect(() => readOwnProvider(path, send)).toThrow()
  })

  it('can switch just the picture reader and reports both requested models on the local status route', async () => {
    vi.stubEnv('BAD_ACTORS_AI_MODEL', undefined)
    vi.stubEnv('BAD_ACTORS_VISION_MODEL', undefined)
    vi.stubEnv('BAD_ACTORS_REFEREE_MODEL', undefined)
    const path = join(temp(), '.profile')
    writeFileSync(path, 'OPENAI_API_KEY=offline-test\nBAD_ACTORS_VISION_MODEL=vision-candidate\n')
    const send = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'Taking a sip.' } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'CORRECT' } }] }))
    const provider = readOwnProvider(path, send)
    expect(createLocalAudience({ provider, claim: () => true }).status().body).toEqual({
      available: true, model: 'vision-candidate', visionModel: 'vision-candidate', judgeModel: 'gpt-6.2-sol',
    })
    const guess = await provider.guess(frames[0])
    const score = await provider.judge('Drinking water', guess.text)
    expect(send.mock.calls.map(([, init]) => JSON.parse(init!.body as string).model))
      .toEqual(['vision-candidate', 'gpt-6.2-sol'])
    expect(guess.model).toBe('vision-candidate')
    expect(score.model).toBe('gpt-6.2-sol')
  })

  it('prioritizes per-role shell settings, then per-role profile settings, then the shared model', () => {
    const path = join(temp(), '.profile')
    writeFileSync(path, 'OPENAI_API_KEY=offline-test\nBAD_ACTORS_AI_MODEL=profile-default\nBAD_ACTORS_REFEREE_MODEL=profile-referee\n')
    vi.stubEnv('BAD_ACTORS_AI_MODEL', undefined)
    vi.stubEnv('BAD_ACTORS_VISION_MODEL', undefined)
    vi.stubEnv('BAD_ACTORS_REFEREE_MODEL', undefined)
    expect(readOwnProvider(path)).toMatchObject({ visionModel: 'profile-default', judgeModel: 'profile-referee' })
    vi.stubEnv('BAD_ACTORS_AI_MODEL', 'shell-default')
    expect(readOwnProvider(path)).toMatchObject({ visionModel: 'shell-default', judgeModel: 'profile-referee' })
    vi.stubEnv('BAD_ACTORS_VISION_MODEL', 'shell-vision')
    vi.stubEnv('BAD_ACTORS_REFEREE_MODEL', 'shell-referee')
    expect(readOwnProvider(path)).toMatchObject({ visionModel: 'shell-vision', judgeModel: 'shell-referee' })
  })

  it('reports safe categories for truncated, unavailable and non-atomic referee verdicts without reissuing a request', async () => {
    const path = join(temp(), '.profile')
    writeFileSync(path, 'OPENAI_API_KEY=offline-test\nOPENAI_BASE_URL=https://audience.example/\n')
    const send = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: 'length', message: { content: '' } }], usage: { total_tokens: 412 } }))
      .mockResolvedValueOnce(new Response('private upstream data', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'CORRECT or INCORRECT' } }] }))
    const provider = readOwnProvider(path, send)
    const score = () => provider.judge('Talking on the phone', 'Holding a phone to their ear.').catch(refereeFailure)
    expect(await score()).toMatchObject({ judgeFailure: 'output_limit', judgeTokens: 412 })
    expect(await score()).toEqual({ judgeFailure: 'http_server', judgeModel: undefined, judgeTokens: undefined })
    expect(await score()).toMatchObject({ judgeFailure: 'invalid_verdict' })
    expect(send.mock.calls).toHaveLength(3)
    expect(String(send.mock.calls[0][0])).toBe('https://audience.example/chat/completions')
  })

  it('refuses private profiles served as public assets including paths resolving into the public directory', () => {
    const dir = temp(), publicDir = join(dir, 'public')
    mkdirSync(publicDir)
    const file = join(publicDir, 'config.txt'), alias = join(dir, 'alias')
    writeFileSync(file, 'fixture')
    symlinkSync(file, alias)
    expect(() => privateProfilePaths(file, publicDir)).toThrow()
    expect(() => privateProfilePaths(alias, publicDir)).toThrow()
    expect(privateProfilePaths(undefined, publicDir)).toEqual([])
    expect(privateProfilePaths(join(dir, '.profile'), publicDir)).toEqual([join(dir, '.profile')])
  })
})
