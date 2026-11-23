export type Point = { x: number; y: number }
export type Hand = 'left' | 'right'
export type Handle = Hand | 'head' | 'prop'
export type PropKind = 'phone' | 'cup' | 'plate'
export type FaceShape = 'smile' | 'flat' | 'open'
type Bend = -1 | 1

export type PuppetPose = {
  left: Point
  right: Point
  head: Point
  leftBend: Bend
  rightBend: Bend
  face: FaceShape
  prop: PropKind | null
  holder: Hand | null
  propPosition: Point
  propTurn: number
}

export const feel = {
  width: 500, height: 360,
  armBone: 65, wristReach: 124, shoulderCrossing: 9,
  headRadius: { x: 25, y: 16 }, headTilt: 20,
  bodyLean: 3.4, headSway: 4.8,
  bodyFrequency: 18, headFrequency: 15, damping: 0.74,
  hitRadiusPx: 24, previewPx: 24, attachPx: 18, detachPx: 6, handoffPx: 7,
}
export const homeHead = { x: 251, y: 99 }
export const shoulders = { left: { x: 225, y: 162 }, right: { x: 276, y: 160 } }
export const pivot = { x: 251, y: 229 }
export const hands: Hand[] = ['left', 'right']
const propOffsets: Record<PropKind, Point> = {
  cup: { x: -14, y: -17 }, phone: { x: 5, y: -24 }, plate: { x: -17, y: -12 },
}

export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export function rotate(point: Point, center: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180
  const c = Math.cos(radians), s = Math.sin(radians)
  const x = point.x - center.x, y = point.y - center.y
  return { x: center.x + x * c - y * s, y: center.y + x * s + y * c }
}
export function initialPose(): PuppetPose {
  return {
    left: { x: 168, y: 181 }, right: { x: 333, y: 136 }, head: { ...homeHead },
    leftBend: -1, rightBend: 1, face: 'smile', prop: null, holder: null,
    propPosition: { x: 341, y: 285 }, propTurn: 0,
  }
}
export function phoneSamplePose(): PuppetPose {
  const p = initialPose()
  p.right = { x: 296, y: 124 }
  p.left = { x: 183, y: 238 }
  p.leftBend = 1
  return withProp(p, 'phone')
}
export function withProp(p: PuppetPose, prop: PropKind | null): PuppetPose {
  return { ...p, prop, holder: prop ? p.holder ?? 'right' : null, propTurn: 0 }
}
export function putDown(p: PuppetPose): PuppetPose {
  if (!p.prop || !p.holder) return p
  return { ...p, holder: null, propPosition: { x: p.holder === 'right' ? 329 : 171, y: 289 } }
}
export const withFace = (p: PuppetPose, face: FaceShape): PuppetPose => ({ ...p, face })
export const turnProp = (p: PuppetPose): PuppetPose => p.prop ? { ...p, propTurn: (p.propTurn + 45) % 360 } : p
export function propOffset(p: PuppetPose): Point {
  return p.prop ? rotate(propOffsets[p.prop], { x: 0, y: 0 }, p.propTurn) : { x: 0, y: 0 }
}
export function propCenter(p: PuppetPose): Point {
  if (!p.holder || !p.prop) return p.propPosition
  const offset = propOffset(p)
  return { x: p[p.holder].x + offset.x, y: p[p.holder].y + offset.y }
}
export function solveElbow(shoulder: Point, hand: Point, bend: Bend): Point {
  const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y
  const d = Math.hypot(dx, dy)
  if (d < 0.00001) return { x: shoulder.x + bend * feel.armBone, y: shoulder.y }
  const along = Math.min(d / 2, feel.armBone)
  const height = Math.sqrt(Math.max(0, feel.armBone ** 2 - along ** 2)) * bend
  return { x: shoulder.x + (dx * along - dy * height) / d, y: shoulder.y + (dy * along + dx * height) / d }
}
function crossesShoulder(a: Point, b: Point, s: Point) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = clamp(((s.x - a.x) * dx + (s.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  return distance(s, { x: a.x + dx * t, y: a.y + dy * t }) < feel.shoulderCrossing
}
export function moveHandle(p: PuppetPose, handle: Handle, target: Point): PuppetPose {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return p
  if (handle === 'prop') {
    return { ...p, holder: null, propPosition: { x: clamp(target.x, 46, feel.width - 46), y: clamp(target.y, 30, feel.height - 30) } }
  }
  if (handle === 'head') {
    const dx = target.x - homeHead.x, dy = target.y - homeHead.y
    const scale = Math.max(1, Math.hypot(dx / feel.headRadius.x, dy / feel.headRadius.y))
    return { ...p, head: { x: homeHead.x + dx / scale, y: homeHead.y + dy / scale } }
  }
  const s = shoulders[handle]
  const length = distance(s, target)
  const scale = Math.max(1, length / feel.wristReach)
  let hand = { x: s.x + (target.x - s.x) / scale, y: s.y + (target.y - s.y) / scale }
  // At a folded shoulder the elbow has no geometric preference. Retain its last direction.
  if (length < 0.08) {
    const last = p[handle], norm = distance(last, s) || 1
    hand = { x: s.x + 0.08 * (last.x - s.x) / norm, y: s.y + 0.08 * (last.y - s.y) / norm }
  }
  const key = handle === 'left' ? 'leftBend' : 'rightBend'
  let bend = p[key]
  if (crossesShoulder(p[handle], hand, s)) {
    const oldElbow = solveElbow(s, p[handle], bend)
    const opposite = bend === 1 ? -1 : 1
    if (distance(oldElbow, solveElbow(s, hand, opposite)) + 1 < distance(oldElbow, solveElbow(s, hand, bend))) bend = opposite
  }
  return { ...p, [handle]: hand, [key]: bend }
}

/** Test the point where the hand grips the object, or the object's center for touch drops. */
export function snapHand(p: PuppetPose, pixelsPerUnit: number, previous: Hand | null, release = false): Hand | null {
  if (!p.prop || p.holder) return null
  const center = propCenter(p), offset = propOffset(p)
  const grip = { x: center.x - offset.x, y: center.y - offset.y }
  const score = (hand: Hand) => Math.min(distance(center, p[hand]), distance(grip, p[hand])) * pixelsPerUnit
  const left = score('left'), right = score('right')
  let next: Hand = left <= right ? 'left' : 'right'
  const limit = release ? feel.attachPx : feel.previewPx
  if (previous && score(previous) <= limit && score(previous) < score(next) + feel.handoffPx) next = previous
  return score(next) <= limit ? next : null
}
