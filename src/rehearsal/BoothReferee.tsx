import { useId, type ReactNode } from 'react'
import './booth-referee.css'

export type RefereeMood = 'idle' | 'listening' | 'correct' | 'incorrect' | 'uncertain' | 'unjudged'

const phosphor = '#d1ed9d'
const ink = '#29272a'
export const refereeLabels = {
  correct: 'Guessed it!', incorrect: 'Miss!', uncertain: 'Too close to call', unjudged: 'Score unavailable',
} as const
const marks: Record<keyof typeof refereeLabels, string> = {
  correct: 'm2 7 3 3 7-8',
  incorrect: 'm3 3 7 7m0-7-7 7',
  uncertain: 'M3 4q0-3 4-3 3 0 3 3 0 2-2 3L7 8m0 3v.2',
  unjudged: 'm2 3 3 2 2-3 2 3 3-2m-9 6 3-2 2 3 3-3',
}

// The glass looks towards the performer at the left of the bench. Eyes are kept apart from the
// rest of the face so they can blink and glance on their own.
const faces: Record<RefereeMood, { features: ReactNode; eyes?: string }> = {
  idle: { features: <path d="m26 38 9 1m10-1 9-2m-16 12 6-.5" />, eyes: 'M26 39h3v3h-3zm18-1h3v3h-3z' },
  listening: { features: <path d="m25 33 8-2m12 2 8-2m-15 18 4-.5" />, eyes: 'M27 36h3v6h-3zm18-1h3v6h-3z' },
  correct: { features: <path d="m25 38 4-4 5 2m10 .5 4-4 5 2m-20 9 4 3 5-.5 5-4" /> },
  incorrect: { features: <path d="m24 35 10 1m10-3 9-3m-19 17 11-1" />, eyes: 'M28 38h3v3h-3zm18-2h3v4h-3z' },
  uncertain: { features: <path d="m24 37 9 1m12-3 9-3m-20 15 5-1 3 2 5-2" />, eyes: 'M26 39h3v3h-3zm19-3h3v4h-3z' },
  unjudged: { features: <path d="m23 37 6-1 2 3 5-6 3 4 5-.5 2-3 3 4 7-1M33 47l3-.3m5-.4 2-.2" strokeWidth="2" /> },
}
const glass = 'M19 28q.2-5 4-5.4l33-3q5 0 5.5 4L64 48q.2 4-4 4.7l-35 2q-4 0-4.2-3.4z'
// A fixed scatter of snow for a ruling the referee could not make.
const snow = Array.from({ length: 46 }, (_, i) => ({ x: 18 + (i * 37) % 47, y: 19 + (i * 23) % 37, w: 1 + (i % 3) * .8 }))
const scanlines = Array.from({ length: 19 }, (_, i) => 20 + i * 1.9)

/** The clerk has been a single beige computer since somebody retired the last judge. */
/**
 * The clerk has been a single beige computer since somebody retired the last judge. Its tube hums:
 * scanlines roll, the eyes blink and wander, it thinks in dots while Stubbs talks, beams and sparkles
 * at a hit, flashes red and shudders at a miss, and fills with snow when it cannot rule at all.
 */
export function BoothReferee({ mood = 'idle', className }: { mood?: RefereeMood; className?: string }) {
  const receipt = mood === 'idle' || mood === 'listening' ? null : mood
  const clip = useId().replace(/:/g, '') + '-glass'
  const face = faces[mood]

  return <div className={className ? `ba-referee ${className}` : 'ba-referee'}
    data-testid="booth-referee" data-referee-mood={mood}>
    <svg className="ba-referee-art" viewBox="0 0 160 110" aria-hidden="true" focusable="false">
      <g stroke={ink} strokeLinejoin="round" strokeLinecap="round">
        {/* The prompt corner has one open side. The other returns into the timber wing. */}
        <g strokeWidth="1.5">
          <g className="ba-referee-wall-ties" fill="#65503c" stroke="#3e3228">
            <path d="m149 18 26-6 2 3-27 8z" />
            <path d="m146 87 29-7 .5 6-29 7z" />
            <path d="m157 85 16-4" fill="none" stroke="#a2835e" strokeWidth="1" />
          </g>
          {/* The jamb continues past the shelf into the wing. A diagonal iron carries the load. */}
          <path d="m145 7 10-4 1 114-8 7-4-3z" fill="#624a37" stroke="#322b25" />
          <path d="m152 14 1 97m-4-7 .2 13" stroke="#977450" strokeWidth="1.25" fill="none" />
          <path d="m108 99 36 15 5-2 .1 6-6 2-38-19z" fill="#4c4d41" stroke="#2d302c" />
          <path d="m141 108 10-4v16l-9 4z" fill="#57594a" />
          <circle cx="147" cy="109" r="1.5" fill="#b3a183" strokeWidth=".8" />
          <circle cx="146" cy="119" r="1.4" fill="#b3a183" strokeWidth=".8" />
          <path d="m32 25 92-11 25-8 1 82-18 12-99-1z" fill="#493b31" />
          <path d="m41 32 82-10 1 66-84 5z" fill="#55453a" stroke="none" />
          <path d="m124 20 24-10 1 74-24 7z" fill="#392f29" />
          <path d="m130 23 13-6m-13 11 13-6m-13 11 13-6" fill="none" stroke="#625346" strokeWidth="1.15" />
          <path d="m30 27 7-3 3 72-8-.9z" fill="#705643" />
          <path d="m26 22 101-13 24-7-1 7-22 9-100 12z" fill="#937453" />
          <path d="m28 23 99-12 18-6" fill="none" stroke="#c3a176" strokeWidth="1.35" />
          <path d="m128 17 22-9" stroke="#564332" fill="none" />
          {/* Bent reading light. Its tiny pool of amber light falls on the back flat. */}
          <path d="m144 22-6-2-6 4-.5 4" fill="none" strokeWidth="3" />
          <path d="m126 25 7-1 8 6-22 5z" fill="#5e503c" />
          <path d="m119 34 22-4-2 3-16 4z" fill="#ffe1a0" stroke="#b28c56" strokeWidth=".8" />
          <path d="m122 37 16-4-13 39-38-1z" fill="#e2a254" opacity=".18" stroke="none" />
          {/* The mains lead terminates in the side wall, with a little screwed-on socket. */}
          <path d="m135 62 8-3v10l-8 3z" fill="#736a58" />
          <path d="m135 66-2 .8-1 3 6-2-.1-3z" fill="#302c28" />
          <path d="m103 76q10-1 13 6 3 7 9 3 6-3 8-16" stroke="#201f1d" strokeWidth="2.6" fill="none" />
          {/* A cantilever shelf with a real return and a shadow underneath. */}
          <path d="m6 91 105 2 43-15-1 14-29 13-34 4-78-8z" fill="#322a25" />
          <path d="m7 90 31-11 108-3 11 5-36 15-113 1z" fill="#947352" />
          <path d="m15 90 17-6 85-3m9 .3 15-1.8m-51 6 39-1" fill="none" stroke="#b5956c" strokeWidth="1.1" />
          <path d="m119 96 38-15-.3 9-38 16z" fill="#604b3a" />
          <path d="m130 98 18-7" fill="none" stroke="#7d6246" />
        </g>
        <g transform="translate(17 15) scale(.95)">
          <path d="M8 84q42-7 108 0-35 7-108 0" fill="#484439" opacity=".18" stroke="none" />
          {/* The mains lead loops over the old swivel stand. */}
          <path d="m91 60 8 3q14 3 12 10-1 6-10 7-6 0-5-4 1-3 6-4" fill="none" strokeWidth="2.5" />
          <path d="m14 69 64-5 20 5-.6 11-20 6-64-3-2-4Z" fill="#aaa08b" strokeWidth="2.8" />
          <path d="m14 69 63-5 20 5-20 6-65-.5z" fill="#e1d4b7" strokeWidth="1.7" />
          <path d="m18 77 38 .1-.1 2H18z" fill={ink} strokeWidth=".7" />
          <path d="m60 78 9-.3" stroke="#847867" strokeWidth="1.5" />
          <path d="m35 61 4 5-5 2q14 5 32-.5l-7-3 1-6z" fill="#958b78" strokeWidth="2" />
          <g className="ba-referee-set">
            {/* The molded plastic tube is angled away from the audience. */}
            <path d="M11 20q1-8 9-9L66 7q8-1 14 2l26 11q4 2 4 8l-4 27-22 13-12-3-58-2z" fill="#aaa28c" strokeWidth="3" />
            <path d="m66 8 15 7 22 7 6 1-25 11-9-5z" fill="#c3bca4" stroke="none" />
            <path d="m82 21 22 5-3 24-19 11z" fill="#9b9581" strokeWidth="1.4" />
            <path d="m88 30 11-3m-11 7 11-3m-12 8 12-4m-13 8 12-4m-13 8 11-4" fill="none" strokeWidth="1.25" />
            <path d="M11 20q.5-6 7-7l47-4q6-.4 8 5l5 43q.5 7-5 8l-55 2q-6 0-7-6Z" fill="#d9d0b4" strokeWidth="2.8" />
            <path d="m13.8 27 .1-6q.2-5 4-5l43-4.1" stroke="#fff4d7" fill="none" strokeWidth="1.5" />
            <path d="M16 27q0-6 6-7l35-3q7-.5 8 5l2 27q.7 5-5 6l-40 2q-5 0-5-5z" fill="#817f6b" strokeWidth="1.8" />
            <path d="M19 28q.2-5 4-5.4l33-3q5 0 5.5 4L64 48q.2 4-4 4.7l-35 2q-4 0-4.2-3.4z" fill="#263f3a" strokeWidth="1.7" />
            <path d="m24 27 9-1m-8 4 4-.4" stroke="#648477" fill="none" strokeWidth="1.1" />
            <g className="ba-referee-face" fill="none" stroke={phosphor} strokeWidth="2.7" strokeLinecap="square">
              {face.features}
              {face.eyes && <path className="ba-referee-eyes" d={face.eyes} fill={phosphor} stroke="none" />}
            </g>
            <defs><clipPath id={clip}><path d={glass} /></clipPath></defs>
            <g clipPath={`url(#${clip})`} pointerEvents="none" stroke="none">
              {mood === 'listening' && <g className="ba-referee-dots" fill={phosphor}>
                <rect x="36.5" y="49.5" width="2" height="2" /><rect x="40.5" y="49.3" width="2" height="2" /><rect x="44.5" y="49.1" width="2" height="2" />
              </g>}
              {mood === 'correct' && <g className="ba-referee-sparkle" fill="none" stroke={phosphor} strokeWidth="1.2" strokeLinecap="square">
                <path d="M22 27h3m-1.5-1.5v3M57 25h3m-1.5-1.5v3M58 45h3m-1.5-1.5v3" />
              </g>}
              {mood === 'uncertain' && <path className="ba-referee-query" d="M55 24.5q0-2.4 2.4-2.4t2.4 2.2q0 1.6-2 2.4v1.6m0 2.2v.3"
                fill="none" stroke={phosphor} strokeWidth="1.3" strokeLinecap="square" />}
              {mood === 'incorrect' && <rect className="ba-referee-flash" x="17" y="18" width="50" height="40" fill="#ff5a48" opacity="0" />}
              {mood === 'unjudged' && <g className="ba-referee-snow" fill="#e9f3d4">
                {snow.map(({ x, y, w }, i) => <rect key={i} x={x} y={y} width={w} height=".9" opacity={.35 + (i % 4) * .15} />)}
              </g>}
              <g className="ba-referee-scanlines" stroke="#0a1512" strokeWidth=".7" opacity=".32">
                {scanlines.map(y => <path key={y} d={`M17 ${y}h50`} />)}
              </g>
              <rect className="ba-referee-scanbar" x="17" y="14" width="50" height="5" fill={phosphor} opacity=".09" />
            </g>
            <path d="m20 61 12-.6m2.7-.1 3-.2" stroke="#7e7967" strokeWidth="1.25" />
            <circle className="ba-referee-led" cx="67" cy="59" r="2" fill={mood === 'unjudged' ? '#ce6748' : mood === 'listening' ? '#e8b04e' : '#8da868'} strokeWidth="1.1" />
            <path d="m71 12-5 5 2 3-4 3" fill="none" stroke="#796e62" strokeWidth="1.2" />
            {/* Two barrister's paper tabs clipped over the stand. */}
            <path d="m40 61 11-.7 2 3-3.9 2.1-6.5-1z" fill="#43423d" strokeWidth="1.2" />
            <path d="m43 63.6 4.5-.2-1.1 7.7-4.9-.4zm5.6-.4 3.1-.5 2.8 7-4.2 1.5z" fill="#fff5d7" strokeWidth="1.2" />
          </g>
        </g>
        {/* The worn leading edge is painted last: the computer sits behind it. */}
        <path d="m4 91 115 3 2 12-113-3z" fill="#72553c" strokeWidth="2.1" />
        <path d="m5.5 91 106 2.5 7-.9.5 2.1-112-1z" fill="#d2b382" stroke="none" />
        <path d="m10 99 20 1 6-.4m45-.1 13 .4m8 .1 10 .4" stroke="#967552" fill="none" strokeWidth="1" />
        <g fill="#bfa17a" stroke="#3b3027" strokeWidth="1">
          <circle cx="11" cy="97" r="1.8" /><circle cx="115" cy="99" r="1.8" /><circle cx="151" cy="87" r="1.5" />
        </g>
      </g>
    </svg>
    <div className="ba-referee-name">
      <strong>Judge Monitor</strong><small><span>AI </span>referee</small>
    </div>
    <div className="ba-referee-slip-holder" aria-hidden="true">
      {receipt && <span key={mood} className="ba-referee-slip" data-testid="referee-slip">
        <svg viewBox="0 0 14 13" aria-hidden="true" focusable="false"><path d={marks[receipt]} fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {refereeLabels[receipt]}
      </span>}
    </div>
  </div>
}
