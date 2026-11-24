import type { CSSProperties } from 'react'
import './stage-verdict-effects.css'

const ticketInks = ['#f6be57', '#85c0b2', '#ed7e61', '#e8c7cf', '#e7ddab']
const heckles = ['Wrong show, Stubbs!', 'Bravo. Wrong play.', 'Try the other lens!']
const scraps = [
  { left: 3, drift: 16 }, { left: 8, drift: -12 }, { left: 14, drift: 17 },
  { left: 21, drift: -13 }, { left: 28, drift: 12 }, { left: 33, drift: -14 },
  { left: 66, drift: 13 }, { left: 72, drift: -15 }, { left: 78, drift: 10 },
  { left: 84, drift: -18 }, { left: 91, drift: 12 }, { left: 97, drift: -17 },
]

function Streamers({ side }: { side: 'left' | 'right' }) {
  return <svg className={'ba-wing-streamers ba-streamers-' + side} viewBox="0 0 128 164" focusable="false">
    <g transform={side === 'left' ? undefined : 'translate(128 0) scale(-1 1)'} fill="none" strokeLinejoin="round">
      <g className="ba-ribbon ba-ribbon-outer">
        <path d="M18-11C3 11 13 29 29 36s14 20-2 27S6 80 11 96s23 23 17 37l-5 13"
          stroke="#49352b" strokeWidth="8" />
        <path d="M18-11C3 11 13 29 29 36s14 20-2 27S6 80 11 96s23 23 17 37l-5 13"
          stroke={side === 'left' ? '#f5ba4c' : '#80bfb1'} strokeWidth="6" />
        <path d="M34 53q-2 6-9 9M11 92q0 8 7 15" stroke="#805839" strokeWidth="5.6" />
      </g>
      <g className="ba-ribbon ba-ribbon-inner">
        <path d="M65-8q-17 18-8 25t22 15q11 14-8 23t-7 21l10 11q5 9-6 19l-4 7"
          stroke="#583b31" strokeWidth="6.5" />
        <path d="M65-8q-17 18-8 25t22 15q11 14-8 23t-7 21l10 11q5 9-6 19l-4 7"
          stroke={side === 'left' ? '#78b7a6' : '#ed8669'} strokeWidth="4.8" />
        <path d="m72 55-7 4m7 41-5 7" stroke="#7e6753" strokeWidth="4" />
      </g>
    </g>
  </svg>
}

function TicketShower() {
  return <div className="ba-ticket-shower">
    <Streamers side="left" /><Streamers side="right" />
    {scraps.map(({ left, drift }, i) => <span key={left} className="ba-ticket-fall" style={{
      left: left + '%', '--ticket-drift': drift + 'px', '--ticket-start': (i * 167) % 620 + 'ms',
      '--ticket-tilt': (i % 2 ? 22 : -38) + 'deg', '--ticket-perch': (8 + (i * 17) % 61) + '%',
      color: ticketInks[i % ticketInks.length],
    } as CSSProperties}>
      <svg className="ba-ticket-scrap" viewBox="0 0 23 14" focusable="false" fill="none">
        <path d="m2 2 18-1 1 3q-3 1 .5 3l.5 3-19 2-1-3q3-2-1-3z" fill="currentColor" stroke="#523f32" strokeWidth="1.1" />
        <path d="m7 3 .5 7m3-5 6-.5m-5 2.7 3-.3" stroke="#725944" strokeWidth="1" strokeDasharray={i % 3 ? undefined : '2 1'} />
      </svg>
    </span>)}
  </div>
}

/** Cropped spectators seen from behind; their elbows stay rooted in the front stalls. */
function Clapper({ side }: { side: 'left' | 'right' }) {
  return <svg className={'ba-front-clapper ba-clapper-' + side} viewBox="0 0 112 83" focusable="false">
    <g stroke="#302a25" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 94q0-23 6-29l16-9 20 1 17 9q7 12 8 30Z" fill={side === 'left' ? '#4b655c' : '#7d4b40'} />
      <g className="ba-clap-pair">
        <g className="ba-clap-arm ba-clap-arm-l">
          <path d="m32 75-12-16-6-19 9-4 10 16 10 12Z" fill="#596359" />
          <path d="m15 43-4-8-6-7q-2-4 2-4l6 5-3-11q0-4 3-3l6 11-1-14q0-4 4-3l3 15 2-10q1-4 4-2l-1 14 4-6q4-3 5 0l-6 13q-3 6-10 9z" fill="#dcb77c" />
          <path d="m18 33 5 4m-9 4 9-4" fill="none" stroke="#8d704c" strokeWidth="1.2" />
        </g>
        <g className="ba-clap-arm ba-clap-arm-r">
          <path d="m72 69 6-19 5-13 10 4-1 19-9 19z" fill="#596359" />
          <path d="m84 42-7-5q-6-5-8-16-1-4 3-3l5 8-3-15q0-4 3-3l5 14-1-16q1-4 4-2l4 17 2-11q1-3 4-1l-1 16 4-6q3-2 5 1l-5 12-6 10z" fill="#e8c48c" />
          <path d="m80 31 5 4m-2 3 9 3" fill="none" stroke="#8d704c" strokeWidth="1.2" />
        </g>
      </g>
      {side === 'left' ? <>
        <path d="M38 49q0-11 12-15t23 2q9 9 2 22l-9 8-17-2-9-8z" fill="#655147" />
        <path d="m37 45 3-9 8-4 2-10 11 4 10-5 4 10 8 5-3 11-15-5-13 2z" fill="#4b4b43" />
      </> : <>
        <path d="M36 48q-2-11 6-15l12-5q15-1 22 10 4 8-3 20l-8 8-16-3-8-8z" fill="#615048" />
        <path d="M32 42q9-7 24-6l22 3 5 7-18-3-16 1-16 5z" fill="#ad8461" />
        <path d="m39 38 3-12 8-5 17 1 7 13" fill="#8c6756" />
      </>}
      <path d="M26 88q-2-9 3-11l51-2q6 0 6 7v6Z" fill="#713f38" />
      <path d="m34 79 43-2" fill="none" stroke="#aa6755" strokeWidth="1.5" />
    </g>
    <g className="ba-clap-rays" fill="none" stroke="#ffe6a4" strokeWidth="2.3" strokeLinecap="round">
      <path d="m45 19-3-7m12 5 2-9m7 13 5-5" />
    </g>
  </svg>
}

function PartyBlower() {
  return <svg className="ba-heckle-horn" viewBox="0 0 133 70" focusable="false">
    <g stroke="#302a25" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m84 74 2-18 5-8 16-1 14 8 8 19z" fill="#50645d" />
      <path d="m92 46-6-3 3-5-3-3 5-2q0-13 12-15 14-2 17 9 3 11-5 19l-6 7-13-1z" fill="#b58c66" />
      <path d="m84 29 6-6 5-12 12-3 10 4 5 11 5 3-3 3-20-3-13 5z" fill="#6c5748" />
      <path d="m91 23 23-3 6 4-25 1z" fill="#ae7d64" />
      <path d="m91 34 5-1" fill="none" />
      <path d="m83 39 10-2 1 5-13 2z" fill="#d69e51" />
      <g className="ba-heckle-paper">
        <path d="m85 38-18 1q-18 2-29-6-10-7-21-5Q6 30 7 39q2 7 9 4 5-2 2-7" fill="none" stroke="#382e27" strokeWidth="7" />
        <path d="m85 38-18 1q-18 2-29-6-10-7-21-5Q6 30 7 39q2 7 9 4 5-2 2-7" fill="none" stroke="#eed098" strokeWidth="4.8" />
        <path d="m74 37-1 4m-9-3-2 4m-9-6-2 4m-8-7-2 4m-7-8-2 4m-9-6 1 4" fill="none" stroke="#bf6153" strokeWidth="2" />
      </g>
      <path d="m90 64 21-3 13 4 4 10H87z" fill="#74443a" />
    </g>
  </svg>
}

type Props = { verdict: 'correct' | 'incorrect'; performanceKey: string }

export function StageVerdictEffects({ verdict, performanceKey }: Props) {
  const slot = Array.from(performanceKey).reduce((total, letter) => total + letter.charCodeAt(0), 0) % heckles.length
  const heckle = performanceKey === 'opening-guess' ? 'Bold interpretation.' : heckles[slot]
  return <div key={performanceKey} className="ba-stage-verdict" data-testid="stage-verdict-effects"
    data-verdict={verdict} aria-hidden="true">
    {verdict === 'correct' ? <>
      <TicketShower />
      <Clapper side="left" /><Clapper side="right" />
      <span className="ba-house-call ba-house-encore">Encore!</span>
    </> : <>
      <PartyBlower />
      <span className="ba-house-call ba-house-heckle">{heckle}</span>
    </>}
  </div>
}
