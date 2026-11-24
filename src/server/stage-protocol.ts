import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'

export const cues = ['Drinking water', 'Talking on the phone', 'Taking a selfie', 'Covering your eyes', 'Surrendering', 'Carrying a tray']
export const limit = 5
export const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const pngPrefix = 'data:image/png;base64,'
export const maxBodyBytes = 820_000
export type StageReply = { status: number; body: Record<string, unknown> }
export type VisionGuess = {
  roundId: string; observationId: string; used: number; limit: number
  /** `guess` is what the referee scores; `line` is Mr. Stubbs's delivery of it. */
  guess: string; line?: string; visionModel: string; visionTokens?: number
}
export const failure = (status: number, error: string, message: string, used?: number): StageReply => ({
  status, body: { error, message, ...(used === undefined ? {} : { used, limit }) },
})

export function imageHash(image: unknown): string | undefined {
  if (typeof image !== 'string' || !image.startsWith(pngPrefix) || image.length > maxBodyBytes - 128) return
  const encoded = image.slice(pngPrefix.length)
  if (!encoded.length || encoded.length % 4 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) return
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length < 45 || bytes.length > 600_000 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex')) ||
      bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii',12,16) !== 'IHDR' ||
      !bytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex'))) return
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20)
  if (w < 64 || h < 64 || w > 1024 || h > 1024) return
  return createHash('sha256').update(bytes).digest('hex')
}
