import { expect, test, type Locator } from '@playwright/test'

async function center(locator: Locator) {
  return locator.evaluate(element => {
    const { left, top, width, height } = element.getBoundingClientRect()
    return { x: left + width / 2, y: top + height / 2 }
  })
}

for (const width of [1440, 390, 320]) {
  test(`the front-row spectator can see the actor at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/api/local-ai/status', route => route.fulfill({ json: { available: false } }))
    await page.goto('/?cue=5')
    const scene = page.locator('.ba-scene-floor')
    await scene.scrollIntoViewIfNeeded()
    await expect(scene.getByTestId('fly-cue')).toContainText('Surrendering')

    const [eye, pupil, actor, judge, foot] = await Promise.all([
      center(scene.locator('[data-critic-eye]')),
      center(scene.locator('[data-critic-pupil]')),
      center(scene.locator('[data-handle="head"]')),
      center(scene.locator('.ba-referee-art')),
      center(scene.locator('[data-sole="right"]')),
    ])
    expect(eye.x).toBeLessThan(actor.x)
    expect(eye.y).toBeGreaterThan(actor.y)
    expect(judge.x).toBeGreaterThan(actor.x)
    expect(judge.y).toBeLessThan(foot.y)

    // Use the eye's painted direction in screen space, including CSS transforms.
    const gaze = { x: pupil.x - eye.x, y: pupil.y - eye.y }
    const toActor = { x: actor.x - eye.x, y: actor.y - eye.y }
    const alignment = (gaze.x * toActor.x + gaze.y * toActor.y) /
      (Math.hypot(gaze.x, gaze.y) * Math.hypot(toActor.x, toActor.y))
    expect(alignment).toBeGreaterThan(0.5)

    // The scenery must also leave the actual grips reachable at these points.
    for (const handle of ['head', 'left', 'right', 'leftAnkle', 'rightAnkle']) {
      const reachable = await scene.locator(`[data-handle="${handle}"]`).evaluate(element => {
        const bounds = element.getBoundingClientRect()
        const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        return Boolean(target?.closest('svg[data-puppet-stage]'))
      })
      expect(reachable, `onstage grip: ${handle}`).toBe(true)
    }
  })
}
