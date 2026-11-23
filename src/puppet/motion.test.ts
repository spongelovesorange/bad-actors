import { describe, expect, it } from 'vitest'
import {
  distance, initialPose, moveHandle, pivot, propCenter, rotate, shoulders, withProp,
} from './geometry'
import {
  advanceMotion, bodyMatrix, bodyPoint, computeRig, createMotion, cupRim, displayPose, headAngle, motionAtRest, stillMotion, tug,
} from './motion'

describe('Bad Actors slapstick motion', () => {
  it('keeps the cup at the lips and both posed palms planted through a sudden vertical throw', () => {
    const sip = moveHandle(withProp(initialPose(), 'cup'), 'right', { x: 269, y: 113 })
    const pose = moveHandle(sip, 'left', { x: sip.left.x, y: 75 })
    const rim = cupRim(sip)
    const engine = createMotion()
    // The entire move and release arrive before even one animation frame.
    tug(engine, 'left', { x: 0, y: pose.left.y - sip.left.y }, 40)
    expect(motionAtRest(engine)).toBe(false)
    const tilt: number[] = [], neck: number[] = [], hipDip: number[] = [], stretch: number[] = []
    const torsoLength = distance(pivot, shoulders.left)
    for (let i = 0; i < 120; i++) {
      advanceMotion(engine, 1 / 60)
      const m = engine.value, drawn = displayPose(pose, m)
      tilt.push(m.body)
      neck.push(headAngle(pose, m))
      const hip = bodyPoint(pivot, m)
      hipDip.push(hip.y - pivot.y)
      stretch.push(distance(hip, bodyPoint(shoulders.left, m)) - torsoLength)
      expect(drawn.left).toEqual(pose.left)
      expect(drawn.right).toEqual(sip.right)
      expect(propCenter(drawn)).toEqual(propCenter(sip))
      const lip = rotate({ x: 5, y: 14 }, { x: 0, y: 0 }, headAngle(pose, m))
      expect(distance({ x: drawn.head.x + lip.x, y: drawn.head.y + lip.y }, rim)).toBeLessThan(0.001)
      // The cup's rim remains below both eye centers throughout the recoil.
      for (const x of [-15, 15]) {
        const eye = rotate({ x, y: -7 }, { x: 0, y: 0 }, headAngle(pose, m))
        expect(rim.y - (drawn.head.y + eye.y)).toBeGreaterThan(10)
      }
    }
    expect(Math.max(...tilt)).toBeGreaterThan(14)
    expect(Math.min(...tilt)).toBeLessThan(-5)
    expect(Math.max(...stretch)).toBeGreaterThan(8)
    expect(Math.max(...hipDip)).toBeGreaterThan(5)
    expect(Math.min(...neck)).toBeLessThan(-12)
    expect(Math.max(...tilt.slice(22, 34))).toBeGreaterThan(2)
    expect(Math.min(...tilt.slice(32, 47))).toBeLessThan(-1)
    expect(Math.max(...neck.slice(58, 68))).toBeGreaterThan(1)
    expect(motionAtRest(engine)).toBe(true)
    expect(engine.value).toEqual(stillMotion)
    expect(displayPose(pose, engine.value)).toEqual(pose)
  })

  it('flings a loose, empty wrist; keeps the other hand and frozen frame reproducible', () => {
    const original = initialPose()
    const pose = moveHandle(original, 'left', { x: 133, y: 164 })
    const engine = createMotion()
    tug(engine, 'left', { x: -105, y: 0 }, 30)
    let maximumTravel = 0
    for (let i = 0; i < 18; ++i) {
      advanceMotion(engine, 1 / 60)
      const drawn = displayPose(pose, engine.value)
      maximumTravel = Math.max(maximumTravel, distance(original.right, drawn.right))
      expect(drawn.left).toEqual(pose.left)
    }
    expect(maximumTravel).toBeGreaterThan(20)
    const frozen = structuredClone({ pose, motion: engine.value })
    const viewed = displayPose(pose, engine.value)
    for (let i = 0; i < 110; ++i) advanceMotion(engine, 1 / 60)
    expect(displayPose(frozen.pose, frozen.motion)).toEqual(viewed)
    expect(displayPose(pose, engine.value).right).toEqual(original.right)
  })

  it('leaves slow precision moves quiet and preserves a quick flick after holding still', () => {
    const gentle = createMotion()
    for (let i = 0; i < 80; ++i) {
      tug(gentle, 'right', { x: -1, y: -0.6 }, 16)
      advanceMotion(gentle, 1 / 60)
    }
    expect(gentle.value).toEqual(stillMotion)
    tug(gentle, 'left', { x: 0, y: -120 }, 3000)
    advanceMotion(gentle, 1 / 60)
    expect(gentle.value.body).toBeGreaterThan(5)
  })

  it('moves the pelvis onto the supporting boot after the torso and catches the returning weight', () => {
    const engine = createMotion()
    tug(engine, 'left', { x: 0, y: -155 }, 35)
    const samples = Array.from({ length: 72 }, () => {
      advanceMotion(engine, 1 / 120)
      return { ...engine.value }
    })
    const torsoPeak = Math.max(...samples.map(m => m.body))
    const hipPeak = Math.max(...samples.map(m => m.balance))
    const lag = samples.findIndex(m => m.balance === hipPeak) - samples.findIndex(m => m.body === torsoPeak)
    expect(lag / 120).toBeGreaterThan(0.07)
    expect(hipPeak).toBeGreaterThan(8)
    expect(samples.some(m => m.body < 0 && m.balance > 7)).toBe(true)
    expect(Math.min(...samples.map(m => m.balance))).toBeLessThan(-3)
  })

  it('produces the same trajectory at 30, 60 and 120 Hz and resumes at rest after suspension', () => {
    const trajectories = [30, 60, 120].map(hz => {
      const engine = createMotion()
      tug(engine, 'left', { x: 17, y: -141 }, 42)
      return Array.from({ length: 8 }, () => {
        for (let i = 0; i < hz / 6; ++i) advanceMotion(engine, 1 / hz)
        return { ...engine.value }
      })
    })
    expect(trajectories[0]).toEqual(trajectories[1])
    expect(trajectories[1]).toEqual(trajectories[2])
    const engine = createMotion()
    tug(engine, 'left', { x: -30, y: -100 }, 50)
    advanceMotion(engine, 0.1)
    expect(advanceMotion(engine, 23)).toBe(false)
    expect(engine.value).toEqual(stillMotion)
    expect(engine.speed).toEqual(stillMotion)
    tug(engine, 'right', { x: -100, y: 0 }, 40)
    expect(advanceMotion(engine, 1 / 60)).toBe(true)
  })

  it('replays older saved frames with zero displacement for channels they did not record', () => {
    const p = initialPose()
    const legacy = { body: 7, head: -3 }
    expect(computeRig(p, legacy).matrix).toEqual(computeRig(p, { ...stillMotion, ...legacy }).matrix)
    expect(computeRig(p, legacy).pose).toEqual(displayPose(p, { ...stillMotion, ...legacy }))
    expect(computeRig(p, legacy).motion).toEqual({ ...stillMotion, ...legacy })
  })

  it('uses the same frozen geometry for the actor, soles and hit targets', () => {
    const pose = withProp(initialPose(), 'phone')
    const engine = createMotion()
    tug(engine, 'left', { x: -77, y: 14 }, 45)
    advanceMotion(engine, 0.13)
    const rig = computeRig(pose, engine.value)
    expect(rig.pose).toEqual(displayPose(pose, engine.value))
    expect(rig.matrix).toEqual(bodyMatrix(engine.value))
    expect(rig.point(pivot)).toEqual(bodyPoint(pivot, engine.value))
    expect(rig.propCenter).toEqual(propCenter(rig.pose))
  })

  it('gives a short, fast diagonal shoulder, elbow or knee pull a visible body response on either side', () => {
    for (const grip of ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'] as const) {
      for (const x of [-10, 10]) {
        const engine = createMotion()
        tug(engine, grip, { x, y: -10 }, 44)
        let maxTilt = 0, maxSleeveSwing = 0
        for (let i = 0; i < 35; i++) {
          advanceMotion(engine, 1 / 120)
          maxTilt = Math.max(maxTilt, Math.abs(engine.value.body))
          maxSleeveSwing = Math.max(maxSleeveSwing, Math.abs(engine.value.loose))
        }
        expect(maxTilt).toBeGreaterThan(5)
        expect(maxSleeveSwing).toBeGreaterThan(8)
      }
      const gentle = createMotion()
      tug(gentle, grip, { x: 1, y: 1 }, 24)
      expect(advanceMotion(gentle, 1 / 60)).toBe(false)
    }
  })

  it('gives a large keyboard nudge a restrained reaction', () => {
    const engine = createMotion()
    tug(engine, 'left', { x: 0, y: -12 }, 16)
    let tilt = 0
    for (let i = 0; i < 15; ++i) {
      advanceMotion(engine, 1 / 60)
      tilt = Math.max(tilt, engine.value.body)
    }
    expect(tilt).toBeGreaterThan(1)
    expect(tilt).toBeLessThan(4)
  })

  it('takes over a swinging head near the cup at its current displayed center', () => {
    const sip = moveHandle(withProp(initialPose(), 'cup'), 'right', { x: 269, y: 113 })
    const engine = createMotion()
    tug(engine, 'left', { x: 0, y: -160 }, 30)
    advanceMotion(engine, 0.08)
    const head = displayPose(sip, engine.value).head
    expect(distance(head, sip.head)).toBeGreaterThan(2)
    const held = moveHandle(sip, 'head', head)
    engine.value.head = 0
    engine.speed.head = 0
    for (let i = 0; i < 25; ++i) {
      advanceMotion(engine, 1 / 60, true)
      expect(distance(displayPose(held, engine.value).head, head)).toBeLessThan(0.0001)
    }
  })
})
