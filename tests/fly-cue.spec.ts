import { expect, test } from '@playwright/test'
import { measureCueInk } from './fly-cue-ink'

test('all printed cue titles clear the hand-cut paper edges, including at layout breakpoints', async ({ page }) => {
  test.setTimeout(60_000)
  await page.route('**/api/local-ai/**', route => route.fulfill({ json: { available: false } }))
  await page.goto('/?cue=1')
  const chooser = page.getByRole('combobox', { name: 'Choose a cue' })
  const choices = await chooser.locator('option').allTextContents()
  expect(choices).toHaveLength(6)
  await page.evaluate(() => document.fonts.ready)
  for (const width of [320, 360, 390, 520, 600, 601, 720, 721, 940, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const title of choices) {
      await chooser.selectOption({ label: title })
      await expect(page.locator('.ba-fly-cue-title')).toHaveText(title)
      const metrics = await page.evaluate(measureCueInk)
      expect(metrics.fontSize).toBeGreaterThanOrEqual(16)
      expect(metrics.minInkClearance, title + ' at ' + width + ' pixels').toBeGreaterThanOrEqual(5)
    }
  }
})
