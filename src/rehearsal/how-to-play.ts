import {
  dragHandle, initialPose, phoneSamplePose, restShoulder, solveElbow, withFace, withProp, type Point, type PuppetPose,
} from '../puppet/geometry'
import type { CriticMood } from './AudienceCritic'

/**
 * The silent how-to-play loop, written as a pure function of time so the dialog, reduced motion and
 * the tests all read one script. Like the hand demos at the start of a party game, a white glove
 * drags the real puppet, taps a prop and presses Ready, then Stubbs guesses.
 *
 * Screen positions are percentages of the demo box: the 500 × 360 stage with a 70-unit tray below.
 */
export const demoLength = 8400
const boxHeight = 430
export const demoSpots = {
  /** The Phone chip and the Ready button. The stylesheet places them on these centres. */
  chip: { x: 10.5, y: 91.6 },
  ready: { x: 80, y: 91.6 },
  enter: { x: 96, y: 66 },
  leave: { x: 97, y: 72 },
}
/** A moment late in the loop that shows the whole story at once, for reduced motion. */
export const demoStill = 6800

export type DemoStep = 0 | 1 | 2
export type DemoFrame = {
  /** The caption to light: drag, prop, Ready. */
  step: DemoStep
  pose: PuppetPose
  hand?: Point & { opacity: number; pressed: boolean }
  /** A ring that spreads from the last tap; age runs from 0 to 1. */
  tap?: Point & { age: number }
  /** How much of the wrist's path to draw, from 0 to 1. */
  trail: number
  /** The wrist is held: draw the grab ring there. */
  grip?: Point
  chip: boolean
  ready: 'idle' | 'pressed' | 'looking'
  critic: CriticMood
  line?: string
  stamp: boolean
  /** The whole picture fades out at the end of a loop and back in at the start. */
  fade: number
}

// The elbow stays out to the side while the forearm swings the hand from the hip up to the ear,
// the way a phone is raised. That swing passes over the shoulder, where the elbow can change
// sides without moving, so the drag below turns it outward just as a player's drag would.
const hip = initialPose(), ear = phoneSamplePose()
const elbowFrom = solveElbow(restShoulder('right', hip), hip.right, hip.rightBend)
const elbowTo = solveElbow(restShoulder('right', ear), ear.right, ear.rightBend)
const swingFrom = Math.atan2(hip.right.y - elbowFrom.y, hip.right.x - elbowFrom.x)
const swingTo = Math.atan2(ear.right.y - elbowTo.y, ear.right.x - elbowTo.x) + 2 * Math.PI
export function wristPath(s: number): Point {
  const angle = swingFrom + (swingTo - swingFrom) * s
  const reach = Math.hypot(hip.right.x - elbowFrom.x, hip.right.y - elbowFrom.y) * (1 - s)
    + Math.hypot(ear.right.x - elbowTo.x, ear.right.y - elbowTo.y) * s
  return {
    x: elbowFrom.x + (elbowTo.x - elbowFrom.x) * s + Math.cos(angle) * reach,
    y: elbowFrom.y + (elbowTo.y - elbowFrom.y) * s + Math.sin(angle) * reach,
  }
}

type Script = { drag: PuppetPose[]; held: PuppetPose; beaming: PuppetPose }
let script: Script | undefined
/** Every pose is made once, by the same drag the stage uses, so React sees stable objects. */
function poses(): Script {
  if (script) return script
  const drag = [initialPose()]
  const shoulder = restShoulder('right', drag[0])
  for (let i = 1; i <= 96; i++) {
    const target = wristPath(i / 96)
    // Right on the shoulder the elbow has no preferred side, so the drag steps across that point.
    const near = Math.hypot(target.x - shoulder.x, target.y - shoulder.y) < 3
    drag.push(near ? drag[i - 1] : dragHandle(drag[i - 1], 'right', target))
  }
  const held = withProp(drag[drag.length - 1], 'phone')
  script = { drag, held, beaming: withFace(held, 'smile') }
  return script
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const ease = (n: number) => { const t = clamp01(n); return t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2 }
const between = (t: number, start: number, end: number) => clamp01((t - start) / (end - start))
const lerp = (a: Point, b: Point, n: number) => ({ x: a.x + (b.x - a.x) * n, y: a.y + (b.y - a.y) * n })
const onScreen = (p: Point) => ({ x: p.x / 5, y: p.y / (boxHeight / 100) })

export function demoFrame(time: number): DemoFrame {
  const t = ((time % demoLength) + demoLength) % demoLength
  const { drag, held, beaming } = poses()
  const rest = drag[0]
  if (t >= 8050) {
    // The next loop begins on an untouched actor.
    return { step: 0, pose: rest, trail: 0, chip: false, ready: 'idle', critic: 'idle', stamp: false, fade: between(t, 8050, demoLength) }
  }
  const progress = ease(between(t, 850, 2250))
  const dragged = drag[Math.round(progress * (drag.length - 1))]
  let pose = t < 850 ? rest : dragged
  if (t >= 3200) pose = t >= 5900 ? beaming : held

  const { chip, ready, enter, leave } = demoSpots
  const start = onScreen(rest.right), end = onScreen(drag[drag.length - 1].right)
  let hand: DemoFrame['hand']
  if (t < 650) hand = { ...lerp(enter, start, ease(t / 650)), opacity: between(t, 0, 250), pressed: false }
  else if (t < 850) hand = { ...start, opacity: 1, pressed: true }
  else if (t < 2250) hand = { ...onScreen(dragged.right), opacity: 1, pressed: true }
  else if (t < 2400) hand = { ...end, opacity: 1, pressed: false }
  else if (t < 3150) hand = { ...lerp(end, chip, ease(between(t, 2400, 3150))), opacity: 1, pressed: false }
  else if (t < 3500) hand = { ...chip, opacity: 1, pressed: t < 3350 }
  else if (t < 4200) hand = { ...lerp(chip, ready, ease(between(t, 3500, 4200))), opacity: 1, pressed: false }
  else if (t < 4400) hand = { ...ready, opacity: 1, pressed: true }
  else if (t < 4800) {
    const n = between(t, 4400, 4800)
    hand = { ...lerp(ready, leave, ease(n)), opacity: 1 - n, pressed: false }
  }

  const tapAt = [{ at: 650, spot: start }, { at: 3150, spot: chip }, { at: 4200, spot: ready }]
    .find(entry => t >= entry.at && t < entry.at + 500)
  const critic: CriticMood = t < 4400 ? 'idle' : t < 5200 ? 'looking' : t < 5900 ? 'guess' : 'hit'
  return {
    step: t < 2400 ? 0 : t < 3500 ? 1 : 2,
    pose,
    hand,
    tap: tapAt && { ...tapAt.spot, age: (t - tapAt.at) / 500 },
    trail: t >= 850 && t < 3500 ? progress : 0,
    grip: t >= 650 && t < 2250 ? (t < 850 ? rest.right : dragged.right) : undefined,
    chip: t >= 3200,
    ready: t >= 4200 && t < 4400 ? 'pressed' : t >= 4400 && t < 5200 ? 'looking' : 'idle',
    critic,
    line: critic === 'looking' ? 'Hmm…' : critic === 'guess' || critic === 'hit' ? 'On the phone!' : undefined,
    stamp: t >= 5900,
    fade: t < 7700 ? 1 : 1 - between(t, 7700, 8050),
  }
}
