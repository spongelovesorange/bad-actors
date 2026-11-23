const phoneGuesses = new Set([
  'phone',
  'calling',
  'calling someone',
  'make a call',
  'make a phone call',
  'call someone',
  'call somebody',
  'calling somebody',
  'phone call',
  'a phone call',
  'making a phone call',
  'taking a call',
  'answering the phone',
  'talking on a phone',
  'talking on the phone',
  'on the phone',
  'using a phone',
  'making a call',
  'talking on his phone',
  'talking on her phone',
  'talking on their phone',
])

// The fixed opening pose can still be played in the offline rehearsal.
export function checkOpeningGuess(input: string): boolean | null {
  const answer = input.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(he is|she is|they are|hes|shes|theyre|the actor is) /, '')
    .replace(/\bsombody\b/g, 'somebody')
  return answer.length ? phoneGuesses.has(answer) : null
}
