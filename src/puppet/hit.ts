import { feel, isJoint, stageHandles, type Point, type PropKind, type StageHandle } from './geometry'
import type { PuppetRig } from './motion'

export type StageTarget = {
  id: StageHandle; center: Point; radius: number; touchRadius: number
  tray?: { normal: Point; touchDepth: number }
}
function paintedRadius(id: StageHandle, prop: PropKind | null) {
  switch (id) {
    case 'head': return 40
    case 'chest': return 36
    case 'waist': return 38
    case 'prop': return prop === 'plate' ? 53 : prop === 'phone' ? 25 : 18
    case 'left':
    case 'right': return 16
    case 'leftAnkle':
    case 'rightAnkle': return 21
    default: return 11
  }
}

export function stageTargets(rig: PuppetRig, scale: number): StageTarget[] {
  const targets: StageTarget[] = []
  for (const id of stageHandles) {
    if (id === 'prop' && !rig.pose.prop) continue
    const center = isJoint(id) ? rig.joints[id] : id === 'prop' ? rig.propCenter : rig.pose[id]
    const radius = Math.max(paintedRadius(id, rig.pose.prop), 8 / scale)
    const target: StageTarget = { id, center, radius, touchRadius: Math.max(radius, feel.hitRadiusPx / scale) }
    if (id === 'prop' && rig.pose.prop === 'plate') {
      const angle = rig.propAngle * Math.PI / 180
      target.tray = { normal: { x: -Math.sin(angle), y: Math.cos(angle) }, touchDepth: Math.max(17, feel.hitRadiusPx / scale) }
    }
    targets.push(target)
  }
  return targets
}

function priority(id: StageHandle) {
  if (id === 'left' || id === 'right') return 0
  if (id === 'prop') return 1
  if (id === 'head') return 2
  return 3
}

/** Only eligible hit disks compete. A fingertip inside a large disk can be
 * closer to another landmark but still outside that landmark's own hit area. */
export function pickTarget(point: Point, targets: StageTarget[], coarse: boolean, cycle?: { previous: StageHandle; slop: number }): StageHandle | null {
  let nearest: StageTarget | null = null, best = Infinity
  const neighbors: { id: StageHandle; d: number }[] | undefined = cycle ? [] : undefined
  for (const target of targets) {
    const dx = target.center.x - point.x, dy = target.center.y - point.y
    const d = dx * dx + dy * dy
    const radius = coarse ? target.touchRadius : target.radius
    if (d > radius * radius) continue
    if (target.tray) {
      // The long enamel rim is easy to grab without claiming the empty space above and below it.
      const depth = Math.abs(dx * target.tray.normal.x + dy * target.tray.normal.y)
      const limit = coarse ? target.tray.touchDepth : 17
      if (depth > limit) continue
    }
    if (d < best || (d === best && nearest && priority(target.id) < priority(nearest.id))) {
      nearest = target
      best = d
    }
    neighbors?.push({ id: target.id, d })
  }
  if (!nearest || !cycle || !neighbors || neighbors.length < 2) return nearest?.id ?? null
  const limit = (Math.sqrt(best) + cycle.slop) ** 2
  const stack = neighbors.filter(x => x.d <= limit).sort((a, b) => a.d - b.d || priority(a.id) - priority(b.id))
  const old = stack.findIndex(x => x.id === cycle.previous)
  return old >= 0 ? stack[(old + 1) % stack.length].id : nearest.id
}
