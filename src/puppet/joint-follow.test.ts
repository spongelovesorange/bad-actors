import { describe, expect, it } from 'vitest'
import { distance, initialPose, isJoint, moveHandle, pivot, rotate, stageHandles, withProp, type Joint, type Point } from './geometry'
import { moveJoint } from './joints'
import { advanceMotion, computeRig, createMotion, motionAtRest, stillMotion, tug, type PuppetRig } from './motion'

const origin = { x: 0, y: 0 }
const chest = { x: pivot.x, y: pivot.y - 51 }

function headCorner(rig: PuppetRig): Point {
  const local = rotate({ x: 29, y: -30 }, origin, rig.headAngle)
  return { x: rig.pose.head.x + local.x, y: rig.pose.head.y + local.y }
}

function requestedPoint(rig: PuppetRig, joint: Joint) {
  const from = rig.joints[joint]
  if (joint === 'chest' || joint === 'headTilt') {
    return rotate(from, joint === 'chest' ? rig.joints.waist : rig.pose.head, 18)
  }
  return { x: from.x + 9, y: from.y - 13 }
}

describe('holding a joint while its neighbors recoil', () => {
  for (const joint of stageHandles.filter(isJoint)) {
    it(joint + ' stays at its accepted position through the spring response', () => {
      const base = moveHandle(withProp(initialPose(), 'cup'), 'right', { x: 269, y: 113 })
      const initial = computeRig(base, stillMotion)
      const placed = moveJoint(base, joint, requestedPoint(initial, joint), initial)
      const resting = computeRig(placed, stillMotion)
      const accepted = resting.joints[joint]
      const delta = { x: accepted.x - initial.joints[joint].x, y: accepted.y - initial.joints[joint].y }
      expect(Math.hypot(delta.x, delta.y)).toBeGreaterThan(1)

      const engine = createMotion()
      tug(engine, joint, delta, 8)
      let maxGripDrift = 0, maxPassiveDisplacement = 0
      for (let i = 0; i < 100; ++i) {
        advanceMotion(engine, 1 / 60)
        const frame = computeRig(placed, engine.value, { handle: joint, point: accepted })
        maxGripDrift = Math.max(maxGripDrift, distance(accepted, frame.joints[joint]))
        // Check the painted torso and head at their grips, as well as the logical grab targets.
        if (joint === 'waist') maxGripDrift = Math.max(maxGripDrift, distance(accepted, frame.point(pivot)))
        if (joint === 'chest') maxGripDrift = Math.max(maxGripDrift, distance(accepted, frame.point(chest)))
        if (joint === 'headTilt') maxGripDrift = Math.max(maxGripDrift, distance(accepted, headCorner(frame)))
        for (const other of Object.keys(frame.joints) as Joint[]) {
          if (other !== joint) maxPassiveDisplacement = Math.max(maxPassiveDisplacement, distance(frame.joints[other], resting.joints[other]))
        }
        expect(frame.pose.right).toEqual(resting.pose.right)
        expect(frame.propCenter).toEqual(resting.propCenter)
      }
      expect(maxGripDrift).toBeLessThan(0.01)
      expect(maxPassiveDisplacement).toBeGreaterThan(0.5)
      expect(motionAtRest(engine)).toBe(true)
      expect(computeRig(placed, engine.value).joints).toEqual(resting.joints)
    })
  }

  it('a short shoulder, elbow or knee pull visibly rocks the torso on either diagonal', () => {
    const shortLevers = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'] as const
    for (const joint of shortLevers) {
      for (const x of [-10, 10]) {
        const engine = createMotion()
        tug(engine, joint, { x, y: -10 }, 44)
        let peak = 0
        for (let i = 0; i < 60; ++i) {
          advanceMotion(engine, 1 / 60)
          peak = Math.max(peak, Math.abs(engine.value.body))
        }
        expect(peak).toBeGreaterThan(4)
      }
    }
  })

  it('a stationary contact never wakes the actor or a prop for any of its 15 handles', () => {
    for (const handle of stageHandles) {
      const engine = createMotion()
      tug(engine, handle, { x: 0, y: 0 }, 16)
      expect(advanceMotion(engine, 1 / 60)).toBe(false)
      expect(engine.value).toEqual(stillMotion)
      expect(engine.speed).toEqual(stillMotion)
    }
  })
})
