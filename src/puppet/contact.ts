import { clamp, pivot, rotate, type Point, type PuppetPose, type StageHandle } from './geometry'

export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }
export type Grip = { handle: StageHandle; point: Point; strength?: number }

export const chestHandle = { x: pivot.x, y: pivot.y - 51 }
export const headTiltOffset = { x: 29, y: -30 }
const origin = { x: 0, y: 0 }

/** Keep the grabbed point of the sack under the pointer while it turns or stretches around it. */
export function contactTransform(t: Affine, grip?: Grip): Affine {
  if (grip?.handle !== 'waist' && grip?.handle !== 'chest') return t
  const anchor = grip.handle === 'waist' ? pivot : chestHandle
  const e = grip.point.x - (t.a * anchor.x + t.c * anchor.y)
  const f = grip.point.y - (t.b * anchor.x + t.d * anchor.y)
  const strength = clamp(grip.strength ?? 1, 0, 1)
  return { ...t, e: t.e + (e - t.e) * strength, f: t.f + (f - t.f) * strength }
}

/** A head tilt grabs the corner of the bag; its center may swing around that corner. */
export function contactHead(pose: PuppetPose, angle: number, grip?: Grip) {
  if (grip?.handle !== 'head' && grip?.handle !== 'headTilt') return { pose, angle }
  const offset = grip.handle === 'headTilt' ? rotate(headTiltOffset, origin, angle) : origin
  const strength = clamp(grip.strength ?? 1, 0, 1)
  const head = {
    x: pose.head.x + (grip.point.x - offset.x - pose.head.x) * strength,
    y: pose.head.y + (grip.point.y - offset.y - pose.head.y) * strength,
  }
  return { pose: { ...pose, head }, angle }
}
