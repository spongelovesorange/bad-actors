import { describe, expect, it } from 'vitest'
import { distance, feel, hands, homeHead, initialPose, moveHandle, phoneSamplePose, pivot, propCenter, putDown, rotate, shoulders, snapHand, solveElbow, turnProp, withProp } from './geometry'

describe('authored puppet pose', () => {
  it('tracks the exact reachable target and retains it while the shoulders sway', () => {
    let pose = initialPose()
    for (const hand of hands) {
      for (const target of [{ x: 250, y: 89 }, { x: 251, y: 119 }, { x: 250, y: 200 }, { x: 0, y: -3000 }]) {
        pose = moveHandle(pose, hand, target)
        const wrist = pose[hand]
        if (distance(shoulders[hand], target) < feel.wristReach) expect(wrist).toEqual(target)
        else expect(distance(shoulders[hand], wrist)).toBeCloseTo(feel.wristReach)
        for (const angle of [-feel.bodyLean, 0, feel.bodyLean]) {
          const s = rotate(shoulders[hand], pivot, angle)
          const elbow = solveElbow(s, wrist, hand === 'left' ? pose.leftBend : pose.rightBend)
          expect(distance(elbow, s)).toBeCloseTo(feel.armBone, 6)
          expect(distance(elbow, wrist)).toBeCloseTo(feel.armBone, 6)
        }
      }
    }
  })
  it('keeps the same visible elbow near the folded singularity and across the centerline', () => {
    const s = shoulders.left
    let pose = moveHandle(initialPose(), 'left', { x: s.x - 46, y: s.y })
    let prev = solveElbow(s, pose.left, pose.leftBend)
    for (let x = s.x - 45; x < s.x + 58; x++) {
      pose = moveHandle(pose, 'left', { x, y: s.y })
      const elbow = solveElbow(s, pose.left, pose.leftBend)
      expect(distance(elbow, prev)).toBeLessThan(2)
      prev = elbow
    }
  })
  it('bounds the head to its neck and rejects invalid coordinates', () => {
    const pose = initialPose()
    const head = moveHandle(pose, 'head', { x: 800, y: -200 }).head
    expect(Math.hypot((head.x - homeHead.x) / feel.headRadius.x, (head.y - homeHead.y) / feel.headRadius.y)).toBeCloseTo(1)
    expect(moveHandle(pose, 'left', { x: NaN, y: 0 })).toBe(pose)
  })
  it('keeps one attached object on the same hand through motion and rotation', () => {
    let pose = phoneSamplePose()
    const anchor = propCenter(pose)
    const next = moveHandle(pose, 'right', { x: 264, y: 128 })
    expect(propCenter(next).x - anchor.x).toBe(next.right.x - pose.right.x)
    pose = turnProp(withProp(next, 'cup'))
    expect(pose.prop).toBe('cup')
    expect(pose.propTurn).toBe(45)
    expect(pose.right).toEqual(next.right)
    const loose = putDown(pose)
    expect(loose.holder).toBe(null)
    expect(propCenter(moveHandle(loose, 'right', { x: 320, y: 160 }))).toEqual(propCenter(loose))
  })
  it('provides a wider preview than attach radius in screen pixels at each scale', () => {
    for (const scale of [0.6, 1.7]) {
      const p = withProp(initialPose(), 'phone')
      const loose = moveHandle(p, 'prop', { x: p.left.x - 21 / scale, y: p.left.y })
      expect(snapHand(loose, scale, null)).toBe('left')
      expect(snapHand(loose, scale, 'left', true)).toBe(null)
      const closer = moveHandle(loose, 'prop', { x: p.left.x - 12 / scale, y: p.left.y })
      expect(snapHand(closer, scale, null, true)).toBe('left')
    }
  })
  it('aligns the mirrored mug handle with the receiving hand at any prop rotation', () => {
    for (const hand of hands) {
      for (const angle of [0, 90, 270]) {
        const held = { ...withProp(initialPose(), 'cup'), holder: hand, propTurn: angle }
        const loose = moveHandle(held, 'prop', propCenter(held))
        expect(snapHand(loose, 3, null, true)).toBe(hand)
      }
    }
  })
  it('keeps the previous snap candidate when both palms are equally close', () => {
    let p = withProp(initialPose(), 'cup')
    p = moveHandle(moveHandle(p, 'left', { x: 250, y: 147 }), 'right', { x: 253, y: 147 })
    p = moveHandle(p, 'prop', { x: 252, y: 147 })
    expect(snapHand(p, 1, 'left')).toBe('left')
    expect(snapHand(p, 1, 'right')).toBe('right')
  })
})
