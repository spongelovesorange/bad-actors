import { clamp, type Hand, type Joint, type Point, type PuppetPose } from './geometry'
import type { PuppetRig } from './motion'

const turnLimit = { chest: 24, headTilt: 47 }
export function turnJoint(p: PuppetPose, joint: keyof typeof turnLimit, delta: number): PuppetPose {
  const current = p.joints?.[joint]?.x ?? 0
  const x = clamp(current + delta, -turnLimit[joint], turnLimit[joint])
  return x === current ? p : { ...p, joints: { ...p.joints, [joint]: { x, y: 0 } } }
}

function automaticFootAngle(p: PuppetPose, hand: Hand) {
  const ankle = p.joints?.[hand === 'left' ? 'leftAnkle' : 'rightAnkle']
  const knee = p.joints?.[hand === 'left' ? 'leftKnee' : 'rightKnee']
  const lift = Math.max(0, -(ankle?.y ?? 0))
  return (hand === 'left' ? -1 : 1) * clamp(lift * (0.5 - (knee?.y ?? 0) * 0.008), 0, 34)
}

export function footAngle(p: PuppetPose, hand: Hand) {
  return clamp(automaticFootAngle(p, hand) + (p.footTurns?.[hand] ?? 0), -65, 65)
}

export function turnFoot(p: PuppetPose, hand: Hand, degrees: number): PuppetPose {
  if (!Number.isFinite(degrees)) return p
  const from = footAngle(p, hand)
  const target = clamp(from + degrees, -65, 65)
  if (target === from) return p
  const next = target - automaticFootAngle(p, hand)
  return { ...p, footTurns: { ...p.footTurns, [hand]: next } }
}

function withinReach(p: Point, center: Point, reach: number): Point {
  const dx = p.x - center.x, dy = p.y - center.y
  const scale = Math.min(1, reach / (Math.hypot(dx, dy) || 1))
  return { x: center.x + dx * scale, y: center.y + dy * scale }
}

export function posedElbow(automatic: Point, bias: Point | undefined, shoulder: Point, palm: Point): Point {
  if (!bias) return automatic
  const target = { x: automatic.x + bias.x, y: automatic.y + bias.y }
  return withinReach(withinReach(target, shoulder, 96), palm, 96)
}

export function moveJoint(p: PuppetPose, joint: Joint, target: Point, rig: PuppetRig): PuppetPose {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return p
  const from = rig.joints[joint]
  if (joint === 'chest' || joint === 'headTilt') {
    const center = joint === 'chest' ? rig.joints.waist : rig.pose.head
    if (Math.hypot(target.x - center.x, target.y - center.y) < 8) return p
    const angle = Math.atan2(target.y - center.y, target.x - center.x) - Math.atan2(from.y - center.y, from.x - center.x)
    const shortest = Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI
    return turnJoint(p, joint, shortest)
  }
  const before = p.joints?.[joint] ?? { x: 0, y: 0 }
  let xLimit: number, top: number, bottom: number
  if (joint === 'waist') { xLimit = 26; top = -16; bottom = 28 }
  else if (joint.endsWith('Shoulder')) { xLimit = 12; top = -19; bottom = 17 }
  else if (joint.endsWith('Knee')) { xLimit = 16; top = -16; bottom = 16 }
  else if (joint.endsWith('Ankle')) {
    xLimit = 52; top = -62; bottom = 12
    const hip = rig.point({ x: joint === 'leftAnkle' ? 229 : 277, y: 246 })
    target = withinReach(target, hip, 85)
  } else {
    xLimit = 92; top = -82; bottom = 82
    const left = joint === 'leftElbow'
    target = withinReach(withinReach(target, left ? rig.joints.leftShoulder : rig.joints.rightShoulder, 96), left ? rig.pose.left : rig.pose.right, 96)
  }
  const bias = {
    x: clamp(before.x + target.x - from.x, -xLimit, xLimit),
    y: clamp(before.y + target.y - from.y, top, bottom),
  }
  if (bias.x === before.x && bias.y === before.y) return p
  return { ...p, joints: { ...p.joints, [joint]: bias } }
}
