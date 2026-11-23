import { expect, test, type Locator, type Page } from '@playwright/test'
import type { StageHandle } from '../src/puppet/geometry'

type Gesture = { handle: StageHandle; move: [number, number]; pivot?: 'head' | 'waist'; loose?: boolean }

const gestures: Gesture[] = [
  { handle: 'left', move: [-12, -70] }, { handle: 'right', move: [12, -70] },
  { handle: 'head', move: [16, -8] },
  { handle: 'leftShoulder', move: [-8, -15] }, { handle: 'rightShoulder', move: [8, -15] },
  { handle: 'leftElbow', move: [-18, -14] }, { handle: 'rightElbow', move: [18, -14] },
  { handle: 'waist', move: [18, 19] },
  { handle: 'chest', move: [0, 0], pivot: 'waist' }, { handle: 'headTilt', move: [0, 0], pivot: 'head' },
  { handle: 'leftKnee', move: [-11, -12] }, { handle: 'rightKnee', move: [11, -12] },
  { handle: 'leftAnkle', move: [-18, -34] }, { handle: 'rightAnkle', move: [18, -34] },
  { handle: 'prop', move: [42, -28] }, { handle: 'prop', move: [-42, -28], loose: true },
]

async function grabAndFlick(page: Page, gesture: Gesture, url = '/') {
  await page.goto(url)
  await page.getByRole('button', { name: 'Your turn' }).click()
  if (gesture.handle === 'prop') {
    await page.getByRole('button', { name: 'Cup', exact: true }).click()
    if (gesture.loose) await page.getByRole('button', { name: 'Put down' }).click()
  }
  const stage = page.locator('svg[data-puppet-stage]')
  await stage.scrollIntoViewIfNeeded()
  const [start, end] = await stage.evaluate((node, gesture) => {
    const svg = node as SVGSVGElement
    const center = (id: string) => {
      const handle = svg.querySelector<SVGCircleElement>(`[data-handle="${id}"]`)
      if (!handle) throw new Error('Missing handle: ' + id)
      return new DOMPoint(handle.cx.baseVal.value, handle.cy.baseVal.value)
    }
    const first = center(gesture.handle)
    let last = new DOMPoint(first.x + gesture.move[0], first.y + gesture.move[1])
    if (gesture.pivot) {
      const { x, y } = center(gesture.pivot)
      const a = Math.PI / 9, dx = first.x - x, dy = first.y - y
      last = new DOMPoint(x + dx * Math.cos(a) - dy * Math.sin(a), y + dx * Math.sin(a) + dy * Math.cos(a))
    }
    const matrix = svg.getScreenCTM()
    if (!matrix) throw new Error('Missing stage transform')
    return [first, last].map(p => {
      const client = p.matrixTransform(matrix)
      return { x: client.x, y: client.y }
    })
  }, gesture)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await expect(stage).toHaveAttribute('data-grabbed', gesture.handle)
  await page.mouse.move(end.x, end.y)
  await page.mouse.up()
  return { stage, end }
}

// A changing head angle alone could be the authored pose. Compare actual
// painted head and torso points across frames after the mouse is already up.
async function afterRelease(stage: Locator) {
  return stage.evaluate(async node => {
    const torso = node.querySelector<SVGGraphicsElement>('[data-rig="torso"]')!
    const head = node.querySelector<SVGGraphicsElement>('[data-rig="head"]')!
    const bounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]]
    const start = performance.now()
    let frames = 0
    do {
      await new Promise(requestAnimationFrame)
      const shoulder = new DOMPoint(225, 162).matrixTransform(torso.getScreenCTM()!)
      const cheek = new DOMPoint(-20, 0).matrixTransform(head.getScreenCTM()!)
      const coordinates = [shoulder.x, shoulder.y, cheek.x, cheek.y]
      coordinates.forEach((value, i) => {
        bounds[i][0] = Math.min(bounds[i][0], value)
        bounds[i][1] = Math.max(bounds[i][1], value)
      })
      frames++
    } while ((frames < 12 || node.getAttribute('data-settled') !== '1') && performance.now() - start < 3200)
    return { travel: Math.max(...bounds.map(([low, high]) => high - low)), settled: node.getAttribute('data-settled') }
  })
}

for (const gesture of gestures) {
  test(`fast drag of ${gesture.loose ? 'loose ' : ''}${gesture.handle} moves the painted actor after release`, async ({ page }) => {
    const { stage } = await grabAndFlick(page, gesture)
    const sample = await afterRelease(stage)
    expect(sample.travel).toBeGreaterThan(0.75)
    expect(sample.settled).toBe('1')
  })
}

for (const mode of ['direct', 'reduced'] as const) {
  test(`a foot drag stays steady in ${mode} motion mode`, async ({ page }) => {
    if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' })
    const { stage, end } = await grabAndFlick(page, { handle: 'leftAnkle', move: [-18, -34] }, mode === 'direct' ? '/?direct=1' : '/')
    const sample = await afterRelease(stage)
    expect(sample.travel).toBeLessThan(0.1)
    expect(sample.settled).toBe('1')
    const error = await stage.locator('[data-handle="leftAnkle"]').evaluate((node, target) => {
      const ankle = node as SVGCircleElement
      const displayed = new DOMPoint(ankle.cx.baseVal.value, ankle.cy.baseVal.value).matrixTransform(ankle.getScreenCTM()!)
      return Math.hypot(displayed.x - target.x, displayed.y - target.y)
    }, end)
    expect(error).toBeLessThan(1.5)
  })
}
