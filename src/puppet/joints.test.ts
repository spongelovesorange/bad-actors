import { describe, expect, it } from 'vitest'
import { distance, initialPose, moveHandle, type Joint, type Point, type PuppetPose } from './geometry'
import { moveJoint, turnFoot, turnJoint } from './joints'
import { advanceMotion, computeRig, createMotion, stillMotion, tug } from './motion'

function displace(p: PuppetPose, joint: Joint, delta: Point) {
  const rig = computeRig(p, stillMotion), from = rig.joints[joint]
  return moveJoint(p, joint, { x: from.x + delta.x, y: from.y + delta.y }, rig)
}

describe('articulated posing', () => {
  it('bends either sleeve and shrugs each shoulder independently while a posed wrist stays put', () => {
    for (const side of ['left', 'right'] as const) {
      const elbow = side === 'left' ? 'leftElbow' : 'rightElbow'
      const socket = side === 'left' ? 'leftShoulder' : 'rightShoulder'
      let p = moveHandle(initialPose(), side, { x: 250, y: 140 })
      const original = computeRig(p, stillMotion)
      p = displace(p, elbow, { x: 0, y: 12 })
      const bent = computeRig(p, stillMotion)
      expect(bent.joints[elbow].y).toBeCloseTo(original.joints[elbow].y + 12)
      expect(bent.pose[side]).toEqual(original.pose[side])
      p = displace(p, socket, { x: 0, y: -1000 })
      const shrugged = computeRig(p, stillMotion)
      expect(shrugged.joints[socket].y).toBeCloseTo(original.joints[socket].y - 19)
      expect(shrugged.pose[side]).toEqual(original.pose[side])
    }
  })

  it('shifts the trunk over anchored feet, turns the neck independently and keeps the face attached', () => {
    let p = initialPose()
    const before = computeRig(p, stillMotion)
    p = displace(p, 'waist', { x: 18, y: 24 })
    const crouched = computeRig(p, stillMotion)
    expect(crouched.joints.waist.x).toBe(before.joints.waist.x + 18)
    expect(crouched.pose.head.y).toBe(before.pose.head.y + 24)
    expect(crouched.joints.leftAnkle).toEqual(before.joints.leftAnkle)
    expect(distance(crouched.joints.leftKnee, before.joints.leftKnee)).toBeGreaterThan(4)
    p = turnJoint(p, 'chest', -13)
    const leaning = computeRig(p, stillMotion)
    expect(leaning.joints.leftShoulder.x).toBeLessThan(crouched.joints.leftShoulder.x - 8)
    p = turnJoint(p, 'headTilt', 26)
    const tilted = computeRig(p, stillMotion)
    expect(tilted.pose.head).toEqual(leaning.pose.head)
    expect(tilted.headAngle - leaning.headAngle).toBe(26)
    expect(tilted.joints.waist).toEqual(leaning.joints.waist)
    const head = moveHandle(p, 'head', { x: tilted.pose.head.x + 4, y: tilted.pose.head.y })
    expect(computeRig(head, stillMotion).pose.head.x).toBeCloseTo(tilted.pose.head.x + 4)
  })

  it('plants a raised foot at its selected angle, biases a knee, and keeps its stance through a throw', () => {
    const original = initialPose()
    let p = displace(original, 'leftAnkle', { x: -17, y: -37 })
    const lifted = computeRig(p, stillMotion)
    expect(lifted.joints.leftAnkle).toEqual({ x: 205, y: 260 })
    expect(lifted.footAngle.left).toBeLessThan(-10)
    p = displace(p, 'leftKnee', { x: -9, y: 3 })
    const beforeRotation = computeRig(p, stillMotion)
    expect(beforeRotation.joints.leftKnee.x).toBeCloseTo(lifted.joints.leftKnee.x - 9)
    p = turnFoot(p, 'left', 12)
    const planted = computeRig(p, stillMotion)
    expect(planted.footAngle.left - beforeRotation.footAngle.left).toBe(12)
    const motion = createMotion()
    tug(motion, 'right', { x: 20, y: -160 }, 35)
    for (let i = 0; i < 100; i++) {
      advanceMotion(motion, 1 / 60)
      const frame = computeRig(p, motion.value)
      expect(frame.joints.leftAnkle).toEqual(planted.joints.leftAnkle)
      expect(frame.footAngle.left).toBe(planted.footAngle.left)
      expect(frame.joints.rightAnkle).toEqual(lifted.joints.rightAnkle)
    }
    const saved = structuredClone(p)
    expect(computeRig(saved, stillMotion).joints).toEqual(planted.joints)
    expect(computeRig(initialPose(), stillMotion).joints.leftAnkle).toEqual({ x: 222, y: 297 })
  })

  it('turns around the selected pivot with a pointer drag and bounds direct manipulation', () => {
    let p = initialPose()
    const rig = computeRig(p, stillMotion)
    p = moveJoint(p, 'chest', { x: rig.joints.waist.x + 300, y: rig.joints.waist.y }, rig)
    expect(p.joints?.chest?.x).toBe(24)
    p = turnJoint(p, 'headTilt', -500)
    expect(p.joints?.headTilt?.x).toBe(-47)
    p = displace(p, 'waist', { x: 1500, y: 1500 })
    expect(p.joints?.waist).toEqual({ x: 26, y: 28 })
    expect(moveJoint(p, 'leftAnkle', { x: NaN, y: 40 }, computeRig(p, stillMotion))).toBe(p)
  })
})
