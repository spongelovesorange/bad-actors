import type { Point, StageHandle } from './geometry'

type Flick = { angle: number; strength: number; at: number }

export function traceFlick(delta: Point, elapsed: number, at: number): Flick | undefined {
  const travel = Math.hypot(delta.x, delta.y)
  const speed = travel / Math.max(6, elapsed)
  if (travel < 2 || speed < 0.7) return
  return { angle: Math.atan2(delta.y, delta.x) * 180 / Math.PI, strength: Math.min(1, speed / 1.6), at }
}

export function flickAt(flick: Flick | undefined, now: number) {
  if (!flick) return
  const fade = Math.min(1, (105 - (now - flick.at)) / 75)
  if (fade > 0) return { angle: flick.angle, opacity: flick.strength * fade }
}

/** Two dry-brush marks on the stage, trailing the contact spot. The actor paints over them. */
export function FlickInk({ handle, point, angle, opacity }: {
  handle: StageHandle; point: Point; angle: number; opacity: number
}) {
  const gap = handle === 'head' ? 43 : handle === 'waist' ? 52 : handle === 'chest' ? 33 : 17
  return <g className="ba-flick-ink" aria-hidden="true" pointerEvents="none" opacity={opacity}
    transform={`translate(${point.x} ${point.y}) rotate(${angle}) translate(${-gap} 0)`}>
    <path d="M-34-7 Q-22-9-4-6 L-1-4 Q-20-6-34-7Z" />
    <path d="M-24 6 L-8 2 L-11 5Z" />
  </g>
}
