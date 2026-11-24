import { expect, test } from '@playwright/test'
import { cueTitles } from '../src/deck'
import { measureCueInk } from './fly-cue-ink'

test('all printed cue titles clear the hand-cut paper edges, including at layout breakpoints', async ({ page }) => {
  test.setTimeout(240_000)
  await page.route('**/api/local-ai/**', route => route.fulfill({ json: { available: false } }))
  expect(cueTitles).toHaveLength(30)
  for (const [index, title] of cueTitles.entries()) {
    await page.goto('/?cue=' + (index + 1))
    await page.evaluate(() => document.fonts.ready)
    for (const width of [320, 360, 390, 520, 600, 601, 720, 721, 940, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.locator('.ba-fly-cue-title')).toHaveText(title)
      const metrics = await page.evaluate(measureCueInk)
      expect(metrics.fontSize).toBeGreaterThanOrEqual(16)
      expect(metrics.minInkClearance, title + ' at ' + width + ' pixels').toBeGreaterThanOrEqual(5)
    }
  }
})
