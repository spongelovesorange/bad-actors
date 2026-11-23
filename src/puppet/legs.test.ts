import { describe, expect, it } from 'vitest'
import { distance, initialPose, moveHandle, withProp, type Joint } from './geometry'
import { moveJoint, turnFoot, turnJoint } from './joints'
import { advanceMotion, computeRig, createMotion, stillMotion, tug } from './motion'
import { defaultAnkle, legLandmarks } from './legs'

for (const side of ['left', 'right'] as const) {
  const outward = side === 'left' ? -1 : 1
  const hip = { x: side === 'left' ? 229 : 277, y: 246 }

  describe(side + ' leg', () => {
    it('plants its boot as a shifting hip bends the knee', () => {
      const ankle = defaultAnkle(side)
      const standing = legLandmarks(side, hip, ankle)
      const loaded = legLandmarks(side, { x: hip.x + 6 * outward, y: hip.y + 7 }, ankle)
      expect(loaded.ankle).toEqual(standing.ankle)
      expect(distance(standing.knee, loaded.knee)).toBeGreaterThan(4)
      expect((standing.knee.x - hip.x) * outward).toBeGreaterThan(0)
      expect(distance(hip, standing.knee)).toBeCloseTo(28.5, 5)
      expect(distance(ankle, standing.knee)).toBeCloseTo(28.5, 5)
    })

    it('follows a raised boot through a fully folded pose without a knee flip', () => {
      let previous = legLandmarks(side, hip, { x: hip.x, y: hip.y + 62 }).knee
      for (let y = 61.5; y >= -35; y -= 0.5) {
        const ankle = { x: hip.x, y: hip.y + y }
        const { ankle: boot, knee } = legLandmarks(side, hip, ankle)
        expect(boot).toEqual(ankle)
        expect(distance(knee, previous)).toBeLessThan(3)
        previous = knee
      }
    })

    it('lets a player place the knee within a modest range without moving the boot', () => {
      const ankle = { x: hip.x + outward * 27, y: hip.y + 29 }
      const automatic = legLandmarks(side, hip, ankle)
      const posed = legLandmarks(side, hip, ankle, { x: -9, y: 6 })
      expect(posed.ankle).toEqual(ankle)
      expect(posed.knee.x - automatic.knee.x).toBeCloseTo(-9)
      expect(posed.knee.y - automatic.knee.y).toBeCloseTo(6)
      const extreme = legLandmarks(side, hip, ankle, { x: 1000, y: -1000 })
      expect(extreme.knee.x - automatic.knee.x).toBeCloseTo(16)
      expect(extreme.knee.y - automatic.knee.y).toBeCloseTo(-16)
    })
  })
}

it('mirrors left and right folds as a raised foot crosses the hip', () => {
  const hip = { x: 0, y: 0 }
  const left = legLandmarks('left', hip, { x: -12, y: -9 }).knee
  const right = legLandmarks('right', hip, { x: 12, y: -9 }).knee
  expect(right.x).toBeCloseTo(-left.x)
  expect(right.y).toBeCloseTo(left.y)
})

it('keeps both feet and the cup anchored through 64 combinations of joint limits', () => {
  let maxLandmark = 0, maxBootAngleDrift = 0, maxAnkleDrift = 0, maxWristDrift = 0, maxCupDrift = 0
  for (let mask = 0; mask < 64; ++mask) {
    const sign = (bit: number) => (mask >> bit) & 1 ? 1 : -1
    let pose = moveHandle(withProp(initialPose(), 'cup'), 'right', { x: 269, y: 113 })
    const push = (key: Joint, x: number, y: number) => {
      const rig = computeRig(pose, stillMotion), from = rig.joints[key]
      pose = moveJoint(pose, key, { x: from.x + x, y: from.y + y }, rig)
    }
    push('waist', sign(0) * 200, sign(1) * 200)
    pose = turnJoint(pose, 'chest', sign(2) * 120)
    pose = turnJoint(pose, 'headTilt', -sign(2) * 120)
    for (const side of ['left', 'right'] as const) {
      const direction = side === 'left' ? -1 : 1
      push(`${side}Ankle`, direction * sign(3) * 160, sign(4) * 160)
      push(`${side}Knee`, direction * sign(5) * 100, -sign(4) * 100)
      push(`${side}Shoulder`, direction * sign(1) * 180, sign(0) * 180)
      push(`${side}Elbow`, direction * sign(2) * 180, sign(3) * 180)
      pose = turnFoot(pose, side, direction * sign(5) * 120)
    }
    const planted = computeRig(pose, stillMotion), engine = createMotion()
    tug(engine, 'left', { x: 28 * sign(3), y: -145 }, 18)
    for (let step = 0; step < 110; ++step) {
      advanceMotion(engine, 1 / 60)
      const rig = computeRig(pose, engine.value)
      for (const point of Object.values(rig.joints)) {
        maxLandmark = Math.max(maxLandmark, Math.abs(point.x), Math.abs(point.y))
      }
      for (const side of ['left', 'right'] as const) {
        const ankle = `${side}Ankle` as const
        maxAnkleDrift = Math.max(maxAnkleDrift, distance(planted.joints[ankle], rig.joints[ankle]))
        maxBootAngleDrift = Math.max(maxBootAngleDrift, Math.abs(planted.footAngle[side] - rig.footAngle[side]))
      }
      maxWristDrift = Math.max(maxWristDrift, distance(planted.pose.right, rig.pose.right))
      maxCupDrift = Math.max(maxCupDrift, distance(planted.propCenter, rig.propCenter))
    }
  }
  expect(Number.isFinite(maxLandmark)).toBe(true)
  expect([maxAnkleDrift, maxBootAngleDrift, maxWristDrift, maxCupDrift]).toEqual([0, 0, 0, 0])
})
