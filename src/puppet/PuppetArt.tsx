import { clamp, distance, feel, homeHead, pivot, propCenter, rotate, shoulders, solveElbow, type Hand, type Point, type PuppetPose } from './geometry'

const ink = '#332b3c', cream = '#ffdfaa', red = '#ce4941', blue = '#4264ad'
export type PuppetMotion = { body: number; head: number }
export const stillMotion: PuppetMotion = { body: 0, head: 0 }
const xy = (p: Point) => p.x + ',' + p.y

function Shoe({ left }: { left: boolean }) {
  return <g transform={left ? 'translate(230 0)' : 'translate(271 0) scale(-1 1)'}>
    <path d="M-10 237 Q-14 249 -8 268 L-10 287 Q-3 294 6 286 L11 250 10 236Z" fill="#eeb788" stroke={ink} strokeWidth="3.4"/>
    <path d="M-10 272 Q-3 275 8 271 L6 291 -11 292Z" fill="#fbddaa" stroke={ink} strokeWidth="2.8"/>
    <path d="M-10 276 Q-3 279 6 275 M-10 282 Q-3 285 6 281" fill="none" stroke={red} strokeWidth="3.5"/>
    <path d="M-12 286 Q-6 281 1 286 L6 284 Q13 285 12 294 L12 302 Q5 308 -12 307 L-30 307 Q-39 306 -38 299 Q-37 290 -23 291Z" fill={ink} stroke={ink} strokeWidth="3"/>
    <path d="M-35 301 Q-26 305 10 301" fill="none" stroke="#ac7058" strokeWidth="3"/>
    <path d="M-23 295 Q-19 291 -12 292" fill="none" stroke="#807080" strokeWidth="2.4"/>
  </g>
}

function Sleeve({ pose, side, body }: { pose: PuppetPose; side: Hand; body: number }) {
  const shoulder = rotate(shoulders[side], pivot, body)
  const palm = pose[side]
  const elbow = solveElbow(shoulder, palm, side === 'left' ? pose.leftBend : pose.rightBend)
  const d = 'M' + xy(shoulder) + ' L' + xy(elbow) + ' ' + xy(palm)
  return <g data-arm={side} data-shoulder={xy(shoulder)} data-elbow={xy(elbow)} data-hand={xy(palm)} fill="none" strokeLinejoin="round" strokeLinecap="round">
    <path d={d} stroke={ink} strokeWidth="21"/>
    <path d={d} stroke="#f6cd9a" strokeWidth="15"/>
    <path d={d} stroke={red} strokeWidth="14" strokeDasharray="5 10" strokeLinecap="butt"/>
    <circle cx={elbow.x} cy={elbow.y} r="5" stroke="#aa6553" strokeWidth="1.6" strokeDasharray="2 3"/>
  </g>
}

function Palm({ point, left }: { point: Point; left: boolean }) {
  return <g transform={'translate(' + xy(point) + ') scale(' + (left ? -1 : 1) + ' 1)'} stroke={ink} strokeLinejoin="round" strokeLinecap="round">
    <path d="M-7 8 Q-16 3 -14 -4 Q-12 -8 -7 -5 L-7 -12 Q-6 -16 -3 -15 Q0 -15 1 -9 L3 -14 Q7 -17 9 -13 L9 -6 Q13 -10 15 -6 Q18 0 12 8 Q7 15 1 13Z" fill={cream} strokeWidth="2.8"/>
    <path d="M-7 -5 Q-4 -4 -2 1 M4 9 Q9 8 11 4" fill="none" stroke="#ca976f" strokeWidth="1.6"/>
  </g>
}

function Body({ angle }: { angle: number }) {
  return <g transform={'rotate(' + angle + ' ' + pivot.x + ' ' + pivot.y + ')'} stroke={ink} strokeLinejoin="round" strokeLinecap="round">
    <path d="M241 127 Q239 143 230 151 Q248 169 269 150 Q257 138 261 125Z" fill="#e8b183" strokeWidth="3"/>
    <path d="M230 146 Q212 151 213 171 Q219 180 224 176 Q217 198 213 225 Q207 242 215 248 Q227 257 241 254 L251 238 Q255 250 258 254 Q275 258 287 249 Q295 242 287 225 L278 175 Q285 176 289 166 Q285 153 268 147Z" fill={blue} strokeWidth="4"/>
    <path d="M279 179 Q278 198 284 226 Q288 240 281 247 Q272 251 258 249 L258 254 Q278 260 288 248 Q293 240 287 224Z" fill="#314a86" stroke="none"/>
    <path d="M226 153 Q227 168 235 175 Q249 179 265 173 Q272 164 273 151 L267 148 Q265 161 259 165 Q247 168 240 164 Q236 157 235 147Z" fill="#edb847" strokeWidth="2.2"/>
    <circle cx="238.5" cy="171" r="3.4" fill="#f7d274" strokeWidth="1.6"/>
    <circle cx="265" cy="170" r="3.4" fill="#f7d274" strokeWidth="1.6"/>
    <path d="M239 186 Q249 189 264 183 L265 196 Q260 205 250 205 Q242 205 239 199Z" fill="#6c87c3" strokeWidth="2.2"/>
    <path d="M241 190 Q250 193 261 187" fill="none" stroke="#ebbc73" strokeWidth="1.7" strokeDasharray="2 3"/>
    <path d="M219 235 Q225 239 234 238 M265 237 Q273 239 285 234" fill="none" stroke="#a7b9d9" strokeWidth="2" strokeDasharray="3 4"/>
    <path d="M233 142 Q249 151 263 140 L270 149 Q255 161 235 153 L226 149Z" fill={red} strokeWidth="2.8"/>
    <path d="M232 151 L224 166 230 165 232 172 240 153" fill="#dc5849" strokeWidth="2.3"/>
  </g>
}

function Head({ pose, sway }: { pose: PuppetPose; sway: number }) {
  const angle = (pose.head.x - homeHead.x) / feel.headRadius.x * feel.headTilt + sway
  return <g transform={'translate(' + xy(pose.head) + ') rotate(' + angle + ')'} stroke={ink} strokeLinejoin="round" strokeLinecap="round">
    <path d="M-37 -5 Q-47 -12 -49 -1 Q-50 9 -39 12 M38 -4 Q49 -12 49 -1 Q50 8 39 12" fill="#f0b58a" strokeWidth="3"/>
    <path d="M-44 0 Q-41 -2 -39 2 M42 0 Q45 -2 46 0" fill="none" stroke="#af796a" strokeWidth="1.7"/>
    <path d="M-39 -17 Q-37 -39 -11 -43 Q22 -49 36 -32 Q47 -18 41 6 Q36 34 14 42 Q-10 50 -29 32 Q-45 18 -39 -17Z" fill={cream} strokeWidth="3.8"/>
    <path d="M-35 18 Q-15 43 12 39 Q29 35 37 18 Q32 37 13 43 Q-15 49 -30 31Z" fill="#e7b88c" stroke="none"/>
    <path d="M-39 -3 Q-47 -12 -43 -25 Q-48 -38 -34 -42 Q-31 -54 -18 -50 Q-11 -59 1 -53 Q10 -60 21 -52 Q33 -54 38 -43 Q49 -42 47 -32 Q49 -24 41 -16 L38 -9 35 -22 Q25 -15 22 -22 Q13 -15 5 -24 Q-1 -16 -11 -23 Q-16 -13 -28 -17 Q-30 -7 -39 -3Z" fill="#383044" strokeWidth="3.2"/>
    <path d="M-35 -33 Q-30 -42 -22 -40 M-10 -43 Q-5 -48 2 -45 M14 -43 Q20 -48 27 -41" fill="none" stroke="#66536b" strokeWidth="2.5"/>
    <g transform={pose.face === 'open' ? 'translate(0 -3)' : undefined}>
      <path d={pose.face === 'flat' ? 'M-27 -6 L-16 -6 M11 -7 L22 -8' : 'M-27 -5 Q-22 -10 -15 -7 M10 -8 Q17 -13 23 -9'} fill="none" strokeWidth="2.8"/>
    </g>
    {pose.face === 'flat'
      ? <path d="M-24 3 Q-19 5 -14 2 M11 2 Q17 4 21 0" fill="none" strokeWidth="3"/>
      : <g fill={ink} stroke="none"><ellipse cx="-18" cy="3" rx="3.2" ry={pose.face === 'open' ? 6 : 4.5}/><ellipse cx="16" cy="1" rx="3.2" ry={pose.face === 'open' ? 6 : 4.5}/></g>}
    <g fill="#e8937f" stroke="none"><ellipse cx="-27" cy="13" rx="7" ry="3.4" transform="rotate(10 -27 13)"/><ellipse cx="27" cy="10" rx="7" ry="3.5" transform="rotate(-10 27 10)"/></g>
    <path d="M-3 4 Q2 1 5 8 Q5 12 -1 12" fill="#e8a174" stroke="#ac7860" strokeWidth="1.6"/>
    {pose.face === 'open' ? <ellipse cx="2" cy="24" rx="6" ry="8" fill={ink} strokeWidth="1"/>
      : <path d={pose.face === 'flat' ? 'M-5 24 L9 23' : 'M-9 22 Q1 32 13 20 Q3 26 -9 22Z'} fill={ink} strokeWidth="2.2"/>}
    <path d="M-28 22 L-25 23 M23 20 L26 18" fill="none" stroke="#bd8a73" strokeWidth="1.5"/>
  </g>
}

function PropArt({ pose }: { pose: PuppetPose }) {
  const center = propCenter(pose)
  return <g data-visible-prop={pose.prop} transform={'translate(' + xy(center) + ') rotate(' + pose.propTurn + ')'} stroke={ink} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    {pose.prop === 'phone' && <g transform="rotate(6)">
      <rect x="-12" y="-25" width="24" height="49" rx="5" fill="#679d8f"/>
      <rect x="-8.5" y="-18" width="17" height="32" rx="2.5" fill="#cee3d6" strokeWidth="1.8"/>
      <path d="M-4 -21 L4 -21 M-3 19 L2 19" strokeWidth="2"/>
      <path d="M-5 -11 L2 -15 M-5 -5 L5 -11" stroke="#f2f5dd" strokeWidth="2"/>
    </g>}
    {pose.prop === 'cup' && <g>
      <path d="M15 -13 Q30 -18 29 -5 Q28 5 15 7 L14 2 Q23 0 23 -6 Q24 -10 16 -8Z" fill="#d56d53"/>
      <path d="M-20 -15 Q-5 -20 17 -15 L15 9 Q13 18 -1 18 Q-15 18 -17 9Z" fill="#dc7958"/>
      <ellipse cy="-14.5" cx="-1.6" rx="18" ry="4.7" fill="#914d40" strokeWidth="2.2"/>
      <path d="M-13 -5 L-12 6" stroke="#f4ae81" strokeWidth="3"/>
    </g>}
    {pose.prop === 'plate' && <g>
      <path d="M-42 -2 Q-34 11 0 12 Q31 12 42 -2Z" fill="#7b9b8d"/>
      <ellipse cy="-2" rx="43" ry="10" fill="#d9dfbf"/>
      <ellipse cy="-2" rx="33" ry="5.5" fill="#aec2aa" stroke="#829a82" strokeWidth="1.7"/>
    </g>}
  </g>
}

/** This group contains the entire observable character. Handles, stage copy and room data live outside it. */
export function PuppetArt({ pose, motion = stillMotion }: { pose: PuppetPose; motion?: PuppetMotion }) {
  // A folded arm has no unique elbow direction. Ease shoulder motion out close to either wrist.
  const clearance = Math.min(distance(shoulders.left, pose.left), distance(shoulders.right, pose.right))
  const blend = clamp(clearance / 17, 0, 1)
  const body = motion.body * blend * blend * (3 - 2 * blend)
  return <g data-puppet-art="" pointerEvents="none">
    <ellipse cx="245" cy="310" rx="64" ry="7" fill="#48303a" opacity=".16"/>
    <Shoe left/><Shoe left={false}/>
    <Sleeve pose={pose} side="left" body={body}/><Sleeve pose={pose} side="right" body={body}/>
    <Body angle={body}/><Head pose={pose} sway={motion.head}/>
    <Palm point={pose.left} left/><Palm point={pose.right} left={false}/>
    {pose.prop && <PropArt pose={pose}/>}
  </g>
}
