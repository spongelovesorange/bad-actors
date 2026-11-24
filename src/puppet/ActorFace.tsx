import { clamp, type FaceShape } from './geometry'
import { stillMotion, type PuppetMotion } from './motion'

const ink = '#302d27'
const thread = '#eee1b9'
const heart = 'M0 4 L-5.5-1.5 Q-8-4.5-5.5-6.5 Q-2.5-8.5 0-5 Q2.5-8.5 5.5-6.5 Q8-4.5 5.5-1.5Z'

type FaceProps = { shape: FaceShape; motion?: PuppetMotion; landmarks?: boolean; gazeX?: number; gazeY?: number }

const mouths: Partial<Record<FaceShape, string>> = {
  'side-eye': 'M-2 15 L11 15 L16 11',
  braced: 'M-10 17 L-6 13 L1 15 L6 12 L13 14',
  angry: 'M-8 18 Q3 9 14 18',
  sad: 'M-6 18 Q4 11 13 18',
  wink: 'M-3 15 Q7 17 15 10',
  flat: 'M-4 14 L10 14',
}
const brows: Partial<Record<FaceShape, string>> = {
  'side-eye': 'M-22-11 L-10-11 M8-13 L19-11',
  angry: 'M-22-17 L-10-11 M10-11 L21-17',
  sad: 'M-21-11 L-11-16 M11-16 L21-11',
  wink: 'M-21-15 L-10-17',
}

/** Embroidered features share the head's local coordinates with the mug lip. */
export function ActorFace({ shape, motion = stillMotion, landmarks = false, gazeX = 0, gazeY = 0 }: FaceProps) {
  const recoil = motion.head - motion.body
  const surprise = clamp((Math.abs(recoil) - 6) / 19, 0, 1)
  const recoilLook = Math.sign(recoil) * surprise * 4.5
  const sideways = shape === 'side-eye'
  const braced = shape === 'braced'
  const gulp = shape === 'open'
  const smile = shape === 'smile'
  const eyeWhite = sideways || gulp ? 1 : Math.max(surprise, Math.abs(gazeX) / 4)
  const gaze = clamp((sideways ? -3.6 : gazeX) + recoilLook * (sideways ? 0.38 : 1), -4.8, 4.8)
  const eyeY = gulp ? -8.5 : -7
  const eye = (right: boolean) => {
    const x = right ? 15 : -15
    const wince = braced && !right
    const shut = shape === 'sleepy' || (shape === 'wink' && right)
    const pupilX = x + gaze
    const pupilY = eyeY + (sideways ? 0 : gazeY) + (smile && right ? 1.5 : 0) + (shape === 'sad' ? 1.5 : 0)
    return (
      <g>
        {shape === 'love' ? <path d={heart} transform={`translate(${x} ${eyeY + 1}) scale(1.15)`} fill="#d23c45" stroke={ink} strokeWidth="1.2" />
          : shut ? <path d={shape === 'wink' ? 'M10-6 Q15-11 20-6' : `M${x - 5}-7 Q${x}-3.5 ${x + 5}-7`} fill="none" stroke={ink} strokeWidth="2.6" />
            : <>
              {eyeWhite > 0 && !wince && <ellipse cx={x} cy={eyeY} rx={5.5 + 1.3 * surprise} ry={gulp ? 6.3 : 4.1} fill={thread} fillOpacity={eyeWhite} />}
              {wince
                ? <path d="M-20-10 L-11-6 L-20-3" fill="none" stroke={ink} strokeWidth="2.7" />
                : <circle cx={pupilX} cy={pupilY} r={gulp ? 2.3 : 2.8} />}
            </>}
        {landmarks && <circle data-landmark={right ? 'right-eye' : 'left-eye'} cx={pupilX} cy={pupilY} r="0" />}
      </g>
    )
  }
  const mouth = mouths[shape]
  return (
    <g data-face={shape} fill={ink} strokeLinecap="round" strokeLinejoin="round">
      {eye(false)}{eye(true)}
      {brows[shape] && <path d={brows[shape]} fill="none" stroke={ink} strokeWidth={shape === 'angry' ? 3.1 : 2.5} />}
      {braced && <path d="M9-14 L19-10" fill="none" stroke={ink} strokeWidth="2.9" />}
      {smile && <path d="M9-10 Q15-13 20-10 M-21-14 L-13-15" fill="none" stroke={ink} strokeWidth="2" />}
      {(gulp || surprise > 0) && <g opacity={gulp ? 1 : surprise} fill="none" stroke={ink} strokeWidth="2">
        <path d="M-20-16 L-13-18 M12-18 L18-17" />
      </g>}
      {/* A cross-hatched vein for a temper, a bead of a tear, a drift of Zs, a blush. */}
      {shape === 'angry' && <path d="M27-24 Q30-22 30-19 M35-24 Q32-22 32-19 M27-14 Q30-16 30-19 M35-14 Q32-16 32-19"
        fill="none" stroke="#c0392b" strokeWidth="1.8" />}
      {shape === 'sad' && <path d="M-17-1 Q-20 4-17 7 Q-14 4-17-1Z" fill="#8fc3df" stroke={ink} strokeWidth="1.2" />}
      {shape === 'sleepy' && <path d="M25-25 L31-25 L25-19 L31-19 M34-33 L38-33 L34-29 L38-29" fill="none" stroke={ink} strokeWidth="1.7" />}
      {shape === 'love' && <g fill="#e58e7d" opacity=".65"><ellipse cx="-25" cy="6" rx="5" ry="3" /><ellipse cx="27" cy="6" rx="5" ry="3" /></g>}
      {landmarks && <circle data-landmark="nose" cx="1" cy="1" r="0" />}
      <path d="M0-1 L2 2 L-1 2" fill="none" stroke="#8b693c" strokeWidth="1.7" />
      {gulp ? <ellipse cx="5" cy="14" rx="3.8" ry="6.3" />
        : shape === 'sleepy' ? <ellipse cx="5" cy="15" rx="3" ry="3.6" />
          : smile ? <g stroke={ink}>
            <path d="M-13 9 Q1 15 18 9 L15 17 Q0 20-10 15Z" fill={thread} strokeWidth="2.4" />
            <path d="M1 13 L2 17 M10 12 L10 16" strokeWidth="1.4" />
          </g>
            : shape === 'love' ? <path d="M-11 10 Q3 21 17 10" fill="none" stroke={ink} strokeWidth="2.6" />
              : <path d={mouth ?? mouths.flat} fill="none" stroke={ink} strokeWidth="2.9" />}
      {landmarks && <circle data-landmark="mouth" cx="5" cy="14" r="0" />}
    </g>
  )
}
