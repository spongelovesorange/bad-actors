import { AudienceError } from './audience-issue'
import type { Guess, PendingGuess } from './audience-round'

type ErrorBody = { message?: string; error?: string; used?: number; visionFailure?: string }

export function failedReply(status: number, body: ErrorBody | null) {
  return new AudienceError(body?.message || 'The AI audience could not complete the request.', status,
    body?.error, body?.used, body?.visionFailure)
}

/** The server sends at most one short guess and one verdict. UTF-8 and newlines can straddle chunks. */
export async function readAudienceStream(response: Response, onGuess: (guess: PendingGuess) => void): Promise<Guess> {
  if (!response.body) throw new Error('Missing observation stream.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = ''
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      bytes += value?.byteLength ?? 0
      if (bytes > 16_384) throw new Error('Observation stream exceeded its size limit.')
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = done ? '' : lines.pop()!
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event?.type === 'guess') {
          onGuess(event)
        } else if (event?.type === 'result' && Number.isInteger(event.status) && event.status >= 200 && event.status <= 599 && event.body) {
          if (event.status >= 300) throw failedReply(event.status, event.body)
          return event.body as Guess
        } else {
          throw new Error('Unexpected observation event.')
        }
      }
      if (done) throw new Error('The stream ended before the score arrived.')
    }
  } finally {
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
