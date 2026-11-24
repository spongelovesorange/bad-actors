import { expect, test, type Locator, type Page } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

type Point = { x: number, y: number }

async function center(handle: Locator): Promise<Point> {
  return handle.evaluate(element => {
    const circle = element as SVGCircleElement
    const transform = circle.getScreenCTM()
    if (!transform) throw new Error('The actor is not visible')
    const point = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(transform)
    return { x: point.x, y: point.y }
  })
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

async function beginRehearsal(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Your turn' }).click()
  await expect(page.getByRole('heading', { name: 'Drinking water' })).toBeVisible()
  return page.locator('svg[data-puppet-stage]')
}

test('grabbing the palm at an offset preserves the pose through release and settling', async ({ page }) => {
  const errors = captureConsoleErrors(page)
  const stage = await beginRehearsal(page)
  const hand = stage.locator('[data-handle="left"]')
  await hand.scrollIntoViewIfNeeded()
  const before = await center(hand)
  const grip = { x: before.x + 5, y: before.y + 3 }
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  expect(distance(before, await center(hand))).toBeLessThan(1.5)

  // Move in one event beyond the original target, while staying within arm reach.
  const expected = { x: before.x + 16, y: before.y - 22 }
  await page.mouse.move(grip.x + 16, grip.y - 22)
  await expect.poll(async () => distance(expected, await center(hand))).toBeLessThan(1.5)
  await page.mouse.up()
  // The body may continue to settle. The released palm must keep its target.
  await page.waitForTimeout(350)
  expect(distance(expected, await center(hand))).toBeLessThan(1.5)
  expect(errors).toEqual([])
})

test('lifting the phone by its glass carries the wrist, then putting it down allows a handoff', async ({ page }) => {
  const stage = await beginRehearsal(page)
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  const phone = stage.locator('[data-handle="prop"]')
  await stage.scrollIntoViewIfNeeded()
  const start = await center(phone)
  const destination = await stage.evaluate(node => {
    const point = new DOMPoint(377, 79).matrixTransform((node as SVGSVGElement).getScreenCTM()!)
    return { x: point.x, y: point.y }
  })
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await expect(stage).toHaveAttribute('data-grabbed', 'prop')
  await page.mouse.move(destination.x, destination.y, { steps: 6 })
  await page.mouse.up()
  await expect(stage.locator('[data-palm="right"]')).toHaveAttribute('data-palm-shape', 'grip')
  await expect(stage.locator('[data-phone-side]')).toHaveAttribute('data-phone-side', 'back')
  await expect.poll(async () => distance(destination, await center(phone))).toBeLessThan(1.5)

  await page.getByRole('button', { name: 'Put down', exact: true }).click()
  await expect(stage).toHaveAttribute('data-settled', '1')
  const loose = await center(phone)
  const otherPalm = await center(stage.locator('[data-handle="left"]'))
  await page.mouse.move(loose.x, loose.y)
  await page.mouse.down()
  await page.mouse.move(otherPalm.x, otherPalm.y, { steps: 6 })
  await page.mouse.up()
  await expect(stage.locator('[data-palm="left"]')).toHaveAttribute('data-palm-shape', 'grip')
})

test('a rehearsal can switch props, remove one, and advance the cue', async ({ page }) => {
  await beginRehearsal(page)
  for (const prop of ['Cup', 'Phone', 'Tray']) {
    await page.getByRole('button', { name: prop, exact: true }).click()
    await expect(page.getByRole('button', { name: prop, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.getByRole('button', { name: 'Cup', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Tray', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tray', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Next cue' }).click()
  await expect(page.getByRole('heading', { name: 'Drinking water' })).toHaveCount(0)
})

test.describe('narrow touch rehearsal', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('dragging a palm on the stage holds the pose without scrolling the page', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'The touch sequence uses the Chromium input protocol')
    const stage = await beginRehearsal(page)
    const hand = stage.locator('[data-handle="left"]')
    await hand.scrollIntoViewIfNeeded()
    const start = await center(hand)
    const target = { x: start.x + 11, y: start.y - 19 }
    const scrollY = await page.evaluate(() => window.scrollY)
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [target] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => distance(target, await center(hand))).toBeLessThan(2)
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test('handing the screen to a guesser hides the cue until the actor shows it', async ({ page }) => {
  await beginRehearsal(page)
  const card = page.getByRole('region', { name: 'Cue card' })
  const board = page.getByTestId('fly-cue')
  await card.getByRole('button', { name: 'Hide cue' }).click()
  await expect(board.getByRole('heading', { name: 'Guess the pose' })).toBeVisible()
  expect(await page.locator('main').innerHTML()).not.toContain('Drinking water')
  await card.getByRole('button', { name: 'Next cue' }).click()
  expect(await page.locator('main').innerHTML()).not.toContain('Talking on the phone')
  await expect(card.getByRole('button', { name: 'Show cue' })).toHaveAttribute('aria-expanded', 'false')
  await card.getByRole('button', { name: 'Show cue' }).click()
  await expect(board.getByRole('heading', { name: 'Talking on the phone' })).toBeVisible()
})

test('the numbered practice link opens an illustrated cue that can be concealed', async ({ page }) => {
  await page.goto('/?cue=3')
  const card = page.getByRole('region', { name: 'Cue card' })
  const board = page.getByTestId('fly-cue')
  await expect(board.getByRole('heading', { name: 'Taking a selfie' })).toBeVisible()
  await card.getByRole('button', { name: 'Acting hint' }).click()
  const example = card.locator('#ba-stage-note img')
  await expect(example).toHaveAttribute('src', '/blocking/selfie.png')
  await expect.poll(() => example.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
  await card.getByRole('button', { name: 'Hide cue' }).click()
  await expect(card.locator('#ba-stage-note')).toHaveCount(0)
  await expect(card.getByRole('combobox')).toHaveCount(0)
  expect(await card.innerHTML()).not.toMatch(/selfie|peace sign/i)
  expect(await board.innerHTML()).not.toMatch(/selfie|peace sign/i)
  await card.getByRole('button', { name: 'Show cue' }).click()
  await card.getByRole('combobox').selectOption({ label: 'Carrying a tray' })
  await expect(board.getByRole('heading', { name: 'Carrying a tray' })).toBeVisible()
  await expect(page).toHaveURL(/cue=6/)
  await expect(card.getByRole('button', { name: 'Acting hint' })).toHaveAttribute('aria-expanded', 'false')
})
