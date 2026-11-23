import { clamp, feel, solveElbow, type Hand, type Point, type PuppetPose } from './geometry'
import type { PuppetMotion } from './motion'

export const mixPoints = (a: Point, b: Point, amount: number): Point => ({
  x: a.x + (b.x - a.x) * amount,
  y: a.y + (b.y - a.y) * amount,
})

/** Project the cloth elbow onto the stage while keeping both sleeve ends fixed. */
export function sleeveElbow(side: Hand, pose: PuppetPose, shoulder: Point, motion: PuppetMotion): Point {
  const palm = pose[side]
  const dx = palm.x - shoulder.x
  const dy = palm.y - shoulder.y
  const outward = side === 'left' ? -1 : 1
  const authoredBend = side === 'left' ? pose.leftBend : pose.rightBend
  const radius = Math.hypot(dx, dy)
  const outerBone = solveElbow(shoulder, palm, outward)
  const halfway = mixPoints(shoulder, palm, Math.min(0.5, feel.armBone / (radius || 1)))
  // The two IK bends are reflections across the shoulder-to-wrist line.
  const solved = authoredBend === outward ? outerBone
    : { x: 2 * halfway.x - outerBone.x, y: 2 * halfway.y - outerBone.y }
  // On the way from a dangling sleeve to a salute the elbow travels outwards;
  // the projected forearm unfolds in depth as the wrist passes the ribcage.
  const rise = clamp((64 - dy) / 56, 0, 1)
  const slack = clamp((96 - radius) / 56, 0, 1)
  const outer = mixPoints(shoulder, outerBone, 1 - slack * 0.23)
  outer.y += slack * 17
  const silhouette = mixPoints(solved, outer, rise * rise * (3 - 2 * rise))

  // The ordinary two-bone solution reverses its normal when a swaying shoulder
  // travels through the wrist. A fully folded sleeve hangs down and out instead.
  const folded = {
    x: shoulder.x + outward * feel.armBone * 0.82,
    y: shoulder.y + feel.armBone * 0.53,
  }
  const t = clamp((radius - 9) / 40, 0, 1)
  const bend = mixPoints(folded, silhouette, t * t * (3 - 2 * t))

  // Blend by position so picking up a limp wrist doesn't change its shape.
  const hang = clamp((dy - 24) / 63, 0, 1) * clamp((128 - Math.abs(dx)) / 44, 0, 1)
  const droop = {
    x: palm.x + outward * 7 - motion.loose * 0.19,
    y: shoulder.y + dy * 0.72,
  }
  return mixPoints(bend, droop, hang)
}
