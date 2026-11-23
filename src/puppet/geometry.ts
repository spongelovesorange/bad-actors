export type Point = { x: number; y: number }
export type Hand = 'left' | 'right'
export type HandShape = 'relaxed' | 'open' | 'fist' | 'peace'
export type Handle = Hand | 'head' | 'prop'
export type Joint = 'leftShoulder' | 'rightShoulder' | 'leftElbow' | 'rightElbow' |
  'waist' | 'chest' | 'headTilt' | 'leftKnee' | 'rightKnee' | 'leftAnkle' | 'rightAnkle'
export type StageHandle = Handle | Joint
export const stageHandles: StageHandle[] = [
  'head', 'left', 'right', 'prop', 'headTilt', 'leftShoulder', 'rightShoulder',
  'leftElbow', 'rightElbow', 'chest', 'waist', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle',
]
export function isJoint(h: StageHandle): h is Joint {
  return h !== 'head' && h !== 'prop' && h !== 'left' && h !== 'right'
}
export type PropKind = 'phone' | 'cup' | 'plate'
export type FaceShape = 'flat' | 'side-eye' | 'braced' | 'smile' | 'open'
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
  // An untouched wrist hangs loose. A palm placed by the actor keeps its stage position.
  pinned?: Partial<Record<Hand | 'head', boolean>>
  // Stage-space offsets. Chest and neck store their signed rotation in x, in degrees.
  joints?: Partial<Record<Joint, Point>>
  footTurns?: Partial<Record<Hand, number>>
  handShapes?: Partial<Record<Hand, HandShape>>
}

export const feel = {
  width: 500, height: 360,
  armBone: 80, wristReach: 124, shoulderCrossing: 9,
  headRadius: { x: 25, y: 16 }, headTilt: 20,
  bodyLean: 16, headSway: 28,
  hitRadiusPx: 24, previewPx: 24, attachPx: 18, handoffPx: 7,
}
export const homeHead = { x: 251, y: 99 }
export const shoulders = { left: { x: 225, y: 162 }, right: { x: 276, y: 160 } }
export const pivot = { x: 251, y: 229 }
export const hands: Hand[] = ['left', 'right']
const propOffsets: Record<PropKind, Point> = {
  cup: { x: -12, y: 7 }, phone: { x: 5, y: -24 }, plate: { x: -27, y: -12 },
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
    left: { x: 177, y: 267 }, right: { x: 326, y: 262 }, head: { ...homeHead },
    leftBend: 1, rightBend: -1, pinned: {}, face: 'flat', prop: null, holder: null,
    propPosition: { x: 341, y: 285 }, propTurn: 0,
  }
}
export function phoneSamplePose(): PuppetPose {
  const p = initialPose()
  p.right = { x: 296, y: 124 }
  p.left = { x: 177, y: 267 }
  p.leftBend = 1
  p.rightBend = 1
  return withProp(p, 'phone')
}
export function withProp(p: PuppetPose, prop: PropKind | null): PuppetPose {
  return { ...p, prop, holder: prop ? p.holder ?? 'right' : null, propTurn: 0 }
}
export function putDown(p: PuppetPose): PuppetPose {
  if (!p.prop || !p.holder) return p
  return { ...p, holder: null, propPosition: { x: p.holder === 'right' ? 329 : 171, y: 289 } }
}
export const handShape = (p: PuppetPose, hand: Hand): HandShape => p.handShapes?.[hand] ?? 'relaxed'
export function withHandShape(p: PuppetPose, hand: Hand, shape: HandShape): PuppetPose {
  if (handShape(p, hand) === shape) return p
  return { ...p, handShapes: { ...p.handShapes, [hand]: shape } }
}
export const withFace = (p: PuppetPose, face: FaceShape): PuppetPose => ({ ...p, face })
export const turnProp = (p: PuppetPose): PuppetPose => p.prop ? { ...p, propTurn: (p.propTurn + 45) % 360 } : p
export function propOffset(p: PuppetPose, hand = p.holder): Point {
  if (!p.prop) return { x: 0, y: 0 }
  const offset = propOffsets[p.prop]
  const x = p.prop !== 'phone' && hand === 'left' ? -offset.x : offset.x
  return rotate({ x, y: offset.y }, { x: 0, y: 0 }, p.propTurn)
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
function pin(p: PuppetPose, handle: Hand | 'head') {
  // Earlier saved poses did not distinguish loose from deliberately placed hands.
  return { ...(p.pinned ?? { left: true, right: true, head: true }), [handle]: true }
}
export function restPoint(point: Point, p?: PuppetPose): Point {
  const waist = p?.joints?.waist, turn = p?.joints?.chest?.x
  if (!waist && !turn) return point
  const turned = turn ? rotate(point, pivot, turn) : point
  return { x: turned.x + (waist?.x ?? 0), y: turned.y + (waist?.y ?? 0) }
}
export function restShoulder(hand: Hand, p?: PuppetPose): Point {
  const shoulder = restPoint(shoulders[hand], p)
  const shrug = p?.joints?.[hand === 'left' ? 'leftShoulder' : 'rightShoulder']
  return shrug ? { x: shoulder.x + shrug.x, y: shoulder.y + shrug.y } : shoulder
}
export function reachableHead(target: Point, p?: PuppetPose): Point {
  const home = restPoint(homeHead, p)
  const dx = target.x - home.x, dy = target.y - home.y
  const scale = Math.max(1, Math.hypot(dx / feel.headRadius.x, dy / feel.headRadius.y))
  return { x: home.x + dx / scale, y: home.y + dy / scale }
}
export function reachableWrist(target: Point, hand: Hand, p?: PuppetPose): Point {
  const s = restShoulder(hand, p)
  const scale = Math.max(1, distance(s, target) / feel.wristReach)
  return { x: s.x + (target.x - s.x) / scale, y: s.y + (target.y - s.y) / scale }
}
export function moveHandle(p: PuppetPose, handle: Handle, target: Point): PuppetPose {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return p
  if (handle === 'prop') {
    return { ...p, holder: null, propPosition: { x: clamp(target.x, 46, feel.width - 46), y: clamp(target.y, 30, feel.height - 30) } }
  }
  if (handle === 'head') {
    return { ...p, head: reachableHead(target, p), pinned: pin(p, handle) }
  }
  const s = restShoulder(handle, p)
  const length = distance(s, target)
  let hand = reachableWrist(target, handle, p)
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
  return { ...p, [handle]: hand, [key]: bend, pinned: pin(p, handle) }
}

/** Carry a held object by its grip. A loose object can travel the whole stage. */
export function dragHandle(p: PuppetPose, handle: Handle, target: Point): PuppetPose {
  if (handle !== 'prop' || !p.holder || !p.prop) return moveHandle(p, handle, target)
  const offset = propOffset(p)
  return moveHandle(p, p.holder, { x: target.x - offset.x, y: target.y - offset.y })
}

/** Test the point where the hand grips the object, or the object's center for touch drops. */
export function snapHand(p: PuppetPose, pixelsPerUnit: number, previous: Hand | null, release = false): Hand | null {
  if (!p.prop || p.holder) return null
  const center = propCenter(p)
  function score(hand: Hand) {
    const offset = propOffset(p, hand)
    const grip = { x: center.x - offset.x, y: center.y - offset.y }
    return Math.min(distance(center, p[hand]), distance(grip, p[hand])) * pixelsPerUnit
  }
  const left = score('left'), right = score('right')
  let next: Hand = left <= right ? 'left' : 'right'
  const limit = release ? feel.attachPx : feel.previewPx
  if (previous && score(previous) <= limit && score(previous) < score(next) + feel.handoffPx) next = previous
  return score(next) <= limit ? next : null
}
