import { describe, expect, it } from 'vitest'
import { distance, initialPose, moveHandle, shoulders, withProp, type Hand } from './geometry'
import { advanceMotion, bodyPoint, createMotion, displayPose, tug } from './motion'
import { sleeveElbow } from './sleeve'

describe('folded sleeve', () => {
  it.each(['left', 'right'] as Hand[])('keeps the raised %s sleeve and the drinking elbow on opposite sides of the face', (raised) => {
    const drinking: Hand = raised === 'left' ? 'right' : 'left'
    const outward = raised === 'left' ? -1 : 1
    const cup = { ...withProp(initialPose(), 'cup'), holder: drinking }
    const sip = moveHandle(cup, drinking, { x: 256 - outward * 13, y: 113 })
    const pose = moveHandle(sip, raised, { x: 251 + outward * 75, y: 59 })
    const engine = createMotion()
    tug(engine, raised, { x: 0, y: -158 }, 18)
    for (let frame = 0; frame < 104; frame++) {
      const visible = displayPose(pose, engine.value)
      const raisedShoulder = bodyPoint(shoulders[raised], engine.value)
      const drinkingShoulder = bodyPoint(shoulders[drinking], engine.value)
      const highElbow = sleeveElbow(raised, visible, raisedShoulder, engine.value)
      const cupElbow = sleeveElbow(drinking, visible, drinkingShoulder, engine.value)
      // Both elbows stay outside the face and each forearm returns to its own hand.
      expect((highElbow.x - visible.head.x) * outward).toBeGreaterThan(50)
      expect((cupElbow.x - visible.head.x) * -outward).toBeGreaterThan(50)
      expect(visible[raised]).toEqual(pose[raised])
      expect(visible[drinking]).toEqual(pose[drinking])
      advanceMotion(engine, 0.016)
    }
  })

  it.each(['left', 'right'] as Hand[])('keeps the %s elbow continuous as its shoulder crosses a parked palm', (side) => {
    const opposite = side === 'left' ? 'right' : 'left'
    const parked = { x: shoulders[side].x + (side === 'left' ? 5 : -5), y: shoulders[side].y }
    const pose = moveHandle(initialPose(), side, parked)
    const engine = createMotion()
    let lastElbow = sleeveElbow(side, pose, shoulders[side], engine.value)
    let peakTravel = 0
    let nearestPass = Infinity
    tug(engine, opposite, { x: 0, y: -110 }, 18)
    for (let frame = 0; frame < 103; frame++) {
      advanceMotion(engine, 0.016)
      const visible = displayPose(pose, engine.value)
      const shoulder = bodyPoint(shoulders[side], engine.value)
      const elbow = sleeveElbow(side, visible, shoulder, engine.value)
      expect(visible[side]).toEqual(parked)
      nearestPass = Math.min(nearestPass, distance(shoulder, parked))
      peakTravel = Math.max(peakTravel, distance(lastElbow, elbow))
      lastElbow = elbow
    }
    expect(nearestPass).toBeLessThan(3)
    expect(peakTravel).toBeLessThan(30)
  })
})
