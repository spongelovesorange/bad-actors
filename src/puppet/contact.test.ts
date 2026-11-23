import { describe, expect, it } from 'vitest'
import { chestHandle, contactHead, contactTransform, headTiltOffset, type Affine } from './contact'
import { initialPose, pivot, rotate, type Point } from './geometry'

const apply = (m: Affine, p: Point): Point => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f })

describe('world-space grasp', () => {
  it.each(['waist', 'chest'] as const)('leaves the grasped %s exactly in place while the rest of the sack turns and stretches', handle => {
    const anchor = handle === 'waist' ? pivot : chestHandle
    const target = { x: 244.5, y: 198.25 }
    for (const sign of [-1, 1]) {
      const t = { a: 0.95, b: sign * 0.24, c: -sign * 0.29, d: 1.13, e: 82, f: -41 }
      const corrected = contactTransform(t, { handle, point: target })
      expect(apply(corrected, anchor)).toEqual(target)
      const neighbor = apply(corrected, { x: anchor.x - 26, y: anchor.y })
      expect(neighbor.x - target.x).toBeCloseTo(-26 * t.a)
      expect(neighbor.y - target.y).toBeCloseTo(-26 * t.b)
      const releasing = contactTransform(t, { handle, point: target, strength: 0.5 })
      const free = apply(t, anchor), partial = apply(releasing, anchor)
      expect(partial.x).toBeCloseTo((free.x + target.x) / 2)
      expect(partial.y).toBeCloseTo((free.y + target.y) / 2)
      expect(contactTransform(t, { handle: 'rightAnkle', point: target })).toBe(t)
    }
  })

  it('keeps the exact grabbed head landmark while the neck reacts beneath it', () => {
    const pose = initialPose()
    const point = { x: 267.75, y: 82.5 }
    for (const angle of [-37, -12, 0, 18, 42]) {
      const tilt = contactHead(pose, angle, { handle: 'headTilt', point })
      const corner = rotate(headTiltOffset, { x: 0, y: 0 }, tilt.angle)
      expect(tilt.pose.head.x + corner.x).toBeCloseTo(point.x, 10)
      expect(tilt.pose.head.y + corner.y).toBeCloseTo(point.y, 10)
      expect(contactHead(pose, angle, { handle: 'head', point }).pose.head).toEqual(point)
      const partial = contactHead(pose, angle, { handle: 'headTilt', point, strength: 0.5 })
      expect(partial.pose.head.x).toBeCloseTo((tilt.pose.head.x + pose.head.x) / 2)
      expect(partial.pose.head.y).toBeCloseTo((tilt.pose.head.y + pose.head.y) / 2)
      expect(contactHead(pose, angle).pose).toBe(pose)
    }
    expect(pose.head).toEqual({ x: 251, y: 99 })
  })
})
