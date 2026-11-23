import { describe, expect, it } from 'vitest'
import { checkOpeningGuess } from './opening-guess'

describe('fixed offline phone-call warm-up', () => {
  it.each(['make a call', 'call sombody', 'Call somebody!', 'She’s talking on the phone.', 'phone'])(
    'recognizes %s', (guess) => expect(checkOpeningGuess(guess)).toBe(true),
  )
  it.each(['taking a selfie', 'not making a call'])(
    'rejects %s', (guess) => expect(checkOpeningGuess(guess)).toBe(false),
  )
  it('keeps an empty guess on the page', () => expect(checkOpeningGuess('  ')).toBeNull())
})
