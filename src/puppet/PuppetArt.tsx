import {
  handShape,
  rotate,
  shoulders,
  type Hand,
  type HandShape,
  type Point,
  type PuppetPose,
} from './geometry'
import { computeRig, stillMotion, type PuppetMotion, type PuppetRig, type SavedMotion } from './motion'
import { ActorFace } from './ActorFace'
import type { Grip } from './contact'

export { ActorFace } from './ActorFace'
export { stillMotion, type PuppetMotion } from './motion'

const ink = '#302d27'
const canvas = '#bd9147'
const canvasShadow = '#9f743a'
const binding = '#665b47'
const boot = '#454c43'
const faceCloth = '#ddbb7a'

const xy = (p: Point) => `${p.x} ${p.y}`

function Leg({ side, rig, lower }: { side: Hand; rig: PuppetRig; lower?: boolean }) {
  const left = side === 'left'
  const ankle = left ? rig.joints.leftAnkle : rig.joints.rightAnkle
  const knee = left ? rig.joints.leftKnee : rig.joints.rightKnee
  const start = lower ? knee : rig.point({ x: left ? 229 : 277, y: 246 })
  const d = `M ${xy(start)} L ${xy(lower ? ankle : knee)}`
  const inward = left ? 1 : -1
  return (
    <g>
      <path d={d} fill="none" stroke={ink} strokeWidth="14" />
      <path d={d} fill="none" stroke={binding} strokeWidth="9" />
      {lower && <>
        <circle data-knee={side} cx={knee.x} cy={knee.y} r="3" fill="#847357" stroke="none" />
        <g data-sole={side} transform={`translate(${xy(ankle)}) rotate(${rig.footAngle[side]}) scale(${inward} 1)`}>
          <path d="M-6-4 Q0-8 7-4 L8 6 Q7 9 3 9 L-19 9 Q-23 7-20 3 Q-18 0-7-1Z" fill={boot} stroke={ink} strokeWidth="2.8" />
          <path d="M-18 6 L5 6" fill="none" stroke="#a09376" strokeWidth="1.5" />
        </g>
      </>}
    </g>
  )
}

function Arm({ side, rig }: { side: Hand; rig: PuppetRig }) {
  const left = side === 'left'
  const shoulder = left ? rig.joints.leftShoulder : rig.joints.rightShoulder
  const elbow = left ? rig.joints.leftElbow : rig.joints.rightElbow
  const palm = rig.pose[side]
  const root = rig.point(shoulders[side])
  // Two quadratic pieces share a tangent at the actual elbow, so its grip
  // remains on the painted sleeve even when the player folds it sharply.
  const dx = palm.x - shoulder.x, dy = palm.y - shoulder.y
  const radius = Math.hypot(dx, dy)
  const softness = Math.min(radius * 0.23, 23) / (radius || 1)
  const before = { x: elbow.x - dx * softness, y: elbow.y - dy * softness }
  const after = { x: elbow.x + dx * softness, y: elbow.y + dy * softness }
  const d = `M ${xy(shoulder)} Q ${xy(before)} ${xy(elbow)} Q ${xy(after)} ${xy(palm)}`
  return (
    <g data-arm={side} data-shoulder={`${shoulder.x},${shoulder.y}`} data-elbow={`${elbow.x},${elbow.y}`} data-hand={`${palm.x},${palm.y}`} fill="none">
      <g data-socket={side} strokeLinecap="butt">
        <path d={`M ${xy(root)} L ${xy(shoulder)}`} stroke={ink} strokeWidth="15.5" />
        <path d={`M ${xy(root)} L ${xy(shoulder)}`} stroke={canvasShadow} strokeWidth="10.5" />
      </g>
      <path d={d} stroke={ink} strokeWidth="12.5" />
      <path d={d} stroke="#80735a" strokeWidth="7" />
    </g>
  )
}

// The open hand splays four fingers and a thumb. On a fist the thumb crosses
// the folded fingers, leaving a low row of knuckles and a compact silhouette.
const palmArt = {
  relaxed: {
    edge: 'M-6-7 L-5-10 L0-11 Q3-10 4-7 L8-8 Q13-7 12-2 L10 6 Q9 11 5 12 L-1 12 Q-4 11-4 8 Q-10 6-11 2 L-13-2 Q-13-6-9-5Z',
    seam: 'M4 7 L7 3',
  },
  open: {
    edge: 'M-7 13 Q-11 11-13 6 L-20-2 Q-23-6-20-8 Q-18-10-15-7 L-9-2 L-13-18 Q-14-22-11-23 Q-8-24-7-20 L-3-9 L-5-24 Q-5-28-2-28 Q1-28 2-24 L4-10 L5-22 Q5-26 8-25 Q11-25 11-21 L10-8 L13-16 Q15-20 18-18 Q20-17 18-13 L15-1 L14 5 Q12 11 7 14 Q0 16-7 13Z',
    seam: 'M-10 0 Q-4 1-3 7 M2 8 Q7 8 10 4',
  },
  fist: {
    edge: 'M-11 5 L-12-3 Q-12-8-9-9 Q-7-10-5-8 Q-3-12 0-11 L3-8 Q6-11 9-8 L11-5 Q14-6 14-2 L13 4 Q11 10 5 10 L-5 10 Q-10 10-11 5Z',
    seam: 'M-10 1 Q-6-2-3 0 L3 2 Q6 5 3 7 L-2 6 M3-6 L4-3 M9-5 L10-2',
  },
  grip: {
    edge: 'M-9-2 Q-10-5-6-6 L5-5 Q12-4 11 2 Q10 7 5 9 L-2 8 Q-7 9-9 3Z',
    seam: 'M2 0 L8 1',
  },
} satisfies Record<HandShape | 'grip', { edge: string; seam: string }>

function Palm({ side, pose }: { side: Hand; pose: PuppetPose }) {
  const shape = pose.prop && pose.holder === side ? 'grip' : handShape(pose, side)
  const art = palmArt[shape]
  return (
    <g data-palm={side} data-palm-shape={shape} transform={`translate(${xy(pose[side])}) scale(${side === 'left' ? -1 : 1} 1)`}>
      <path d={art.edge} fill="#a88959" stroke={ink} strokeWidth="2.7" />
      <path d={art.seam} fill="none" stroke="#796742" strokeWidth="1.5" />
    </g>
  )
}

function Body({ rig }: { rig: PuppetRig }) {
  return (
    <g data-rig="torso" transform={rig.matrix}>
      {/* A canvas ballast bag. The bottom gusset contains most of its volume. */}
      <path d="M229 149 Q244 146 262 147 Q279 150 283 168 Q288 184 300 202 Q313 222 313 240 Q313 252 303 258 Q290 266 259 266 L226 264 Q200 262 193 250 Q187 239 191 222 Q195 205 207 185 L216 165 Q220 154 229 149Z" fill={canvas} stroke={ink} strokeWidth="3.8" />
      <path d="M194 239 Q211 251 249 252 Q286 255 311 238 Q312 252 301 258 Q284 267 249 263 L224 262 Q201 259 194 251Z" fill={canvasShadow} stroke="none" />
      <path d="M201 246 Q227 258 266 257 Q289 256 302 250" stroke="#775a36" strokeDasharray="5 3" strokeWidth="1.4" fill="none" />
      <path d="M231 154 Q238 156 247 156 M197 233 L194 241 L207 241 M298 245 L306 240 L304 228" stroke="#866537" strokeWidth="2" fill="none" />
      {/* One crooked darn, deliberately away from the face and controls. */}
      <path d="M283 204 L293 214 M283 209 L288 204 M286 212 L291 207 M289 215 L294 210" stroke="#795c37" strokeWidth="2.15" fill="none" />
    </g>
  )
}

function Neck({ rig, motion }: { rig: PuppetRig; motion: PuppetMotion }) {
  const stem = rig.point({ x: 246, y: 153 })
  const head = rig.pose.head
  const top = rotate({ x: head.x - 2, y: head.y + 23 }, head, rig.headAngle)
  const bend = { x: (stem.x + top.x) / 2 + motion.head * 0.29, y: (stem.y + top.y) / 2 + 1 }
  const d = `M ${xy(stem)} Q ${xy(bend)} ${xy(top)}`
  return (
    <g fill="none">
      <path data-neck="" d={d} stroke={ink} strokeWidth="20" />
      <path d={d} stroke="#746a56" strokeWidth="14" />
      <path d={d} stroke="#aa9873" strokeWidth="13" strokeDasharray="2 5" strokeLinecap="butt" />
    </g>
  )
}

function Head({ rig }: { rig: PuppetRig }) {
  const { pose, headAngle: angle } = rig
  const point = pose.head
  return (
    <g data-rig="head" transform={`translate(${xy(point)}) rotate(${angle})`}>
      {/* Webbing handle, intentionally offset so the silhouette leans when still. */}
      <path d="M-26-28 L-29-39 Q-30-43-25-44 L-15-45 Q-11-45-10-41 L-6-29" stroke={ink} strokeWidth="7" fill="none" />
      <path d="M-26-29 L-28-39 Q-29-41-25-42 L-16-43 Q-14-43-13-40 L-9-29" stroke={binding} strokeWidth="3" fill="none" />
      <path d="M-46-20 L-49-28 L-39-27 Q-8-32 23-29 L41-33 L40-24 Q48-18 47 1 L46 15 Q45 24 32 27 Q15 31-16 29 Q-35 29-42 21 Q-49 14-48 1Z" fill={faceCloth} stroke={ink} strokeWidth="3.5" />
      <path d="M-45 16 Q-27 25 0 24 Q28 24 44 16 Q43 24 30 26 Q12 31-18 27 Q-38 27-45 16Z" fill="#c6a162" stroke="none" />
      <path d="M-43-22 Q-6-28 22-25 L34-27 M-38 16 L-34 20" fill="none" stroke="#947343" strokeWidth="1.6" />
      <ActorFace shape={pose.face} motion={rig.motion} landmarks />
    </g>
  )
}

function PropArt({ rig }: { rig: PuppetRig }) {
  const { pose, propCenter: center } = rig
  return (
    <g data-visible-prop={pose.prop} transform={`translate(${xy(center)}) rotate(${rig.propAngle})`} stroke={ink} strokeWidth="2.5">
      {pose.prop === 'phone' && <g transform="rotate(5)">
        <rect x="-10.5" y="-23" width="21" height="45" rx="3.5" fill="#47585d" />
        <rect x="-7.75" y="-17.5" width="15.5" height="29.5" rx="1.3" fill="#adc8c6" strokeWidth="1.3" />
        <path d="M-3-20 L3-20 M-2 16 L2 16" fill="none" stroke="#d3d0b7" strokeWidth="1.3" />
      </g>}
      {pose.prop === 'cup' && <g transform={pose.holder === 'left' ? 'scale(-1 1)' : undefined}>
        <path d="M9-6 Q22-11 20-2 Q19 5 11 5 L10 1 Q16 0 16-4 Q15-5 11-3Z" fill="#b3a394" strokeWidth="2" />
        <path d="M-13-7 L12-7 L10.5 7 Q10 10 1.5 11 Q-8 11-10 8Z" fill="#b76350" />
        <ellipse data-landmark="cup-rim" cx="-1" cy="-7" rx="12.5" ry="2.6" fill="#eee2c7" strokeWidth="2" />
        <path d="M-8.5 5 L-6.5 7" fill="none" stroke="#e6c3a2" strokeWidth="1.6" />
      </g>}
      {pose.prop === 'plate' && <g>
        <path d="M-35-1 Q-33 9 0 10 Q28 10 35-1Z" fill="#83958d" />
        <ellipse cy="-2" rx="35" ry="7.5" fill="#bbc6b7" />
        <ellipse cy="-2" rx="27" ry="4" fill="none" stroke="#77867a" strokeWidth="1.4" />
      </g>}
    </g>
  )
}

/** Only the actor and the prop are included in a visual observation. */
export function PuppetArt({ pose, motion = stillMotion, grip, rig: stagedRig }: { pose: PuppetPose; motion?: SavedMotion; grip?: Grip; rig?: PuppetRig }) {
  const rig = stagedRig ?? computeRig(pose, motion, grip)
  const visible = rig.pose
  // A lifted shin can cross in front of the sack. Grounded legs stay behind it.
  const liftLeft = rig.joints.leftAnkle.y < 289
  const liftRight = rig.joints.rightAnkle.y < 289
  return (
    <g data-puppet-art="" pointerEvents="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="251" cy="307" rx="56" ry="4" fill="#37342e" opacity="0.2" />
      <Leg side="left" rig={rig} />
      <Leg side="right" rig={rig} />
      {!liftLeft && <Leg side="left" rig={rig} lower />}
      {!liftRight && <Leg side="right" rig={rig} lower />}
      <Neck rig={rig} motion={rig.motion} />
      <Body rig={rig} />
      {liftLeft && <Leg side="left" rig={rig} lower />}
      {liftRight && <Leg side="right" rig={rig} lower />}
      <Head rig={rig} />
      <Arm side="left" rig={rig} />
      <Arm side="right" rig={rig} />
      <Palm side="left" pose={visible} />
      <Palm side="right" pose={visible} />
      {pose.prop && <PropArt rig={rig} />}
    </g>
  )
}
