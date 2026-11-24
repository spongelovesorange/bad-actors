import { describe, expect, it } from 'vitest'
import { initialPose, phoneSamplePose, restShoulder, solveElbow, distance, type PuppetPose } from '../puppet/geometry'
import { demoFrame, demoLength, demoSpots, demoStill } from './how-to-play'

const elbow = (pose: PuppetPose) => solveElbow(restShoulder('right', pose), pose.right, pose.rightBend)
/** The glove's round starts once the curtain is up. */
const intro = 1800

describe('the silent how-to-play demo', () => {
  it('opens like the game: the cue comes down on the closed curtain, then the curtain parts on an untouched actor', () => {
    const first = demoFrame(0)
    expect(first).toMatchObject({ step: 0, curtain: 0, pose: initialPose(), critic: 'idle', stamp: false })
    expect(first.sign).toBeCloseTo(1)
    expect(first.hand).toBeUndefined()
    expect(demoFrame(900)).toMatchObject({ step: 0, curtain: 0, sign: 0 })
    expect(demoFrame(1600).curtain).toBeGreaterThan(0)
    const glove = demoFrame(intro)
    expect(glove).toMatchObject({ step: 1, sign: 1, pose: initialPose() })
    expect(glove.curtain).toBeGreaterThan(.5)
    expect(glove.hand?.opacity).toBe(0)
  })

  it('moves the curtain and the board without a jump, all the way round the loop', () => {
    let previous = demoFrame(0)
    for (let t = 16; t <= demoLength; t += 16) {
      const frame = demoFrame(t)
      expect(Math.abs(frame.curtain - previous.curtain), 'curtain at ' + t).toBeLessThan(.15)
      expect(Math.abs(frame.sign - previous.sign), 'board at ' + t).toBeLessThan(.2)
      previous = frame
    }
  })

  it('drags the wrist to the ear like a player would, without the elbow jumping', () => {
    let previous = demoFrame(intro + 800).pose
    let largest = 0
    for (let t = intro + 800; t <= intro + 2400; t += 16) {
      const { pose, hand, grip } = demoFrame(t)
      largest = Math.max(largest, distance(elbow(previous), elbow(pose)))
      previous = pose
      if (t > intro + 900 && t < intro + 2200) {
        expect(hand?.pressed).toBe(true)
        expect(grip).toEqual(pose.right)
      }
    }
    expect(largest).toBeLessThan(8)
    const atEar = demoFrame(intro + 2300).pose
    expect(distance(atEar.right, phoneSamplePose().right)).toBeLessThan(1)
    expect(atEar.rightBend).toBe(phoneSamplePose().rightBend)
  })

  it('taps the phone onto the hand, presses Ready, and Stubbs gets it', () => {
    expect(demoFrame(intro + 3200).step).toBe(2)
    expect(demoFrame(intro + 3250).hand).toMatchObject({ ...demoSpots.chip, pressed: true })
    expect(demoFrame(intro + 3400).pose).toMatchObject({ prop: 'phone', holder: 'right' })
    expect(demoFrame(intro + 4300)).toMatchObject({ step: 3, ready: 'pressed', hand: { ...demoSpots.ready, pressed: true } })
    expect(demoFrame(intro + 4700)).toMatchObject({ ready: 'looking', critic: 'looking', line: 'Hmm…', stamp: false })
    expect(demoFrame(intro + 5500)).toMatchObject({ critic: 'guess', line: 'On the phone!', stamp: false })
    expect(demoFrame(intro + 6200)).toMatchObject({ critic: 'hit', line: 'On the phone!', stamp: true, pose: { face: 'smile' } })
    expect(demoFrame(intro + 5000).hand).toBeUndefined()
  })

  it('closes the curtain on the scene, starts over, and has a still frame that tells the whole story', () => {
    const closing = demoFrame(9700)
    expect(closing.curtain).toBeGreaterThan(0)
    expect(closing.curtain).toBeLessThan(1)
    expect(demoFrame(demoLength - 10)).toMatchObject({ curtain: 0, sign: 1 })
    expect(demoFrame(demoLength + 1000)).toEqual(demoFrame(1000))
    expect(demoFrame(demoStill)).toMatchObject({ stamp: true, chip: true, line: 'On the phone!', curtain: 1, pose: { prop: 'phone' } })
    expect(demoFrame(demoStill).hand).toBeUndefined()
  })
})
