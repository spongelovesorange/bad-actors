import { describe, expect, it } from 'vitest'
import { initialPose, phoneSamplePose, restShoulder, solveElbow, distance, type PuppetPose } from '../puppet/geometry'
import { demoFrame, demoLength, demoSpots, demoStill } from './how-to-play'

const elbow = (pose: PuppetPose) => solveElbow(restShoulder('right', pose), pose.right, pose.rightBend)

describe('the silent how-to-play demo', () => {
  it('opens on an untouched actor with the glove on its way in', () => {
    const first = demoFrame(0)
    expect(first.pose).toEqual(initialPose())
    expect(first.step).toBe(0)
    expect(first.hand?.opacity).toBe(0)
    expect(first.critic).toBe('idle')
    expect(first.stamp).toBe(false)
  })

  it('drags the wrist to the ear like a player would, without the elbow jumping', () => {
    let previous = demoFrame(800).pose
    let largest = 0
    for (let t = 800; t <= 2400; t += 16) {
      const { pose, hand, grip } = demoFrame(t)
      largest = Math.max(largest, distance(elbow(previous), elbow(pose)))
      previous = pose
      if (t > 900 && t < 2200) {
        expect(hand?.pressed).toBe(true)
        expect(grip).toEqual(pose.right)
      }
    }
    expect(largest).toBeLessThan(8)
    const atEar = demoFrame(2300).pose
    expect(distance(atEar.right, phoneSamplePose().right)).toBeLessThan(1)
    expect(atEar.rightBend).toBe(phoneSamplePose().rightBend)
  })

  it('taps the phone onto the hand, presses Ready, and Stubbs gets it', () => {
    expect(demoFrame(3200).step).toBe(1)
    expect(demoFrame(3250).hand).toMatchObject({ ...demoSpots.chip, pressed: true })
    expect(demoFrame(3400).pose).toMatchObject({ prop: 'phone', holder: 'right' })
    expect(demoFrame(4300)).toMatchObject({ step: 2, ready: 'pressed', hand: { ...demoSpots.ready, pressed: true } })
    expect(demoFrame(4700)).toMatchObject({ ready: 'looking', critic: 'looking', line: 'Hmm…', stamp: false })
    expect(demoFrame(5500)).toMatchObject({ critic: 'guess', line: 'On the phone!', stamp: false })
    expect(demoFrame(6200)).toMatchObject({ critic: 'hit', line: 'On the phone!', stamp: true, pose: { face: 'smile' } })
    expect(demoFrame(5000).hand).toBeUndefined()
  })

  it('fades out, starts over, and has a still frame that tells the whole story', () => {
    expect(demoFrame(7900).fade).toBeLessThan(1)
    expect(demoFrame(8200)).toMatchObject({ step: 0, chip: false, stamp: false, pose: initialPose() })
    expect(demoFrame(demoLength + 1000)).toEqual(demoFrame(1000))
    expect(demoFrame(demoStill)).toMatchObject({ stamp: true, chip: true, line: 'On the phone!', fade: 1, pose: { prop: 'phone' } })
    expect(demoFrame(demoStill).hand).toBeUndefined()
  })
})
