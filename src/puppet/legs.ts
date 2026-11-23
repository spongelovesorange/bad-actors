import { clamp, type Hand, type Point } from './geometry'

const boneLength = 28.5
const maxKneeBias = 16

export function defaultAnkle(side: Hand): Point {
  return { x: side === 'left' ? 222 : 280, y: 297 }
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

/** The ankle is the player's chosen endpoint. The cloth-covered knee folds between it and the moving hip. */
export function legLandmarks(side: Hand, hip: Point, ankle: Point, kneeBias?: Point) {
  const dx = ankle.x - hip.x, dy = ankle.y - hip.y
  const length = Math.hypot(dx, dy)
  const outward = side === 'left' ? -1 : 1
  let bow = Math.sqrt(Math.max(0, boneLength * boneLength - length * length / 4))
  // Ease through full extension so the last few pixels of a reach do not snap the knee straight.
  if (bow < 6) bow *= smoothstep(bow / 6)

  // At a fully folded hip there is no defined perpendicular. Fold outward and down,
  // then smoothly pick up the ordinary two-bone direction as the endpoints separate.
  const unfold = smoothstep((length - 5) / 25)
  const scale = length > 0 ? unfold / length : 0
  const nx = outward * (dy * scale + (1 - unfold) * 0.88)
  const ny = -outward * dx * scale + (1 - unfold) * 0.47
  const knee = {
    x: hip.x + dx / 2 + bow * nx + clamp(kneeBias?.x ?? 0, -maxKneeBias, maxKneeBias),
    y: hip.y + dy / 2 + bow * ny + clamp(kneeBias?.y ?? 0, -maxKneeBias, maxKneeBias),
  }
  return { knee, ankle }
}
