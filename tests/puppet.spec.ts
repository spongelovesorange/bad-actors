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

test('a rehearsal can switch props, remove one, and advance the cue', async ({ page }) => {
  await beginRehearsal(page)
  for (const prop of ['Cup', 'Phone', 'Plate']) {
    await page.getByRole('button', { name: prop, exact: true }).click()
    await expect(page.getByRole('button', { name: prop, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.getByRole('button', { name: 'Cup', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Plate', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Plate', exact: true })).toHaveAttribute('aria-pressed', 'false')
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
  await card.getByRole('button', { name: 'Hide cue' }).click()
  await expect(card.getByRole('heading', { name: 'Guess the pose' })).toBeVisible()
  expect(await card.innerHTML()).not.toContain('Drinking water')
  await card.getByRole('button', { name: 'Next cue' }).click()
  expect(await card.innerHTML()).not.toContain('Talking on the phone')
  await expect(card.getByRole('button', { name: 'Show cue' })).toHaveAttribute('aria-expanded', 'false')
  await card.getByRole('button', { name: 'Show cue' }).click()
  await expect(card.getByRole('heading', { name: 'Talking on the phone' })).toBeVisible()
})
