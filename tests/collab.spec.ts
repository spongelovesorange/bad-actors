/**
 * Two signed-in players, two browser contexts, one worker.
 *
 * `users(2)` takes any two accounts from this machine's pool, so the spec runs
 * on a fresh app once two test accounts exist:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Nothing here asks Stubbs to look, so no spec in this file can spend a model call.
 */
import { test, expect, loadAllTestAccounts, type MultiplayerUser } from 'deepspace/testing'

// A fresh checkout has no pool, and there `users()` throws. Skip the file and say what creates the pool.
const usableTestAccounts = loadAllTestAccounts().length
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    '--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.',
)

/** Opens the signed-in stage the way a returning player sees it: past the how-to-play demo. */
async function openStage(user: MultiplayerUser) {
  await user.context.addInitScript(() => { try { localStorage.setItem('bad-actors:handbook:skip', '1') } catch { /* Shown instead. */ } })
  await user.page.goto('/room')
  await expect(user.page.getByTestId('nav-user-name')).toHaveText(/\S/, { timeout: 15_000 })
}

test('each player gets their own stage and their own seat in the AI booth', async ({ users }) => {
  const [a, b] = await users(2)
  await Promise.all([openStage(a), openStage(b)])
  const rounds: unknown[] = []
  for (const user of [a, b]) {
    // The booth knows who is asking: a signed-in player finds it open.
    await expect(user.page.getByTestId('ai-audience')).toHaveAttribute('data-service', 'live', { timeout: 15_000 })
    // Starting a round costs nothing. Each player's round is their own.
    const started = user.page.waitForResponse(reply => reply.url().endsWith('/api/stage-ai/rounds'))
    await user.page.getByRole('button', { name: /^Free play/ }).click()
    await user.page.getByRole('dialog', { name: 'Pick a cue' }).getByRole('button', { pressed: true }).click()
    const reply = await started
    expect(reply.status()).toBe(200)
    rounds.push((await reply.json() as { roundId?: unknown }).roundId)
  }
  expect(rounds[0]).toEqual(expect.any(String))
  expect(rounds[1]).toEqual(expect.any(String))
  expect(rounds[0]).not.toBe(rounds[1])
})

test('two players race the same cue: a room code, a live roster, and one deal for both stages', async ({ users }) => {
  const [host, friend] = await users(2)
  await openStage(host)
  await expect(host.page.getByTestId('ai-audience')).toHaveAttribute('data-service', 'live', { timeout: 15_000 })
  await host.page.getByRole('button', { name: /^Race a friend/ }).click()
  await host.page.waitForURL(/\/race\?code=[A-Z]{4}/)
  const hostBoard = host.page.getByTestId('race-board')
  const code = (await hostBoard.getByTestId('race-code').textContent())!.trim()
  expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
  await expect(hostBoard.getByRole('button', { name: 'Start the race' })).toBeDisabled()

  // The friend types the code on their own stage, as a Jackbox player types a room code, and takes a seat.
  // A word is refused on the spot; the real code is read however it is typed. Both rosters fill in live.
  await openStage(friend)
  const join = friend.page.getByTestId('race-join')
  const box = join.getByRole('textbox', { name: 'Got a race code from a friend?' })
  await box.fill('kate')
  await join.getByRole('button', { name: 'Join' }).click()
  await expect(join.getByRole('alert')).toHaveText('A race code is four consonants, like KXTP.')
  await expect(friend.page).toHaveURL(/\/room$/)
  const seated = friend.page.waitForRequest(request => request.url().endsWith('/api/actions/raceJoin'))
  await box.fill(` ${code.slice(0, 2)} ${code.slice(2)} `.toLowerCase())
  await join.getByRole('button', { name: 'Join' }).click()
  await friend.page.waitForURL(new RegExp(`/race\\?code=${code}&from=room$`))
  const session = (await seated).headers().authorization
  const friendBoard = friend.page.getByTestId('race-board')
  for (const board of [hostBoard, friendBoard]) {
    await expect(board.getByRole('list', { name: 'Players' }).getByRole('listitem')).toHaveCount(2, { timeout: 15_000 })
    await expect(board.getByTestId('race-code')).toHaveText(code)
  }
  await expect(friendBoard.getByRole('button', { name: 'Start the race' })).toHaveCount(0)
  await expect(friendBoard).toContainText('Waiting for')

  // One deal, both stages: the curtain comes down on the same cue for each player.
  await hostBoard.getByRole('button', { name: 'Start the race' }).click()
  const titles: string[] = []
  for (const user of [host, friend]) {
    await expect(user.page.getByTestId('race-board')).toHaveAttribute('data-round', '1', { timeout: 15_000 })
    const sign = user.page.getByTestId('act-curtain').locator('.ba-cue-sign-title')
    await expect(sign).toHaveText(/\S/, { timeout: 15_000 })
    titles.push((await sign.textContent())!)
    await expect(user.page.getByTestId('act-curtain')).toContainText('Race · round 1')
  }
  expect(titles[0]).toBe(titles[1])
  // Each stage tells the other what it is doing, live.
  await friend.page.getByTestId('act-curtain').click()
  await expect(hostBoard.getByRole('listitem').filter({ hasNotText: '(you)' })).toContainText(/Posing|Taking a seat/, { timeout: 15_000 })
  // The referee asks the AI booth, not the browser: a finish claimed before Stubbs has guessed is refused,
  // and so is a deal from anyone but the host.
  const claim = (action: string) => friend.page.evaluate(async ([action, code, session]) => {
    const reply = await fetch('/api/actions/' + action, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: session }, body: JSON.stringify({ code }) })
    return reply.json() as Promise<{ success: boolean; code?: string }>
  }, [action, code, session] as const)
  expect(session).toMatch(/^Bearer /)
  expect(await claim('raceFinish')).toMatchObject({ success: false, code: 'not_finished' })
  expect(await claim('raceStart')).toMatchObject({ success: false, code: 'not_host' })
  await expect(hostBoard).not.toContainText(/\d:\d\d\.\d/)
})

test('a player’s best show is kept with their account, and nobody else sees it', async ({ users }) => {
  test.setTimeout(120_000)
  const [player, other] = await users(2)
  await player.page.clock.install()
  await openStage(player)
  const desk = player.page.getByTestId('ai-audience')
  await expect(desk).toHaveAttribute('data-service', 'live', { timeout: 15_000 })
  await player.page.getByRole('button', { name: /^Timed show/ }).click()
  await player.page.getByRole('dialog', { name: 'Tonight’s show' }).getByRole('button', { name: /^Level 1/ }).click()
  // Five acts run out of time without a single look, so the show costs nothing and scores 0/5.
  for (let act = 1; act <= 5; act++) {
    await expect(desk).toContainText(`Act ${act} of 5`, { timeout: 15_000 })
    const curtain = player.page.getByTestId('act-curtain')
    await curtain.click()
    await expect(curtain).toHaveCount(0)
    await player.page.clock.fastForward(46_000)
    await expect(desk).toHaveAttribute('data-end', 'timeout')
    await player.page.clock.fastForward(4_000)
  }
  await expect(player.page.getByRole('dialog', { name: 'Curtain call' })).toBeVisible({ timeout: 15_000 })

  // The record now lives with the account: it survives this browser forgetting it.
  await player.page.evaluate(() => localStorage.removeItem('bad-actors:show-best:1'))
  await player.page.reload()
  await expect(desk).toHaveAttribute('data-service', 'live', { timeout: 15_000 })
  await player.page.getByRole('button', { name: /^Timed show/ }).click()
  await expect(player.page.getByRole('dialog', { name: 'Tonight’s show' }).getByRole('button', { name: /^Level 1/ }))
    .toContainText(/Best: \d\/5/, { timeout: 15_000 })

  // Another player's account has its own record, and this one never reaches them.
  await openStage(other)
  await expect(other.page.getByTestId('ai-audience')).toHaveAttribute('data-service', 'live', { timeout: 15_000 })
  await other.page.evaluate(() => localStorage.removeItem('bad-actors:show-best:1'))
  await other.page.getByRole('button', { name: /^Timed show/ }).click()
  await expect(other.page.getByRole('dialog', { name: 'Tonight’s show' }).getByRole('button', { name: /^Level 1/ }))
    .toContainText('Not played yet')
})
