import { describe, expect, it } from 'vitest'
import { scoreLine } from './critic-speech'

describe('Stubbs’s comic delivery', () => {
  it('keeps the exact guess and its word breaks while publishing one beat per grapheme', () => {
    const line = 'A café… 👨‍👦  呼！'
    const { words, beats } = scoreLine(line)
    expect(words.map(word => word.map(beat => beat.glyph).join(''))).toEqual(['A', ' ', 'café…', ' ', '👨‍👦', '  ', '呼！'])
    expect(beats.map(beat => beat.glyph).join('')).toBe(line)
    expect(beats.map(beat => beat.index)).toEqual(beats.map((_, i) => i))
  })

  it('opens the punch over successive letters and shuts it on a pause', () => {
    const { beats } = scoreLine('Checking, twice.')
    expect(beats.slice(0, 5).map(beat => beat.jaw)).toEqual(['half', 'open', 'open', 'half', 'closed'])
    const comma = beats.find(beat => beat.glyph === ',')!
    expect(comma.jaw).toBe('closed')
    expect(comma.duration).toBeGreaterThan(beats[0].duration)
    expect(beats.at(-1)?.jaw).toBe('closed')
  })

  it('keeps a long ordinary guess readable within one pause between looks', () => {
    const line = 'Carefully holding a telephone against one ear while trying to hear someone.'
    const duration = scoreLine(line).beats.reduce((sum, beat) => sum + beat.duration, 0)
    expect(duration).toBeGreaterThan(500)
    expect(duration).toBeLessThan(2300)
  })
})
