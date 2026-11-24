import type { CSSProperties } from 'react'
import type { Point } from '../puppet/geometry'
import './ghost-hand.css'

// One closed outline, so the glove fills cleanly on any backdrop. Its fingertip is at (8, 2).
const glove = 'M6 14V4a2 2 0 0 1 4 0v5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82z'
const knuckles = 'M10 9v2.6M14 10v2.2M18 11v1.8'

function Glove({ transform }: { transform?: string }) {
  return <g className="ba-glove" transform={transform}><path d={glove} /><path d={knuckles} fill="none" /></g>
}

/** The white glove of a silent tutorial. Its fingertip, the hot spot, sits 33% across and 8% down. */
export function GhostHand({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={'ba-ghost-hand ' + className} style={style} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false"><Glove /></svg>
  </span>
}

/** On a player's first game the glove shows, on the real puppet, that a hand can be dragged. */
export function StageCoach({ wrist }: { wrist: Point }) {
  return <svg className="ba-stage-coach" viewBox="0 0 500 360" aria-hidden="true" focusable="false">
    <g transform={`translate(${wrist.x} ${wrist.y})`}>
      <path className="ba-stage-coach-path" d="M0 0Q-38-50-26-112" />
      <g className="ba-stage-coach-hand">
        <circle className="ba-stage-coach-ring" r="15" />
        <Glove transform="translate(-13.6 -3.4) scale(1.7)" />
      </g>
    </g>
  </svg>
}
