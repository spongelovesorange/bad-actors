import { describe, expect, it } from 'vitest'
import { initialPose, isJoint, moveHandle, stageHandles, withProp, type Point, type StageHandle } from './geometry'
import { pickTarget, stageTargets, type StageTarget } from './hit'
import { moveJoint } from './joints'
import { computeRig, stillMotion } from './motion'

describe('direct puppet picking', () => {
  it('gives every visible joint its own reachable center, including wrist, head and the cup at the lips', () => {
    const sip = moveHandle(withProp(initialPose(), 'cup'), 'right', { x: 269, y: 113 })
    const rig = computeRig(sip, stillMotion)
    for (const scale of [0.55, 1.5]) {
      const targets = stageTargets(rig, scale)
      expect(targets.map(t => t.id)).toEqual(stageHandles)
      for (const coarse of [false, true]) {
        for (const t of targets) expect(pickTarget(t.center, targets, coarse)).toBe(t.id)
      }
      expect(targets.every(t => t.touchRadius * scale >= 24)).toBe(true)
    }
    expect(stageTargets(computeRig(initialPose(), stillMotion), 1)).toHaveLength(stageHandles.length - 1)
  })

  it('excludes a small ineligible landmark even if its center is closer than the eligible torso', () => {
    const targets: StageTarget[] = [
      { id: 'waist', center: { x: 100, y: 0 }, radius: 38, touchRadius: 38 },
      { id: 'leftElbow', center: { x: 56, y: 0 }, radius: 11, touchRadius: 24 },
    ]
    expect(pickTarget({ x: 70, y: 0 }, targets, false)).toBe('waist')
    expect(pickTarget({ x: 70, y: 0 }, targets, true)).toBe('leftElbow')
    expect(pickTarget({ x: 150, y: 0 }, targets, true)).toBeNull()
  })

  it('lets repeated taps reach each stacked part in order even when the wrist and prop cover the face', () => {
    const center = { x: 251, y: 104 }
    const targets: StageTarget[] = (['head', 'prop', 'right'] as const).map(id =>
      ({ id, center, radius: 15, touchRadius: 24 }))
    expect(pickTarget(center, targets, true)).toBe('right')
    expect(pickTarget(center, targets, true, { previous: 'right', slop: 8 })).toBe('prop')
    expect(pickTarget(center, targets, true, { previous: 'prop', slop: 8 })).toBe('head')
    expect(pickTarget(center, targets, true, { previous: 'head', slop: 8 })).toBe('right')
  })

  it('poses a wrist, an elbow, the pelvis, a boot and the head on one uninterrupted actor', () => {
    let pose = withProp(initialPose(), 'cup')
    const moves: [StageHandle, Point][] = [
      ['right', { x: -55, y: -145 }], ['leftElbow', { x: -8, y: -6 }], ['waist', { x: 7, y: 9 }],
      ['rightAnkle', { x: 15, y: -16 }], ['headTilt', { x: 9, y: 10 }],
    ]
    for (const [handle, delta] of moves) {
      const rig = computeRig(pose, stillMotion)
      const targets = stageTargets(rig, 0.8)
      const { center } = targets.find(t => t.id === handle)!
      expect(pickTarget(center, targets, true)).toBe(handle)
      const to = { x: center.x + delta.x, y: center.y + delta.y }
      pose = isJoint(handle) ? moveJoint(pose, handle, to, rig) : moveHandle(pose, handle, to)
    }
    expect(pose.pinned?.right).toBe(true)
    expect(Object.keys(pose.joints ?? {})).toEqual(['leftElbow', 'waist', 'rightAnkle', 'headTilt'])
    const played = computeRig(pose, stillMotion)
    expect(played.joints.rightAnkle).toEqual({ x: 295, y: 281 })
    expect(played.pose.right).toEqual({ x: 271, y: 117 })
  })
})
