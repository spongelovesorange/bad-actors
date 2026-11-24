import { memo } from 'react'
import type { TwistId } from '../deck'
import type { Jaw } from './critic-speech'
import './critic-life.css'

export type CriticMood = 'idle' | 'looking' | 'guess' | 'miss' | 'hit' | 'error'

const ink = '#282527'
const ivory = '#fff0ca'
const enamel = '#619090'
const brass = '#e4ac53'
const cherry = '#ad493a'

function OperaGlasses() {
  return (
    <g transform="rotate(-7 63 42)" stroke={ink} strokeWidth="2.3" strokeLinejoin="round">
      <path d="m56 39 4-8 10-1 3 8m3 1 6-10 9-1 3 10" fill={brass} />
      <path d="M67 39q6-5 13-1v5q-8-3-12 2z" fill={cherry} />
      <ellipse cx="62" cy="40" rx="9" ry="8.5" fill={brass} />
      <ellipse cx="85" cy="38" rx="10" ry="9" fill={brass} />
      <ellipse cx="63" cy="40" rx="5.4" ry="5.6" fill="#315160" />
      <ellipse cx="86" cy="38" rx="6.3" ry="6.2" fill="#315160" />
      <circle cx="66" cy="37.3" r="1.5" fill={ivory} stroke="none" />
      <circle cx="89.6" cy="34" r="2" fill={ivory} stroke="none" />
    </g>
  )
}

function Programme() {
  return (
    <g transform="rotate(-8 79 70)" stroke={ink} strokeWidth="2" strokeLinejoin="round">
      <path d="m39 50 29 2 9 5 6-4 26-3-6 35-24 7-11-6-23-2z" fill={ivory} />
      <path d="m43 47 27 3 8 5 8-4 26-4-6 35-23 7-8 3-8-6-22-4z" fill="#e4ba6a" />
      <path d="m78 56-3 33m-27-34 18 2m-17 4 15 2m-14 4 9 1" fill="none" strokeWidth="1.2" />
      <path d="m94 56 1.5 6 6 .4-5 4 1 6-5-3.6-5.5 3.5 1.7-6-4-3.7 6-.9z" fill={cherry} strokeWidth="1" />
      <path d="m41 68 7 1 2 5-5 2-5-4m64-4q7-5 8 0l-3 8-5 1" fill={ivory} />
    </g>
  )
}

function PunchedTicket() {
  return (
    <g transform="rotate(-12 100 61)">
      <path fill="#96bd92" fillRule="evenodd" stroke={ink} strokeWidth="1.9"
        d="M80 55h43v5q-4 3 0 6v5H80v-5q3-3 0-6Zm26 2.5-2 4-4.5.6 3.2 3.2-.9 4.5 4.2-2.1 4.1 2.1-.8-4.5 3.2-3.2-4.6-.6Z" />
      <path d="m88 57-.2 12m28-12-.2 11" fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 2" />
    </g>
  )
}

function UsherArm() {
  return <g transform="translate(63 68)" strokeWidth="1.7">
    <g className="ba-usher-arm">
      <path d="M0-3q13-2 27 1l-.5 5Q11 4 0 2z" fill={enamel} />
      <g transform="translate(26 0)">
        <circle r="3.5" fill={brass} />
        <g className="ba-usher-forearm">
          <path d="M1-2q9 1 22-1l2 5q-13 2-23 1" fill={ink} />
          <path d="m20-3 4-.9 1.7 6-4.7.8z" fill={cherry} />
          <path d="m24-2 1.2-4q.8-3 2.4-1.7l-.2 4.4 5.5-4.4q2.3-1.2 2.6.9l-3.8 4.1 4.5-2.1q2-.6 1.5 1.3l-4.4 3.8q-1.8 2-5.6 2l-3.4-1.4z" fill={ivory} />
        </g>
      </g>
    </g>
  </g>
}

/** Stubbs is a box-office punch. The visor is the lever and the mouth actually issues tickets. */
/**
 * He breathes, blinks, glances between the stage and you, and yawns when nothing happens. A hit
 * makes him hop with his eyes screwed up in glee; a miss sends him shivering behind his programme.
 * Each night tints him too: Big Feelings brings tears, the Gala a glare at the balcony.
 */
export const AudienceCritic = memo(function AudienceCritic({ mood = 'idle', jaw = 'closed', gesture = 'rest', night, className }: {
  mood?: CriticMood; jaw?: Jaw; gesture?: 'rest' | 'raise' | 'hold'; night?: TwistId; className?: string
}) {
  const lean = { idle: 4, looking: 7, guess: 4, miss: -2, hit: 5, error: 0 }[mood]
  const wide = mood === 'guess' || mood === 'error'
  return (
    <svg className={className} viewBox="0 0 134 120" width="134" height="120" aria-hidden="true" focusable="false"
      data-critic-mood={mood} data-jaw={jaw} data-gesture={gesture} data-volunteering={gesture === 'raise'} data-night={night}
      data-gaze="upstage-right" style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
      <g stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {/* The bent metal legs and red, sprung chair stay put as he leans out. */}
        <path d="M12 112q26-4 56-2l41 2-12 3-62 1z" fill={ink} stroke="none" opacity=".15" />
        <path d="m22 53 13 42-6 17m29-20 5 17" fill="none" strokeWidth="5" />
        <path d="M12 56q-2-7 3-11 6-3 10 3l11 30q1 5-4 8-6 3-9-4z" fill={cherry} strokeWidth="2.8" />
        <path d="m16 51 8 23" fill="none" stroke="#df8c6b" strokeWidth="1.8" />
        <path d="m28 86 46-3q8 0 8 5l-2 5-44 5q-8 0-8-7z" fill={cherry} strokeWidth="2.8" />
        <path d="m34 89 37-3" stroke="#d58469" strokeWidth="1.5" />
        <path d="m50 83 3 12 15 8m-2-20 8 9 12 4" fill="none" strokeWidth="6" />
        <path d="m60 100 5 3m13-8 5 3" stroke={ivory} strokeWidth="3" />
        <path d="m64 99 7 2 12-1q7 1 6 5l-16 6-8-1zM82 93l7 1 11-5q5-1 6 4l-9 7-12 2z" fill={ink} strokeWidth="2" />
        <path d="m70 108 15-5m5-5 11-6" stroke={ivory} strokeWidth="1.1" />
        <g transform={`rotate(${lean} 49 81)`}>
          <g className="ba-critic-body">
          {/* The ticket roll peeks out of the back of the cast-iron housing. */}
          <path d="m36 58-9-7q-7-8 0-15l10-8 4 3q-7 12 0 17l6 4z" fill={ivory} strokeWidth="2" />
          <path d="m28 42 8-8m-6 13 6-5" stroke={cherry} strokeWidth="1.6" />
          <path d="M34 49q-1-13 7-21l12-4 24 2 13 9 3 15-9 8 2 6 11 1-1 12-8 8-48 1-7-9z" fill={enamel} strokeWidth="3.2" />
          <path d="m36 47 6-7 5 3-2 25-10 5z" fill="#3e656b" strokeWidth="1.4" />
          <path d="m37 62 4-2m-4 6 4-2" stroke={ivory} strokeWidth="1.2" opacity=".72" />
          <path d="M34 70q7 4 18 3l42-3-2 9-8 3-43 1-6-5z" fill="#466b72" strokeWidth="1.6" />
          <path d="m39 72 4 4m0-7 6 7m25 3 10-1" stroke={ivory} strokeWidth="1.1" opacity=".68" />
          {/* A black open jaw and the small brass cutting die remain visible in profile. */}
          <path d="m50 49 37-9 9 5 5 4-2 6-9 1-1 8-26 2-8-4z" fill={ink} strokeWidth="2" />
          <g className="ba-critic-tongue">
            {mood === 'hit' ? <PunchedTicket /> : mood === 'error' ?
              <path d="m81 59 16-4-3 9 9-5-1 10 8-2-3 8-13-1 1-7-9 1 4-8-10 4z" fill={ivory} strokeWidth="1.8" /> :
              <path d={mood === 'guess' ? 'm78 59 22-4 2 4-3 2 3 1-1 3-24 1z' : 'm79 59 13-2 1 4-3 2 3 1-1 2-15-.4z'} fill="#f1c467" strokeWidth="1.3" />}
          </g>
          <g className="ba-critic-upper">
            <path d="m88 54 7-.6-2 6-4 1z" fill={ivory} strokeWidth="1.1" />
            <path d="m37 37 9-10 35 2 11 6-1 14-7 4-34 3-11-4z" fill={brass} strokeWidth="2" />
            {/* Foreshortened far eye, larger near eye. Both pupils sight the upper-right stage. */}
            <path d="M55 40q4-4 10-4l-.4 7q-3.5 6-8.6 2z" data-eye-socket="far" fill={ivory} strokeWidth="1.5" />
            <path d="M71 37q5-5 15-5l-.2 8q-3 7-12 6l-2-3z" data-critic-eye="" data-eye-socket="near" fill={ivory} strokeWidth="1.5" />
            <g className="ba-critic-gaze">
              <ellipse data-pupil="far" cx="62.5" cy="39" rx="1.8" ry={wide ? '2.7' : '2.2'} fill={ink} stroke="none" />
              <ellipse data-critic-pupil="" data-pupil="near" cx="82.8" cy="35.9" rx="2.25" ry={wide ? '3' : '2.5'} fill={ink} stroke="none" />
            </g>
            {/* Glee screws both eyes shut; on Big Feelings night a tear rolls out of the near one. */}
            {mood === 'hit' && <path className="ba-critic-glee" d="M56 42.5q4-5.5 9-1.4M72.5 39.5q6-7 13-1.6" fill="none" strokeWidth="2.3" />}
            {night === 'feel' && (mood === 'guess' || mood === 'hit') &&
              <path className="ba-critic-tear" d="M84 45q-2.6 4.2 0 6.3q2.6-2.1 0-6.3z" fill="#a9d6ea" strokeWidth="1" />}
            <path className="ba-critic-lid" d="M54.6 39.6q4.2-4.4 10.8-4.3l-.4 7.8q-3.8 6.3-9 2.4z" fill={brass} strokeWidth="1.5" />
            <path className="ba-critic-lid" d="M70.6 36.6q5.2-5.4 15.6-5.3l-.2 8.6q-3.3 7.4-12.5 6.4l-2.2-3.3z" fill={brass} strokeWidth="1.5" />
            {!wide && <path d="m53 40 10-4m6.8 2.1 13.2-5.7" strokeWidth="2.5" />}
            {/* Peaked usher's cap and a punch handle are the same piece of bent brass. */}
            <path d="m31 30 4-10 14-4 24 3 12 8-5 4-33 5-9 1z" fill={enamel} strokeWidth="2.8" />
            <path d="m33 23 6-4 10-2 21 3" fill="none" stroke={ivory} strokeWidth="1.5" />
            <path d="m40 30 34-5 15 1 19 3-4 4-37 1-26 3z" fill={ink} strokeWidth="1.8" />
            <path d="m52 29 21-3" stroke={brass} strokeWidth="1.7" />
          </g>
          <circle cx="41" cy="52" r="8.7" fill={brass} strokeWidth="2" />
          <circle cx="41" cy="52" r="3.5" fill={enamel} strokeWidth="1.5" />
          <path d="m39.5 53.4 3-3" strokeWidth="1.2" />
          {mood === 'looking' ? <g className="ba-critic-glasses">
            <path d="m42 66 10-6 8-16" fill="none" strokeWidth="6.2" />
            <OperaGlasses />
            <path d="m58 48 2-4 4-1 2 3-4 4z" fill={ivory} strokeWidth="1.4" />
          </g> : mood === 'miss' ? <Programme /> : <UsherArm />}
          {mood === 'miss' && <path className="ba-critic-sweat" d="M33 31q-3 5 0 7q3-2 0-7z" fill="#a9d6ea" strokeWidth="1.2" />}
          </g>
        </g>
        {/* Seen from behind the aisle: the seat back cuts across the near side of his coat. */}
        <path d="M10 59q-1-5 4-6l21-2q4 0 5 5l5 22q1 4-3 6l-18 6q-5 2-7-3z" fill="#813831" strokeWidth="2.7" />
        <path d="m13 59 20-4q3-.5 4 2l4 17-22 7z" fill="#a5483b" strokeWidth="1.6" />
        <path d="m18 61 13-2m-9 18 16-4" fill="none" stroke="#d78368" strokeWidth="1.1" />
        <circle cx="20" cy="83" r="1.65" fill={brass} strokeWidth="1" />
        <circle cx="39" cy="77" r="1.4" fill={brass} strokeWidth="1" />
      </g>
    </svg>
  )
})
