import { footAngle, posedElbow } from './joints'
import { sleeveElbow } from './sleeve'
import { defaultAnkle, legLandmarks } from './legs'
import { clamp, distance, feel, hands, homeHead, pivot, propCenter, restPoint, shoulders, reachableHead, reachableWrist, rotate, type Hand, type Handle, type Joint, type Point, type PuppetPose } from './geometry'

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
}

export const stillMotion: PuppetMotion = { body: 0, head: 0, lift: 0, loose: 0, balance: 0 }
// Older frozen rehearsal frames captured just torso and neck, then added sleeve and stretch.
export type SavedMotion = Pick<PuppetMotion, 'body' | 'head'> & Partial<PuppetMotion>
function currentMotion(m: SavedMotion): PuppetMotion {
  if (Number.isFinite(m.balance)) return m as PuppetMotion
  return {
    body: Number.isFinite(m.body) ? m.body : 0,
    head: Number.isFinite(m.head) ? m.head : 0,
    lift: m.lift || 0, loose: m.loose || 0, balance: 0,
  }
}
export type MotionEngine = { value: PuppetMotion; speed: PuppetMotion; quietTime: number }
const tailSeconds = 1.65
const channels = Object.keys(stillMotion) as (keyof PuppetMotion)[]
export function motionAtRest(e: MotionEngine) { return e.quietTime >= tailSeconds }
export function createMotion(): MotionEngine {
  return { value: { ...stillMotion }, speed: { ...stillMotion }, quietTime: tailSeconds }
}

/** A tug deposits momentum immediately. Pointer-up may precede the next animation frame. */
export function tug(engine: MotionEngine, handle: Handle, delta: Point, milliseconds: number) {
  if (handle === 'prop') return
  const speed = Math.hypot(delta.x, delta.y) / clamp(milliseconds, 6, 64)
  const intensity = clamp((speed - 0.10) / 0.85, 0, 1)
  if (!intensity) return
  const side = handle === 'left' ? -1 : handle === 'right' ? 1 : 0
  const twist = (delta.x + 0.96 * side * delta.y) * intensity
  const up = -delta.y * intensity
  const v = engine.speed
  v.body = clamp(v.body + 4.3 * twist, -365, 365)
  v.lift = clamp(v.lift + 4.0 * up, -330, 370)
  // The head and the empty sleeve initially resist the body's pull.
  if (handle !== 'head') v.head = clamp(v.head - 3.0 * twist, -370, 370)
  v.loose = clamp(v.loose - 7.5 * twist, -660, 660)
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
    advanceSpring(e, 'loose', -e.value.body * 0.95, 12, 0.27, 46, dt)
  }
  e.quietTime += elapsed
  const resting = channels.every(key =>
    Math.abs(e.value[key]) < 0.16 && Math.abs(e.speed[key]) < 2.6)
  return resting ? sleepMotion(e) : true
}

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }
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
export function computeRig(p: PuppetPose, motion: SavedMotion): PuppetRig {
  const m = currentMotion(motion)
  const transform = bodyTransform(m, p)
  const angle = headAngle(p, m)
  const prop = propCenter(p)
  const pose = projectPose(p, m, transform, angle, prop)
  const point = (a: Point) => transformPoint(a, transform)
  const offsets = p.joints
  const add = (a: Point, b?: Point) => b ? { x: a.x + b.x, y: a.y + b.y } : a
  const leftShoulder = add(point(shoulders.left), offsets?.leftShoulder)
  const rightShoulder = add(point(shoulders.right), offsets?.rightShoulder)
  const leftAnkle = add(defaultAnkle('left'), offsets?.leftAnkle)
  const rightAnkle = add(defaultAnkle('right'), offsets?.rightAnkle)
  const leftLeg = legLandmarks('left', point({ x: 229, y: 246 }), leftAnkle, offsets?.leftKnee)
  const rightLeg = legLandmarks('right', point({ x: 277, y: 246 }), rightAnkle, offsets?.rightKnee)
  const tilt = rotate({ x: 29, y: -30 }, origin, angle)
  return {
    footAngle: { left: footAngle(p, 'left'), right: footAngle(p, 'right') },
    joints: {
      waist: point(pivot), chest: point({ x: pivot.x, y: pivot.y - 51 }),
      headTilt: add(pose.head, tilt),
      leftShoulder, rightShoulder,
      leftElbow: posedElbow(sleeveElbow('left', pose, leftShoulder, m), offsets?.leftElbow, leftShoulder, pose.left),
      rightElbow: posedElbow(sleeveElbow('right', pose, rightShoulder, m), offsets?.rightElbow, rightShoulder, pose.right),
      leftAnkle, rightAnkle, leftKnee: leftLeg.knee, rightKnee: rightLeg.knee,
    },
    motion: m, pose, point, matrix: matrixString(transform), headAngle: angle, propCenter: prop,
  }
}
