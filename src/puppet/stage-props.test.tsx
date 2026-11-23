import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  distance, dragHandle, feel, hands, initialPose, moveHandle, phoneSamplePose, propCenter,
  propOffset, putDown, rotate, shoulders, snapHand, withHandShape, withProp, type PropKind,
} from './geometry'
import { computeRig, stillMotion } from './motion'
import { phoneView } from './Phone'
import { PuppetArt } from './PuppetArt'

describe('carrying a grabbed prop', () => {
  it.each(['cup', 'phone', 'plate'] as PropKind[])('poses the hand with the %s until it is put down and passed', prop => {
    for (const holder of hands) {
      const other = holder === 'left' ? 'right' : 'left'
      const pose = { ...withProp(initialPose(), prop), holder, propTurn: 45 }
      const start = propCenter(pose)
      const target = { x: start.x + (holder === 'left' ? 20 : -20), y: start.y - 50 }
      const carried = dragHandle(pose, 'prop', target)
      expect(carried.holder).toBe(holder)
      expect(carried[other]).toBe(pose[other])
      expect(distance(propCenter(carried), target)).toBeLessThan(0.001)
      const offset = propOffset(pose)
      expect(distance(propCenter(carried), carried[holder])).toBeCloseTo(Math.hypot(offset.x, offset.y))

      const far = dragHandle(carried, 'prop', { x: 2000, y: -500 })
      expect(far.holder).toBe(holder)
      expect(distance(far[holder], shoulders[holder])).toBeCloseTo(feel.wristReach)

      const down = putDown(carried)
      const passed = dragHandle(down, 'prop', down[other])
      expect(passed.holder).toBe(null)
      expect(snapHand(passed, 1.8, null, true)).toBe(other)
    }
  })
})

describe('silhouettes at arm’s length', () => {
  it.each(hands)('shows the camera back, straightens the %s sleeve and sets the eyeline through the lens', side => {
    const near = side === 'right' ? phoneSamplePose() :
      moveHandle({ ...withProp(initialPose(), 'phone'), holder: side }, side, { x: 207, y: 124 })
    const sign = side === 'right' ? 1 : -1
    const rigAtEar = computeRig(near, stillMotion)
    const ear = phoneView(rigAtEar)
    expect(ear.width).toBe(1)
    expect(ear.gazeX).toBe(0)

    const wrist = { x: shoulders[side].x + sign * 105, y: 101 }
    const far = moveHandle(near, side, wrist)
    const rig = computeRig(far, stillMotion)
    const raised = phoneView(rig)
    expect(raised.width).toBeLessThan(-0.65)
    expect(raised.gazeX * sign).toBeGreaterThan(3)
    const elbow = rig.joints[side === 'right' ? 'rightElbow' : 'leftElbow']
    const shoulder = rig.joints[side === 'right' ? 'rightShoulder' : 'leftShoulder']
    const midpoint = { x: (shoulder.x + wrist.x) / 2, y: (shoulder.y + wrist.y) / 2 }
    expect(distance(elbow, midpoint)).toBeLessThan(9)

    const scene = withHandShape(far, side === 'left' ? 'right' : 'left', 'peace')
    const painted = renderToStaticMarkup(<PuppetArt pose={scene} />)
    expect(painted).toContain('data-phone-side="back"')
    expect(painted).toContain('data-palm-shape="peace"')
    expect(painted).toBe(renderToStaticMarkup(<PuppetArt pose={structuredClone(scene)} />))
    const loose = moveHandle(far, 'prop', rig.propCenter)
    expect(phoneView(computeRig(loose, stillMotion)).gazeX).toBe(0)
  })

  it('supports the underside of a turned tray with either free palm only when placed there', () => {
    for (const holder of hands) {
      const other = holder === 'left' ? 'right' : 'left'
      const pose = { ...withProp(initialPose(), 'plate'), holder, propTurn: 45 }
      const center = propCenter(pose)
      const under = rotate({ x: center.x + (holder === 'right' ? -23 : 23), y: center.y + 12 }, center, 45)
      const centered = { ...pose, [other]: under }
      const paint = (p: typeof centered) => renderToStaticMarkup(<PuppetArt pose={p} />)
      expect(paint(centered).match(/data-support="true"/g)).toHaveLength(2)
      expect(paint({ ...centered, [other]: { x: under.x, y: under.y + 67 } }).match(/data-support="true"/g)).toHaveLength(1)
    }
  })
})
