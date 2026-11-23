import { describe, expect, it } from 'vitest'
import { distance, initialPose, moveHandle, shoulders, type Hand } from './geometry'
import { advanceMotion, bodyPoint, createMotion, displayPose, tug } from './motion'
import { sleeveElbow } from './sleeve'

describe('folded sleeve', () => {
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
