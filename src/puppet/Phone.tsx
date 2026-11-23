import { clamp, rotate } from './geometry'
import type { PuppetRig } from './motion'

/** As a held phone comes up and away from the face, its screen turns toward the actor. */
export function phoneView(rig: PuppetRig) {
  const head = rig.pose.head, phone = rig.propCenter
  const dx = phone.x - head.x, dy = phone.y - (head.y - 7)
  const away = clamp((Math.abs(dx) - 58) / 54, 0, 1)
  const raised = clamp((80 - dy) / 51, 0, 1)
  const amount = rig.pose.holder ? away * away * (3 - 2 * away) * raised : 0
  if (!amount) return { width: 1, edge: 0, gazeX: 0, gazeY: 0 }
  const direction = Math.sign(dx)
  const local = rotate({ x: dx, y: dy }, { x: 0, y: 0 }, -rig.headAngle)
  const distance = Math.max(1, Math.hypot(local.x, local.y))
  return {
    // Signed projected width crosses zero when the phone is edge on.
    width: 1 - 1.80 * amount,
    edge: -direction * 4.5 * Math.sin(amount * Math.PI * 0.80),
    gazeX: 4 * local.x / distance * amount,
    gazeY: 2 * local.y / distance * amount,
  }
}

export function Phone({ width, edge }: { width: number; edge: number }) {
  const half = Math.max(0.45, Math.abs(width) * 12.5)
  const outer = edge + Math.sign(edge || 1) * half
  const inner = Math.sign(edge || 1) * half
  return <g transform="rotate(5)" data-phone-side={width < 0 ? 'back' : 'screen'}>
    <path d={`M${inner}-21 L${outer}-19 V20 L${inner} 23Z`} fill="#70857b" strokeWidth="1.8" />
    <rect x={-half} y="-23" width={2 * half} height="46" rx={Math.min(4, half)} fill={width < 0 ? '#526d64' : '#3e4946'} />
    <g transform={`scale(${Math.abs(width)} 1)`} strokeWidth="1.35">
      {width < 0 ? <>
        <rect x="-9.5" y="-20" width="11" height="17" rx="3.6" fill="#aab7a3" />
        <circle cx="-4.5" cy="-15.6" r="2.9" fill="#293632" />
        <circle cx="-4.5" cy="-8" r="2.9" fill="#293632" />
        <circle cx="5" cy="-16" r="1.7" fill="#eee1bb" stroke="none" />
        <path d="M3 17 l4 -2" stroke="#c5c5a6" />
      </> : <>
        <rect x="-9" y="-17.5" width="18" height="31" rx="1.6" fill="#afc7c1" />
        <path d="M-7 2 L3-13 M-7 7 L0-4" stroke="#dce1cd" strokeWidth="1.7" />
        <path d="M-3-20 L3-20 M-3 17.5 L3 17.5" stroke="#d3d0b7" />
      </>}
    </g>
  </g>
}
