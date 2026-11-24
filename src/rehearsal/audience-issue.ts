export class AudienceError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly used?: number, readonly visionFailure?: string) {
    super(message)
  }
}

export function modelIssue(role: 'image model' | 'referee', reason?: string) {
  const name = role === 'referee' ? 'The referee' : 'The image model'
  switch (reason) {
    case 'timeout': return name + ' took too long to reply.'
    case 'connection': return name + ' could not be reached.'
    case 'http_auth': return name + ' rejected the API credentials.'
    case 'http_limit': return name + ' reached its provider limit.'
    case 'http_server': return name + ' reported a service error.'
    case 'refused': return name + ' declined this request.'
    default: return role === 'referee' ? 'The referee did not return a score.' : 'The image model did not return a guess.'
  }
}

export function audienceIssue(error: unknown, step: 'start' | 'capture' | 'observe', remaining: number, hosted = false) {
  const known = error instanceof AudienceError ? error : undefined
  if (step === 'capture') {
    return { issue: 'I couldn’t take a picture of the stage.', message: 'Try again to capture this pose. No look was used.' }
  }
  if (hosted && known?.status === 401)
    return { issue: 'Your sign-in has expired.', message: 'Refresh this page and sign in to play again.' }
  if (hosted && known?.code === 'unavailable')
    return { issue: 'The AI audience is unavailable.', message: 'Try again later or keep practicing on the public stage.' }
  if (hosted && (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError'))) {
    return { issue: 'The stage connection was interrupted.', message: step === 'start' ? 'Try again to open the cue. No look was used.' : 'Try again to check the same picture.' }
  }
  switch (known?.code) {
    case 'vision_failed':
      return { issue: modelIssue('image model', known.visionFailure), message: remaining > 0
        ? 'This look was counted. Change the pose for another look.' : 'This look was counted.' }
    case 'stale_round':
      return { issue: 'This round has ended.', message: 'Restart this cue to keep the pose you just made.' }
    case 'player_daily_limit':
      return { issue: 'You’ve used your 60 AI looks today.', message: 'Your next 60 arrive at 00:00 UTC.' }
    case 'house_daily_limit':
      return { issue: 'The house has used today’s 240 shared looks.', message: 'The audience is back at 00:00 UTC. You can still play with a friend.' }
    case 'daily_limit':
      return { issue: 'We’ve used today’s AI looks.', message: 'Looks reset at 00:00 UTC. You can keep posing for a friend.' }
    case 'round_finished':
      return { issue: 'This cue has already been guessed.', message: 'Draw the next cue to play again.' }
    case 'round_limit':
      return { issue: 'I’ve used all five looks.', message: 'Draw the next cue to play again.' }
    case 'same_pose':
      return { issue: 'I’ve seen this pose already.', message: 'Move a joint or a prop for another look. No extra look was used.' }
    case 'in_flight':
      return { issue: 'I’m still waiting for a guess.', message: 'Try again to check the same picture.' }
    case 'unavailable':
      return { issue: 'The local AI game is unavailable.', message: 'Check that npm run practice:ai is running, then try again.' }
  }
  if (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError')) {
    return { issue: error instanceof TypeError ? 'I can’t reach the local game.' : 'The local game took too long to reply.',
      message: step === 'start' ? 'Check that the local game is running, then try again to start. No look was used.'
        : 'Check that the local game is running. Try again to check the same picture.' }
  }
  return { issue: known?.message || (step === 'start' ? 'I couldn’t start this round.' : 'I couldn’t read the game’s reply.'),
    message: step === 'start' ? 'Try again to open the cue. No look was used.' : remaining > 0 ? 'Try again when you’re ready.' : undefined }
}
