export type Jaw = 'closed' | 'half' | 'open'
type SpeechBeat = { glyph: string; jaw: Jaw; duration: number; index: number }

const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined

/** One beat drives both the next printed character and the hinge on the ticket punch. */
export function scoreLine(line: string) {
  const words: SpeechBeat[][] = []
  const beats: SpeechBeat[] = []
  const base = Math.min(32, Math.max(12, 1800 / Math.max(1, line.length)))
  const pattern: Jaw[] = ['half', 'open', 'open', 'half', 'closed']
  for (const token of line.match(/\s+|\S+/gu) ?? []) {
    const glyphs = segmenter ? Array.from(segmenter.segment(token), part => part.segment) : Array.from(token)
    const word = glyphs.map((glyph, offset) => {
      const voiced = /[\p{L}\p{N}]/u.test(glyph)
      const hold = /[.!?…。！？]/u.test(glyph) ? 105 : /[,;:—，]/u.test(glyph) ? 72 : base
      const beat: SpeechBeat = { glyph, jaw: voiced ? pattern[offset % pattern.length] : 'closed', duration: hold, index: beats.length }
      beats.push(beat)
      return beat
    })
    words.push(word)
  }
  return { words, beats }
}
