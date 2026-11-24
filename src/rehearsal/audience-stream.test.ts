import { afterEach, expect, it, vi } from 'vitest'
import { readAudienceStream } from './audience-stream'
import { localAudience } from './audience-round'

const words = { roundId: 'r', observationId: 'o', guess: 'Taking a café selfie.', used: 1, limit: 5 }
const final = { ...words, verdict: 'correct' }
const text = new TextEncoder()
function stream(...chunks: Uint8Array[]) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close() },
  }), { headers: { 'Content-Type': 'application/x-ndjson' } })
}
const line = (value: unknown) => JSON.stringify(value) + '\n'
afterEach(() => vi.unstubAllGlobals())

it('handles newlines, multibyte characters and a result without a trailing newline', async () => {
  const content = text.encode(line({ type: 'guess', ...words }) + '\r\n' + JSON.stringify({ type: 'result', status: 200, body: final }))
  const observed = vi.fn()
  expect(await readAudienceStream(stream(...Array.from(content, b => Uint8Array.of(b))), observed)).toEqual(final)
  expect(observed.mock.calls).toEqual([[{ type: 'guess', ...words }]])
})

it('rejects truncated, malformed or oversized streams without inventing a verdict', async () => {
  const observed = vi.fn()
  await expect(readAudienceStream(stream(text.encode(line({ type: 'guess', ...words }))), observed)).rejects.toThrow(/before the score/)
  expect(observed).toHaveBeenCalledOnce()
  await expect(readAudienceStream(stream(text.encode('{broken}')), vi.fn())).rejects.toThrow()
  await expect(readAudienceStream(stream(new Uint8Array(16385)), vi.fn())).rejects.toThrow(/size limit/)
})

it('preserves structured failures inside a stream before any guess', async () => {
  const observed = vi.fn()
  const event = { type: 'result', status: 502, body: { error: 'vision_failed', used: 1, visionFailure: 'timeout' } }
  await expect(readAudienceStream(stream(text.encode(line(event))), observed))
    .rejects.toMatchObject({ code: 'vision_failed', used: 1, status: 502, visionFailure: 'timeout' })
  expect(observed).not.toHaveBeenCalled()
})

it('requests streamed observations and accepts older local JSON responses', async () => {
  const fetch = vi.fn(async () => Response.json(final))
  vi.stubGlobal('fetch', fetch)
  const observed = vi.fn()
  const frame = { roundId: 'r', observationId: 'o', image: 'data:image/png;base64,...' }
  expect(await localAudience.observe(frame, new AbortController().signal, observed)).toEqual(final)
  expect(fetch).toHaveBeenCalledWith('/api/local-ai/observe', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ Accept: expect.stringContaining('application/x-ndjson') }),
  }))
  expect(observed).not.toHaveBeenCalled()
})
