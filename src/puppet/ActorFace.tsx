import { clamp, type FaceShape } from './geometry'
import { stillMotion, type PuppetMotion } from './motion'

const ink = '#302d27'
const thread = '#eee1b9'

type FaceProps = { shape: FaceShape; motion?: PuppetMotion; landmarks?: boolean; gazeX?: number; gazeY?: number }

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
    const pupilX = x + gaze
    const pupilY = eyeY + (sideways ? 0 : gazeY) + (smile && right ? 1.5 : 0)
    return (
      <g>
        {eyeWhite > 0 && !wince && <ellipse cx={x} cy={eyeY} rx={5.5 + 1.3 * surprise} ry={gulp ? 6.3 : 4.1} fill={thread} fillOpacity={eyeWhite} />}
        {wince
          ? <path d="M-20-10 L-11-6 L-20-3" fill="none" stroke={ink} strokeWidth="2.7" />
          : <circle cx={pupilX} cy={pupilY} r={gulp ? 2.3 : 2.8} />}
        {landmarks && <circle data-landmark={right ? 'right-eye' : 'left-eye'} cx={pupilX} cy={pupilY} r="0" />}
      </g>
    )
  }
  return (
    <g data-face={shape} fill={ink} strokeLinecap="round" strokeLinejoin="round">
      {eye(false)}{eye(true)}
      {sideways && <path d="M-22-11 L-10-11 M8-13 L19-11" fill="none" stroke={ink} strokeWidth="2.5" />}
      {braced && <path d="M9-14 L19-10" fill="none" stroke={ink} strokeWidth="2.9" />}
      {smile && <path d="M9-10 Q15-13 20-10 M-21-14 L-13-15" fill="none" stroke={ink} strokeWidth="2" />}
      {(gulp || surprise > 0) && <g opacity={gulp ? 1 : surprise} fill="none" stroke={ink} strokeWidth="2">
        <path d="M-20-16 L-13-18 M12-18 L18-17" />
      </g>}
      {landmarks && <circle data-landmark="nose" cx="1" cy="1" r="0" />}
      <path d="M0-1 L2 2 L-1 2" fill="none" stroke="#8b693c" strokeWidth="1.7" />
      {gulp ? <ellipse cx="5" cy="14" rx="3.8" ry="6.3" />
        : smile ? <g stroke={ink}>
          <path d="M-13 9 Q1 15 18 9 L15 17 Q0 20-10 15Z" fill={thread} strokeWidth="2.4" />
          <path d="M1 13 L2 17 M10 12 L10 16" strokeWidth="1.4" />
        </g>
        : <path d={sideways ? 'M-2 15 L11 15 L16 11' : braced ? 'M-10 17 L-6 13 L1 15 L6 12 L13 14' : 'M-4 14 L10 14'} fill="none" stroke={ink} strokeWidth="2.9" />}
      {landmarks && <circle data-landmark="mouth" cx="5" cy="14" r="0" />}
    </g>
  )
}
