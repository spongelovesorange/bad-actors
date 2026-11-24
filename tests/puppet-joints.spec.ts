import { expect, test } from '@playwright/test'

test('all joints can be posed together while hands, feet and expression keep their edits', async ({ page }) => {
  await page.goto('/')
  const stage = page.getByRole('group', { name: 'Puppet stage' })
  const joint = (name: string) => stage.getByRole('button', { name, exact: true })
  const joints = [
    'Head', 'Left hand', 'Right hand', 'Left shoulder', 'Right shoulder', 'Left elbow', 'Right elbow',
    'Waist', 'Turn torso', 'Tilt head', 'Left knee', 'Right knee', 'Left foot', 'Right foot',
  ]
  for (const name of joints) {
    await expect(joint(name)).toBeVisible()
    await expect(joint(name)).toBeEnabled()
  }
  await expect(page.getByRole('group', { name: 'Drag points' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Your turn' }).click()

  const shoulder = joint('Right shoulder')
  const shoulderStart = Number(await shoulder.getAttribute('cy'))
  await shoulder.press('Shift+ArrowUp')
  await expect.poll(async () => Number(await shoulder.getAttribute('cy'))).toBeLessThan(shoulderStart - 1)

  const leftHand = page.getByRole('group', { name: 'Left hand', exact: true })
  const rightHand = page.getByRole('group', { name: 'Right hand', exact: true })
  const openPalm = leftHand.getByRole('radio', { name: 'Open palm' })
  const fist = rightHand.getByRole('radio', { name: 'Fist' })
  const peace = rightHand.getByRole('radio', { name: 'Peace sign' })
  const rightPalm = stage.locator('[data-palm="right"]')
  await expect(leftHand.getByRole('radio')).toHaveCount(4)
  await expect(rightHand.getByRole('radio')).toHaveCount(4)
  await openPalm.check()
  await fist.check()
  await expect(stage.locator('[data-palm="left"]')).toHaveAttribute('data-palm-shape', 'open')
  await expect(rightPalm).toHaveAttribute('data-palm-shape', 'fist')
  await page.getByRole('button', { name: 'Cup', exact: true }).click()
  await expect(rightPalm).toHaveAttribute('data-palm-shape', 'grip')
  await fist.press('ArrowRight')
  await expect(peace).toBeChecked()
  await expect(rightHand).toContainText('Put down the cup to switch to “Peace sign”.')
  await expect(rightPalm).toHaveAttribute('data-palm-shape', 'grip')
  await page.getByRole('button', { name: 'Put down', exact: true }).click()
  await expect(rightPalm).toHaveAttribute('data-palm-shape', 'peace')

  const foot = joint('Left foot')
  const footStart = Number(await foot.getAttribute('cy'))
  await foot.press('Shift+ArrowUp')
  await expect.poll(async () => Number(await foot.getAttribute('cy'))).toBeLessThan(footStart - 1)
  const sole = stage.locator('[data-sole="left"]')
  await expect(stage).toHaveAttribute('data-settled', '1')
  const lifted = await sole.getAttribute('transform')
  await page.getByRole('button', { name: 'Turn left foot clockwise', exact: true }).click()
  await expect(stage).toHaveAttribute('data-settled', '0')
  await expect.poll(() => sole.getAttribute('transform')).not.toBe(lifted)
  await expect(stage).toHaveAttribute('data-settled', '1')

  await page.getByRole('button', { name: 'Bracing', exact: true }).click()
  await expect(stage.locator('[data-rig="head"] [data-face]')).toHaveAttribute('data-face', 'braced')
  await expect(openPalm).toBeChecked()
  await expect(peace).toBeChecked()
  await expect.poll(async () => Number(await shoulder.getAttribute('cy'))).toBeLessThan(shoulderStart - 1)
})
