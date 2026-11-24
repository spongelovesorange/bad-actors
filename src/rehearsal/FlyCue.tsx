import type { RefObject } from 'react'
import './fly-cue.css'

type FlyCueProps = {
  title: string
  covered: boolean
  reveal: boolean
  /** Changes as each act begins, so the board swings down again when the curtain opens. */
  drop?: number
  headingRef: RefObject<HTMLHeadingElement | null>
}

/** Someone replaced the right-hand counterweight with a boot and its own red lace. */
export function FlyCue({ title, covered, reveal, drop, headingRef }: FlyCueProps) {
  return <div className="ba-fly-cue" data-testid="fly-cue" data-covered={covered || undefined}
    data-reveal={reveal || undefined} aria-live="polite" aria-atomic="true">
    <div className="ba-fly-mechanism" key={drop ?? 'set'} data-drop={drop !== undefined || undefined}>
      <svg className="ba-fly-rig" viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden="true">
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M32 -4 34 16 32 29" stroke="#372a20" strokeWidth="4.7" />
          <path d="m31 0 2.9 4.6-2 1.2 2.3 4.4-1.6 1.1 1.8 4.3-2.6 4.9 1.2 2.4-2 4" stroke="#e0bf80" strokeWidth="1.7" />
          <path d="M181 30 185 19 204 2Q209 -1 211 5L218 35" stroke="#392a24" strokeWidth="4.2" />
          <path d="M181 30 185 19 204 2Q209 -1 211 5L218 35" stroke="#ce6247" strokeWidth="2" />
          <circle cx="207" cy="2" r="4.5" stroke="#342b24" strokeWidth="2" fill="#98866a" />
          <circle cx="207" cy="2" r="1.4" fill="#392f25" />
        </g>
      </svg>
      <div className="ba-fly-plank">
        <div className="ba-fly-paper">
          <h2 key={title} className="ba-fly-cue-title" id="ba-cue-heading" ref={headingRef} tabIndex={-1}>{title}</h2>
        </div>
      </div>
      <svg className="ba-fly-boot" viewBox="0 0 40 43" fill="none" aria-hidden="true">
        <g stroke="#30261e" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
          <path d="m11 0 2 10 5 3" stroke="#c56948" strokeWidth="2.5" />
          <path d="m6 10 11-2 4 6-1 9 5 4 8 2 3 3-1 5-14-1-14-4-3-3z" fill="#885534" />
          <path d="m8 12 9-2 3 4-6 3-6-2z" fill="#40392d" />
          <path d="m7 27 6 3 11 4 11 1-1 4-12-1-18-6z" fill="#d3b585" />
          <path d="m16 17 5 2-5 1 6 2-4 1 5 2" stroke="#f4b092" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  </div>
}
