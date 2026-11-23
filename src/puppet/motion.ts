import { clamp, distance, feel, homeHead, pivot, propCenter, reachableHead, reachableWrist, rotate, type Handle, type Point, type PuppetPose } from './geometry'

export type PuppetMotion = {
  /** Clockwise tilt in degrees. */
  body: number
  /** Additional clockwise neck angle in degrees. */
  head: number
  /** Pulling up lengthens the sack; a negative value compresses it. */
  lift: number
  /** Sideways pendulum travel of any unposed, empty wrist. */
  loose: number
}

export const stillMotion: PuppetMotion = { body: 0, head: 0, lift: 0, loose: 0 }
export type MotionEngine = { value: PuppetMotion; speed: PuppetMotion; quietTime: number }
const tailSeconds = 1.65
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
}

/** The head has a lower natural frequency than the torso. Feet and authored grips never enter these springs. */
export function advanceMotion(e: MotionEngine, seconds: number, holdHead = false): boolean {
  if (motionAtRest(e)) return false
  const elapsed = Math.min(Math.max(seconds, 0), 0.12)
  const steps = Math.max(1, Math.ceil(elapsed * 240))
  const dt = elapsed / steps
  for (let i = 0; i < steps; ++i) {
    advanceSpring(e, 'body', 0, 16, 0.19, feel.bodyLean, dt)
    advanceSpring(e, 'lift', 0, 18, 0.23, 17, dt)
    if (!holdHead) advanceSpring(e, 'head', e.value.body * 0.81, 12.5, 0.24, feel.headSway, dt)
    advanceSpring(e, 'loose', -e.value.body * 0.95, 12, 0.27, 46, dt)
  }
  e.quietTime += elapsed
  const resting = (Object.keys(stillMotion) as (keyof PuppetMotion)[]).every(key =>
    Math.abs(e.value[key]) < 0.16 && Math.abs(e.speed[key]) < 2.6)
  if (resting || motionAtRest(e)) {
    Object.assign(e.value, stillMotion)
    Object.assign(e.speed, stillMotion)
    e.quietTime = tailSeconds
    return false
  }
  return true
}

function bodyTransform(m: PuppetMotion) {
  const angle = m.body * Math.PI / 180
  const sx = 1 - m.lift * 0.004
  const sy = 1 + m.lift * 0.010 + Math.abs(m.body) * 0.002
  const a = sx * Math.cos(angle), b = sx * Math.sin(angle)
  const c = -sy * Math.sin(angle), d = sy * Math.cos(angle)
  return {
    a, b, c, d,
    e: pivot.x + m.body * 0.33 - a * pivot.x - c * pivot.y,
    f: pivot.y + Math.abs(m.body) * 0.24 + Math.abs(m.lift) * 0.27 - m.lift * 0.10 - b * pivot.x - d * pivot.y,
  }
}
export function bodyPoint(p: Point, m: PuppetMotion): Point {
  const { a, b, c, d, e, f } = bodyTransform(m)
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }
}
export function bodyMatrix(m: PuppetMotion): string {
  const { a, b, c, d, e, f } = bodyTransform(m)
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`
}

export function headAngle(p: PuppetPose, m: PuppetMotion) {
  return (p.head.x - homeHead.x) / feel.headRadius.x * feel.headTilt + m.head
}
const mouth = { x: 5, y: 14 }
const origin = { x: 0, y: 0 }

export function cupRim(p: PuppetPose): Point {
  const center = propCenter(p)
  const rim = rotate({ x: p.holder === 'left' ? 1 : -1, y: -7 }, origin, p.propTurn)
  return { x: center.x + rim.x, y: center.y + rim.y }
}

export function displayPose(p: PuppetPose, m: PuppetMotion): PuppetPose {
  if (!m.body && !m.head && !m.loose && !m.lift) return p
  const drawn = { ...p }
  const baseMouth = rotate(mouth, origin, headAngle(p, stillMotion))
  const mouthPosition = { x: p.head.x + baseMouth.x, y: p.head.y + baseMouth.y }
  const sipping = p.prop === 'cup' && p.holder
    ? 1 - clamp((distance(cupRim(p), mouthPosition) - 14) / 12, 0, 1)
    : 0
  const neck = bodyPoint(p.head, m)
  const rotatedMouth = rotate(mouth, origin, headAngle(p, m))
  const freeHead = p.pinned && !p.pinned.head ? 1 : 0
  drawn.head = reachableHead({
    x: p.head.x + (neck.x - p.head.x) * 0.51 * freeHead * (1 - sipping) + (baseMouth.x - rotatedMouth.x) * sipping,
    y: p.head.y + (neck.y - p.head.y) * 0.53 * freeHead * (1 - sipping) + (baseMouth.y - rotatedMouth.y) * sipping,
  })
  for (const hand of ['left', 'right'] as const) {
    if (!p.pinned || p.pinned[hand] || p.holder === hand) continue
    const anchor = bodyPoint(p[hand], m)
    drawn[hand] = reachableWrist({
      x: p[hand].x + (anchor.x - p[hand].x) * 0.40 + m.loose * 0.84,
      // A swinging loose mitten rises on an arc and hangs low again at rest.
      y: p[hand].y + (anchor.y - p[hand].y) * 0.45 - Math.abs(m.loose) * 0.34 + m.lift * 0.42,
    }, hand)
  }
  return drawn
}
