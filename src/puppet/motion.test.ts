import { describe, expect, it } from 'vitest'
import {
  distance, initialPose, moveHandle, pivot, propCenter, rotate, shoulders, withProp,
} from './geometry'
import {
  advanceMotion, bodyPoint, createMotion, cupRim, displayPose, headAngle, motionAtRest, stillMotion, tug,
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
