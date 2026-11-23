import { chestHandle, contactHead, contactTransform, headTiltOffset, type Affine, type Grip } from './contact'
import { footAngle, posedElbow } from './joints'
import { sleeveElbow } from './sleeve'
import { defaultAnkle, legLandmarks } from './legs'
import { clamp, distance, feel, hands, homeHead, pivot, propCenter, restPoint, shoulders, reachableHead, reachableWrist, rotate, type Hand, type StageHandle, type Joint, type Point, type PuppetPose } from './geometry'

export type PuppetMotion = {
  /** Clockwise tilt in degrees. */
  body: number
  /** Additional clockwise neck angle in degrees. */
  head: number
  /** Pulling up lengthens the sack; a negative value compresses it. */
  lift: number
  /** Sideways pendulum travel of any unposed, empty wrist. */
  loose: number
  /** Horizontal shift of the pelvis toward the boot taking the load. */
  balance: number
  /** Independent rocking angle of the object around its fixed grip. */
  prop: number
}

export const stillMotion: PuppetMotion = { body: 0, head: 0, lift: 0, loose: 0, balance: 0, prop: 0 }
// Older frozen rehearsal frames captured just torso and neck, then added sleeve and stretch.
export type SavedMotion = Pick<PuppetMotion, 'body' | 'head'> & Partial<PuppetMotion>
function currentMotion(m: SavedMotion): PuppetMotion {
  if (Number.isFinite(m.prop)) return m as PuppetMotion
  return {
    body: Number.isFinite(m.body) ? m.body : 0,
    head: Number.isFinite(m.head) ? m.head : 0,
    lift: m.lift || 0, loose: m.loose || 0, balance: m.balance || 0, prop: 0,
  }
}
export type MotionEngine = { value: PuppetMotion; speed: PuppetMotion; quietTime: number }
const tailSeconds = 1.65
const channels = Object.keys(stillMotion) as (keyof PuppetMotion)[]
export function motionAtRest(e: MotionEngine) { return e.quietTime >= tailSeconds }
export function createMotion(): MotionEngine {
  return { value: { ...stillMotion }, speed: { ...stillMotion }, quietTime: tailSeconds }
}

// Hands pull the upper trunk; feet and knees transmit their first kick through the hip.
const coupling = {
  wrist: { torque: 4.3, stretch: 4.0, hips: 0, neck: -3, sleeve: -7.5 },
  head: { torque: 8, stretch: 10, hips: 1.6, neck: -2, sleeve: -7 },
  shoulder: { torque: 16.5, stretch: 14, hips: 4, neck: -12, sleeve: -16 },
  elbow: { torque: 13.5, stretch: 10, hips: 3, neck: -10, sleeve: -14 },
  waist: { torque: 7.8, stretch: 9.5, hips: 10, neck: -5, sleeve: -8 },
  chest: { torque: 12, stretch: 5.5, hips: 4, neck: -8.6, sleeve: -9 },
  neck: { torque: 7.3, stretch: 5, hips: 1.5, neck: 11, sleeve: -6.5 },
  knee: { torque: 15, stretch: 12, hips: 15, neck: -10.5, sleeve: -15 },
  ankle: { torque: 7.4, stretch: 7.8, hips: 9, neck: -4.8, sleeve: -8 },
  looseProp: { torque: 1.8, stretch: 1.3, hips: 0.8, neck: 3.5, sleeve: -2.7 },
}
const transmissions: Record<StageHandle, keyof typeof coupling> = {
  left: 'wrist', right: 'wrist', head: 'head', prop: 'looseProp',
  leftShoulder: 'shoulder', rightShoulder: 'shoulder', leftElbow: 'elbow', rightElbow: 'elbow',
  waist: 'waist', chest: 'chest', headTilt: 'neck', leftKnee: 'knee', rightKnee: 'knee',
  leftAnkle: 'ankle', rightAnkle: 'ankle',
}

/** Signed travel in stage units, measured from accepted player input rather than spring motion. */
export function tug(engine: MotionEngine, handle: StageHandle, delta: Point, milliseconds: number, holder: Hand | null = null) {
  const speed = Math.hypot(delta.x, delta.y) / clamp(milliseconds, 6, 64)
  const source = handle === 'prop' && holder ? holder : handle
  const region = transmissions[source]
  const shortLever = region === 'shoulder' || region === 'elbow' || region === 'knee'
  // A fast 12-unit shoulder shrug already spans most of its travel; a hand can travel 124.
  const intensity = clamp((speed - 0.10) / (shortLever ? 0.31 : 0.85), 0, 1)
  if (!intensity) return
  const c = coupling[region]
  const side = source.startsWith('left') ? -1 : source.startsWith('right') ? 1 : 0.46
  const horizontal = delta.x * intensity, vertical = delta.y * intensity
  const pull = 0.96 * side * vertical
  // A straight diagonal still loads the sleeve, even when the two torques oppose.
  const sum = horizontal + pull
  const stronger = Math.abs(horizontal) >= Math.abs(pull) ? horizontal : pull
  const twist = shortLever
    ? Math.sign(stronger) * Math.hypot(horizontal, pull)
    : Math.abs(sum) >= Math.abs(stronger) * 0.30 ? sum : stronger * 0.30
  const v = engine.speed = currentMotion(engine.speed)
  v.body = clamp(v.body + c.torque * twist, -365, 365)
  v.lift = clamp(v.lift - c.stretch * vertical, -330, 370)
  v.balance = clamp(v.balance + c.hips * (horizontal + 0.60 * pull), -260, 260)
  v.head = clamp(v.head + c.neck * twist, -370, 370)
  v.loose = clamp(v.loose + c.sleeve * twist, -660, 660)
  if (handle === 'prop') {
    // Unlike a hinged shoulder, an object rocking in midair has no opposing joint torque.
    const rollDirection = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical
    const swing = Math.sign(rollDirection) * Math.hypot(horizontal, vertical)
    v.prop = clamp(v.prop - 7.6 * swing, -270, 270)
  }
  engine.quietTime = 0
}

function advanceSpring(e: MotionEngine, key: keyof PuppetMotion, goal: number, omega: number, damping: number, limit: number, dt: number) {
  const position = e.value[key]
  const acceleration = omega * omega * (goal - position) - 2 * omega * damping * e.speed[key]
  const velocity = e.speed[key] + acceleration * dt
  const next = position + velocity * dt
  e.value[key] = clamp(next, -limit, limit)
  e.speed[key] = next === e.value[key] ? velocity : 0
  return acceleration
}

function sleepMotion(e: MotionEngine) {
  Object.assign(e.value, stillMotion)
  Object.assign(e.speed, stillMotion)
  e.quietTime = tailSeconds
  return false
}

/** The head has a lower natural frequency than the torso. Feet and authored grips never enter these springs. */
export function advanceMotion(e: MotionEngine, seconds: number, holdHead = false): boolean {
  if (motionAtRest(e)) return false
  e.value = currentMotion(e.value)
  e.speed = currentMotion(e.speed)
  const elapsed = Math.max(seconds, 0)
  // A suspended view resumes at rest. Below that cutoff, integrate the actual
  // time gap so a slow display and a fast display reach the same pose.
  if (e.quietTime + elapsed >= tailSeconds) return sleepMotion(e)
  const steps = Math.max(1, Math.ceil(elapsed * 120))
  const dt = elapsed / steps
  for (let i = 0; i < steps; ++i) {
    const torsoAcceleration = advanceSpring(e, 'body', 0, 16, 0.19, feel.bodyLean, dt)
    advanceSpring(e, 'lift', 0, 18, 0.23, 17, dt)
    // The belly goes first. The hips arrive over the supporting boot a beat later.
    advanceSpring(e, 'balance', e.value.body * 0.93, 11.5, 0.44, 17, dt)
    if (!holdHead) {
      const neckGoal = e.value.body * 0.81 - torsoAcceleration * 0.0010
      advanceSpring(e, 'head', neckGoal, 12.5, 0.24, feel.headSway, dt)
    }
    if (e.value.prop || e.speed.prop) advanceSpring(e, 'prop', 0, 14.5, 0.29, 21, dt)
    advanceSpring(e, 'loose', -e.value.body * 0.95, 12, 0.27, 46, dt)
  }
  e.quietTime += elapsed
  const resting = channels.every(key =>
    Math.abs(e.value[key]) < 0.16 && Math.abs(e.speed[key]) < 2.6)
  return resting ? sleepMotion(e) : true
}

const identity: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function bodyTransform(m: PuppetMotion, pose?: PuppetPose): Affine {
  const torsoTurn = m.body + (pose?.joints?.chest?.x ?? 0)
  const waist = pose?.joints?.waist
  if (!torsoTurn && !m.lift && !m.balance && !waist) return identity
  const angle = torsoTurn * Math.PI / 180
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const sx = 1 - m.lift * 0.004
  const sy = 1 + m.lift * 0.010 + Math.abs(m.body) * 0.002
  const a = sx * cos, b = sx * sin, c = -sy * sin, d = sy * cos
  const dip = Math.abs(m.body) * 0.24 + Math.abs(m.lift) * 0.27 - m.lift * 0.10 + Math.abs(m.balance) * 0.27
  return {
    a, b, c, d,
    e: pivot.x + (waist?.x ?? 0) + m.body * 0.10 + m.balance - a * pivot.x - c * pivot.y,
    f: pivot.y + (waist?.y ?? 0) + dip - b * pivot.x - d * pivot.y,
  }
}
function transformPoint(p: Point, t: Affine): Point {
  return { x: t.a * p.x + t.c * p.y + t.e, y: t.b * p.x + t.d * p.y + t.f }
}
function matrixString(t: Affine) {
  return `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.e} ${t.f})`
}
export function bodyPoint(p: Point, m: SavedMotion): Point { return transformPoint(p, bodyTransform(currentMotion(m))) }
export function bodyMatrix(m: SavedMotion): string { return matrixString(bodyTransform(currentMotion(m))) }

export function headAngle(p: PuppetPose, m: PuppetMotion) {
  const neutral = p.pinned?.head ? restPoint(homeHead, p) : homeHead
  return (p.head.x - neutral.x) / feel.headRadius.x * feel.headTilt + (p.joints?.headTilt?.x ?? 0)
    + (p.joints?.chest?.x ?? 0) * 0.55 + m.head
}
const mouth = { x: 5, y: 14 }
const origin = { x: 0, y: 0 }

export function cupRim(p: PuppetPose, center = propCenter(p)): Point {
  const rim = rotate({ x: p.holder === 'left' ? 1 : -1, y: -7 }, origin, p.propTurn)
  return { x: center.x + rim.x, y: center.y + rim.y }
}

function projectPose(p: PuppetPose, m: PuppetMotion, t: Affine, angle: number, prop: Point): PuppetPose {
  if (t === identity && !m.head && !m.loose) return p
  const drawn = { ...p }
  const headFree = !!p.pinned && !p.pinned.head
  const baseHead = headFree ? restPoint(p.head, p) : p.head
  let sip = 0, mouthOffsetX = 0, mouthOffsetY = 0
  if (p.prop === 'cup' && p.holder) {
    const baseMouth = rotate(mouth, origin, angle - m.head)
    const mouthPosition = { x: baseHead.x + baseMouth.x, y: baseHead.y + baseMouth.y }
    sip = 1 - clamp((distance(cupRim(p, prop), mouthPosition) - 14) / 12, 0, 1)
    if (sip) {
      const turned = rotate(mouth, origin, angle)
      mouthOffsetX = (baseMouth.x - turned.x) * sip
      mouthOffsetY = (baseMouth.y - turned.y) * sip
    }
  }
  const follow = headFree ? 1 - sip : 0
  const neck = follow ? transformPoint(p.head, t) : baseHead
  drawn.head = reachableHead({
    x: baseHead.x + (neck.x - baseHead.x) * 0.51 * follow + mouthOffsetX,
    y: baseHead.y + (neck.y - baseHead.y) * 0.53 * follow + mouthOffsetY,
  }, p)
  for (const hand of hands) {
    if (!p.pinned || p.pinned[hand] || p.holder === hand) continue
    const baseHand = restPoint(p[hand], p)
    const anchor = transformPoint(p[hand], t)
    drawn[hand] = reachableWrist({
      x: baseHand.x + (anchor.x - baseHand.x) * 0.40 + m.loose * 0.84,
      // A swinging loose mitten rises on an arc and hangs low again at rest.
      y: baseHand.y + (anchor.y - baseHand.y) * 0.45 - Math.abs(m.loose) * 0.34 + m.lift * 0.42,
    }, hand, p)
  }
  return drawn
}

export function displayPose(p: PuppetPose, motion: SavedMotion): PuppetPose {
  const m = currentMotion(motion)
  return projectPose(p, m, bodyTransform(m, p), headAngle(p, m), propCenter(p))
}

export type PuppetRig = {
  propAngle: number
  footAngle: Record<Hand, number>
  joints: Record<Joint, Point>
  motion: PuppetMotion
  pose: PuppetPose
  point: (p: Point) => Point
  matrix: string
  headAngle: number
  propCenter: Point
}

/** One frame of geometry is shared by the painted body, all limbs and the pointer hit targets. */
export function computeRig(p: PuppetPose, motion: SavedMotion, grip?: Grip): PuppetRig {
  const m = currentMotion(motion)
  const transform = contactTransform(bodyTransform(m, p), grip)
  const angle = headAngle(p, m)
  const prop = propCenter(p)
  const { pose } = contactHead(projectPose(p, m, transform, angle, prop), angle, grip)
  const point = (a: Point) => transformPoint(a, transform)
  const offsets = p.joints
  const add = (a: Point, b?: Point) => b ? { x: a.x + b.x, y: a.y + b.y } : a
  const pin = (handle: StageHandle, natural: Point) => {
    if (grip?.handle !== handle) return natural
    const amount = grip.strength ?? 1
    return { x: natural.x + (grip.point.x - natural.x) * amount, y: natural.y + (grip.point.y - natural.y) * amount }
  }
  const leftShoulder = pin('leftShoulder', add(point(shoulders.left), offsets?.leftShoulder))
  const rightShoulder = pin('rightShoulder', add(point(shoulders.right), offsets?.rightShoulder))
  const leftAnkle = add(defaultAnkle('left'), offsets?.leftAnkle)
  const rightAnkle = add(defaultAnkle('right'), offsets?.rightAnkle)
  const leftLeg = legLandmarks('left', point({ x: 229, y: 246 }), leftAnkle, offsets?.leftKnee)
  const rightLeg = legLandmarks('right', point({ x: 277, y: 246 }), rightAnkle, offsets?.rightKnee)
  const tilt = rotate(headTiltOffset, origin, angle)
  return {
    // A caught object seats against the palm. A loose one can rock about its own center.
    propAngle: p.propTurn + (p.holder ? 0 : m.prop),
    footAngle: { left: footAngle(p, 'left'), right: footAngle(p, 'right') },
    joints: {
      waist: point(pivot), chest: point(chestHandle),
      headTilt: add(pose.head, tilt),
      leftShoulder, rightShoulder,
      leftElbow: pin('leftElbow', posedElbow(sleeveElbow('left', pose, leftShoulder, m), offsets?.leftElbow, leftShoulder, pose.left)),
      rightElbow: pin('rightElbow', posedElbow(sleeveElbow('right', pose, rightShoulder, m), offsets?.rightElbow, rightShoulder, pose.right)),
      leftAnkle, rightAnkle, leftKnee: pin('leftKnee', leftLeg.knee), rightKnee: pin('rightKnee', rightLeg.knee),
    },
    motion: m, pose, point, matrix: matrixString(transform), headAngle: angle, propCenter: prop,
  }
}
