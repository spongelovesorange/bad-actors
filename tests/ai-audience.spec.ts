import { expect, test, type Page, type Route } from '@playwright/test'

type Verdict = 'correct' | 'incorrect' | 'uncertain' | 'unjudged'
type Observation = { roundId: string; observationId: string; image: string }
type Guess = { guess: string; verdict: Verdict; used?: number; judgeFailure?: string }
type Outcome = Guess | { status: number; error: string; message: string; used?: number; visionFailure?: string }

// Intercept every local AI path before the browser navigates, including failed cases.
// No test in this file can spend a real observation.
async function mockAudience(page: Page, observe: (request: Observation, used: number) => Outcome | Promise<Outcome>, available: boolean | (() => boolean) = true) {
  const starts: number[] = []
  const frames: Observation[] = []
  const counts = new Map<string, number>()
  await page.route('**/api/local-ai/**', async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/local-ai/status') {
      return route.fulfill({ json: { available: typeof available === 'function' ? available() : available, model: 'mock-for-tests' } })
    }
    if (pathname === '/api/local-ai/rounds') {
      const { cue } = route.request().postDataJSON() as { cue: number }
      starts.push(cue)
      const roundId = 'mock-round-' + starts.length
      counts.set(roundId, 0)
      return route.fulfill({ json: { roundId, limit: 5 } })
    }
    if (pathname !== '/api/local-ai/observe') throw Error('Unexpected AI path ' + pathname)
    const request = route.request().postDataJSON() as Observation
    frames.push(request)
    const used = (counts.get(request.roundId) ?? 0) + 1
    counts.set(request.roundId, used)
    const outcome = await observe(request, used)
    const body = { roundId: request.roundId, observationId: request.observationId, used, limit: 5, ...outcome }
    return route.fulfill({ status: 'status' in outcome ? outcome.status : 200, json: body })
  })
  return { starts, frames }
}

const panel = (page: Page) => page.getByTestId('ai-audience')
const guessButton = (page: Page) => page.getByRole('button', { name: /Ready! Guess, Stubbs/ })
const changePose = (page: Page) => page.getByRole('group', { name: 'Puppet stage' }).getByRole('button', { name: 'Left hand', exact: true }).press('Shift+ArrowRight')

// Free play: pick the current cue, then send the pose. Stubbs never looks on his own.
async function startRound(page: Page) {
  await page.getByRole('button', { name: /^Free play/ }).click()
  await page.getByRole('dialog', { name: 'Pick a cue' }).getByRole('button', { pressed: true }).click()
  await guessButton(page).click()
}
async function lookAgain(page: Page) {
  await changePose(page)
  await guessButton(page).click()
}

test('a wrong observation can recover with a differently worded right answer', async ({ page }) => {
  const { frames, starts } = await mockAudience(page, (_, used) =>
    used === 1 ? { guess: 'Checking the weather.', verdict: 'incorrect' }
      : { guess: 'Calling somebody.', verdict: 'correct' })
  await page.goto('/?cue=2')
  await changePose(page)
  await expect(page.locator('svg[data-puppet-stage]')).toHaveAttribute('data-settled', '1')
  const hand = page.getByRole('button', { name: 'Left hand', exact: true })
  const x = await hand.getAttribute('cx')
  expect(frames).toHaveLength(0)
  await startRound(page)
  await expect(panel(page)).toHaveAttribute('data-verdict', 'incorrect')
  await expect(hand).toHaveAttribute('cx', x!)
  await expect(panel(page).locator('.ba-audience-balloon')).toContainText('Checking the weather.')
  await expect(panel(page).getByTestId('referee-slip')).toHaveText('Miss!')
  await expect(panel(page).getByTestId('stage-verdict-effects')).toHaveAttribute('data-verdict', 'incorrect')
  await lookAgain(page)
  await expect(panel(page)).toHaveAttribute('data-verdict', 'correct', { timeout: 9000 })
  await expect(panel(page).locator('.ba-audience-balloon')).toContainText('Calling somebody.')
  await expect(panel(page)).toHaveAttribute('data-phase', 'complete')
  await expect(panel(page).getByTestId('referee-slip')).toHaveText('Guessed it!')
  await expect(panel(page).getByTestId('stage-verdict-effects')).toHaveAttribute('data-verdict', 'correct')
  await panel(page).locator('summary').click()
  await expect(panel(page).locator('.ba-audience-log li')).toHaveCount(2)
  expect(starts).toEqual([2])
  expect(frames).toHaveLength(2)
  for (const frame of frames) {
    expect(Object.keys(frame).sort()).toEqual(['image', 'observationId', 'roundId'])
    expect(frame.image).toMatch(/^data:image\/png;base64,iVBOR/)
  }
  expect(frames[1].image).not.toBe(frames[0].image)
  expect(frames[1].observationId).not.toBe(frames[0].observationId)
})

test('an old round cannot score the next cue', async ({ page }) => {
  let release!: () => void
  let delivery!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const oldReplyIssued = new Promise<void>(resolve => { delivery = resolve })
  const { frames } = await mockAudience(page, async () => {
    await pending
    delivery()
    return { guess: 'Old guess from a retired round.', verdict: 'correct' }
  })
  await page.goto('/?cue=2')
  await startRound(page)
  await expect.poll(() => frames.length).toBe(1)
  await panel(page).getByRole('button', { name: 'Change cue' }).click()
  await page.getByRole('dialog', { name: 'Pick a cue' }).getByRole('button', { name: 'Taking a selfie' }).click()
  await expect(page.getByRole('heading', { name: 'Taking a selfie' })).toBeVisible()
  release()
  await oldReplyIssued
  await expect(panel(page)).toHaveAttribute('data-phase', 'ready')
  await expect(panel(page)).not.toHaveAttribute('data-verdict', 'correct')
  await expect(panel(page)).not.toContainText('Old guess from a retired round.')
  await expect(panel(page).getByTestId('stage-verdict-effects')).toHaveCount(0)
})

test('five incorrect looks end the round even if the performer keeps moving', async ({ page }) => {
  test.setTimeout(55000)
  const { frames } = await mockAudience(page, (_, used) => ({ guess: 'Wrong guess ' + used, verdict: 'incorrect' }))
  await page.goto('/?cue=2')
  await startRound(page)
  for (let used = 1; used <= 5; used++) {
    await expect(panel(page).locator('.ba-audience-balloon')).toContainText('Wrong guess ' + used, { timeout: 10000 })
    if (used < 5) await lookAgain(page)
  }
  await expect(panel(page)).toHaveAttribute('data-phase', 'complete')
  await changePose(page)
  // Moving after the five-look cap sends nothing.
  await page.waitForTimeout(4400)
  expect(frames).toHaveLength(5)
})

test('an unavailable provider leaves the practice stage usable', async ({ page }) => {
  let connected = false
  const { starts, frames } = await mockAudience(page, () => { throw Error('Unexpected model call') }, () => connected)
  await page.goto('/?cue=3')
  await expect(page.getByRole('heading', { name: 'Taking a selfie' })).toBeVisible()
  await expect(panel(page)).toHaveAttribute('data-service', 'offline')
  await expect(panel(page)).toContainText('Booth closed')
  await expect(page.getByRole('button', { name: /^Timed show/ })).toHaveCount(0)
  const stage = page.getByRole('group', { name: 'Puppet stage' })
  const palm = stage.getByRole('button', { name: 'Left hand', exact: true })
  const before = await palm.getAttribute('cx')
  await changePose(page)
  await expect(palm).not.toHaveAttribute('cx', before!)
  await expect(panel(page).locator('.ba-audience-balloon')).not.toContainText('Calling somebody.')
  const posed = await palm.getAttribute('cx')
  connected = true
  await panel(page).getByRole('button', { name: 'Recheck connection' }).click()
  await expect(panel(page).getByRole('button', { name: /^Timed show/ })).toBeEnabled()
  await expect(palm).toHaveAttribute('cx', posed!)
  expect(starts).toEqual([])
  expect(frames).toEqual([])
})

test('a referee outage keeps the real guess visible without declaring a win', async ({ page }) => {
  await mockAudience(page, () => ({ guess: 'Dialling a friend.', verdict: 'unjudged', judgeFailure: 'http_limit' }))
  await page.goto('/?cue=2')
  await startRound(page)
  await expect(panel(page)).toHaveAttribute('data-verdict', 'unjudged')
  await expect(panel(page)).toContainText('Dialling a friend.')
  await expect(panel(page)).toContainText(/score unavailable/i)
  await expect(panel(page)).toContainText('The referee reached its provider limit.')
  await expect(panel(page).getByTestId('stage-verdict-effects')).toHaveCount(0)
})

for (const [answer, verdict] of [['phone call', 'correct'], ['baking bread', 'incorrect']]) {
  test(`the free opening guess cues the ${verdict} audience reaction once`, async ({ page }) => {
    const { frames, starts } = await mockAudience(page, () => { throw Error('Unexpected model call') }, false)
    await page.setViewportSize({ width: 390, height: 720 })
    await page.goto('/')
    const effects = page.getByTestId('stage-verdict-effects')
    const sound = page.getByRole('button', { name: 'Stage sound' })
    await expect(sound).toHaveAttribute('aria-pressed', 'false')
    await expect(effects).toHaveCount(0)
    await page.getByRole('textbox', { name: /Guess the opening pose/ }).fill(answer)
    await page.getByRole('button', { name: 'Submit guess' }).click()
    await expect(effects).toHaveAttribute('data-verdict', verdict)
    await expect(effects).toBeInViewport({ ratio: .9 })
    await expect(page.getByTestId('referee-slip')).toHaveText(verdict === 'correct' ? 'Guessed it!' : 'Miss!')
    await changePose(page)
    await expect(effects).toHaveCount(0)
    expect(starts).toEqual([])
    expect(frames).toEqual([])
  })
}

test('a counted vision failure asks for a changed pose before the next look', async ({ page }) => {
  const { starts, frames } = await mockAudience(page, (_, used) => used === 1
    ? { status: 502, error: 'vision_failed', message: 'The image model did not return a guess.', visionFailure: 'timeout' }
    : { guess: 'Calling a friend.', verdict: 'correct' })
  await page.goto('/?cue=2')
  await startRound(page)
  await expect(panel(page)).toContainText('This look was counted.')
  await expect(panel(page).locator('.ba-audience-balloon')).toContainText('The image model took too long to reply.')
  await expect(panel(page).getByRole('button', { name: 'Change your pose' })).toBeDisabled()
  await expect(panel(page)).toHaveAttribute('data-phase', 'ready')
  await lookAgain(page)
  await expect(panel(page)).toHaveAttribute('data-verdict', 'correct', { timeout: 9000 })
  expect(frames).toHaveLength(2)
  expect(frames[0].image).not.toBe(frames[1].image)
  expect(starts).toEqual([2])
})

test('an in-flight retry reuses the original frame and observation ID', async ({ page }) => {
  const { frames } = await mockAudience(page, (_, attempt) => attempt === 1
    ? { status: 409, error: 'in_flight', message: 'The audience is still looking at a pose.' }
    : { guess: 'Dialling a friend.', verdict: 'correct', used: 1 })
  await page.goto('/?cue=2')
  await startRound(page)
  await panel(page).getByRole('button', { name: 'Try again' }).click()
  await expect(panel(page)).toHaveAttribute('data-verdict', 'correct', { timeout: 9000 })
  expect(frames).toHaveLength(2)
  expect(frames[0]).toEqual(frames[1])
})

test('a daily limit disables further AI looks while practice remains editable', async ({ page }) => {
  const { frames } = await mockAudience(page, () => ({
    status: 429, error: 'daily_limit', message: 'The daily AI rehearsal allowance has been used.', used: 0,
  }))
  await page.goto('/?cue=2')
  await startRound(page)
  await expect(panel(page).getByRole('button', { name: 'Daily looks used' })).toBeDisabled()
  await changePose(page)
  await page.waitForTimeout(4400)
  expect(frames).toHaveLength(1)
})

test('a timed show pauses for the audience, cuts off new looks at zero, and deals a different cue', async ({ page }) => {
  await page.clock.install()
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const { frames, starts } = await mockAudience(page, async () => {
    await pending
    return { guess: 'Checking the weather.', verdict: 'incorrect' }
  })
  await page.goto('/?cue=2')
  await page.getByRole('button', { name: /^Timed show/ }).click()
  await page.getByRole('dialog', { name: 'Tonight’s show' }).getByRole('button', { name: /^Level 1/ }).click()
  const clock = page.getByTestId('stage-clock')
  await expect(clock).toHaveAttribute('data-mode', 'running')
  await expect(clock).toHaveAttribute('data-seconds', '45')
  expect(starts).toHaveLength(1)
  expect(starts[0]).toBeGreaterThanOrEqual(1)
  expect(starts[0]).toBeLessThanOrEqual(6)
  await expect(panel(page)).toContainText('Act 1 of 5')
  await page.clock.fastForward(36_000)
  await expect(clock).toHaveAttribute('data-urgent', 'true')
  await guessButton(page).click()
  await expect(clock).toHaveAttribute('data-mode', 'paused')
  const secondsAtPause = await clock.getAttribute('data-seconds')
  await page.clock.fastForward(25_000)
  await expect(clock).toHaveAttribute('data-seconds', secondsAtPause!)
  release()
  await expect(clock).toHaveAttribute('data-mode', 'running')
  await expect(panel(page)).toHaveAttribute('data-verdict', 'incorrect')
  await page.clock.fastForward(12_000)
  await expect(clock).toHaveAttribute('data-mode', 'expired')
  await expect(clock).toHaveAttribute('data-seconds', '0')
  await expect(panel(page)).toHaveAttribute('data-end', 'timeout')
  await changePose(page)
  expect(frames).toHaveLength(1)
  // The act ends on the bell and the next one is dealt from the same level.
  await page.clock.fastForward(5000)
  await expect(panel(page)).toContainText('Act 2 of 5')
  await expect(clock).toHaveAttribute('data-mode', 'running')
  await expect(clock).toHaveAttribute('data-seconds', '45')
  expect(starts).toHaveLength(2)
  expect(starts[1]).not.toBe(starts[0])
  expect(starts[1]).toBeLessThanOrEqual(6)
})

test.describe('opening the how-to-play demo', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('every visit opens on the silent demo, and the glove then points the way to a first look', async ({ page }) => {
    const { starts, frames } = await mockAudience(page, () => ({ guess: 'Drinking.', verdict: 'correct' }))
    await page.goto('/?cue=1')
    const book = page.getByRole('dialog', { name: 'How to play' })
    await expect(book).toBeVisible()
    await expect(book.locator('.ba-howto-steps li')).toHaveCount(3)
    // One loop of the demo: the glove poses the real puppet, presses Ready, and Stubbs answers.
    await expect(book.locator('.ba-howto-steps li[aria-current]')).toHaveText(/Press Ready/, { timeout: 9000 })
    await expect(book.getByText('On the phone!')).toBeVisible({ timeout: 9000 })
    await book.getByRole('button', { name: 'Pause the demo' }).click()
    await expect(book.getByRole('button', { name: 'Play the demo' })).toBeVisible()
    await book.getByRole('button', { name: 'Play quietly' }).click()
    await expect(book).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stage sound' })).toHaveAttribute('aria-pressed','false')

    // Then the same glove taps the way in, the actor's hand, and the Ready button, once each.
    const free = page.getByRole('button', { name: /^Free play/ })
    await expect(free).toHaveAttribute('data-beckon', 'true')
    await free.click()
    await page.getByRole('dialog', { name: 'Pick a cue' }).getByRole('button', { pressed: true }).click()
    await expect(page.locator('.ba-stage-coach')).toBeVisible()
    await expect(guessButton(page)).not.toHaveAttribute('data-beckon')
    await changePose(page)
    await expect(page.locator('.ba-stage-coach')).toHaveCount(0)
    await expect(guessButton(page)).toHaveAttribute('data-beckon', 'true')
    await guessButton(page).click()
    await expect(panel(page)).toHaveAttribute('data-verdict', 'correct', { timeout: 9000 })
    await expect(page.locator('.ba-beckon-hand')).toHaveCount(0)
    expect(starts).toEqual([1])
    expect(frames).toHaveLength(1)

    await page.reload()
    await expect(book).toBeVisible()
    await book.getByRole('button', { name: 'Play quietly' }).click()
    await expect(book).toHaveCount(0)
    await page.getByRole('button', {name:'How to play'}).click()
    await expect(book).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(book).toHaveCount(0)
  })

  test('with reduced motion the demo is one finished scene with nothing to pause', async ({ page }) => {
    await mockAudience(page, () => ({ guess: 'Drinking.', verdict: 'correct' }))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?cue=1')
    const still = page.getByRole('dialog', { name: 'How to play' })
    await expect(still.getByText('DING!')).toBeVisible()
    await expect(still.getByText('On the phone!')).toBeVisible()
    await expect(still.getByRole('button', { name: /the demo/ })).toHaveCount(0)
    await expect(still.locator('.ba-howto-hand')).toHaveCount(0)
    await expect(still.locator('[aria-current]')).toHaveCount(0)
  })
})

test('the hint replaces the drag tip during free play, with the pose sheet for a classic cue', async ({ page }) => {
  await mockAudience(page, () => ({ guess: 'Taking a selfie.', verdict: 'correct' }))
  await page.goto('/?cue=3')
  await page.getByRole('button', { name: /^Free play/ }).click()
  await page.getByRole('dialog', { name: 'Pick a cue' }).getByRole('button', { name: 'Taking a selfie' }).click()
  await panel(page).getByRole('button', { name: 'Hint' }).click()
  const hint = page.locator('.ba-stage-hint')
  await expect(hint).toContainText('peace sign')
  await expect(hint.locator('img')).toHaveAttribute('src', '/blocking/selfie.png')
  await panel(page).getByRole('button', { name: 'Hint' }).click()
  await expect(hint).toHaveCount(0)
})
