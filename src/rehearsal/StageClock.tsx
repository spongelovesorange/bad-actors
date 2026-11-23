import './stage-clock.css'

export type ClockMode = 'running' | 'paused' | 'expired' | 'finished'

const captions: Record<ClockMode, string> = {
  running: 'TIME LEFT',
  paused: 'PAUSED',
  expired: 'TIME’S UP',
  finished: 'FINAL TIME',
}

type StageClockProps = { seconds: number; mode: ClockMode; className?: string }

/** The numbers are driven by the round clock. The loose tile only acts up at ten seconds. */
export function StageClock({ seconds, mode, className }: StageClockProps) {
  const count = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0
  const digits = String(count).padStart(2, '0')
  const urgent = count <= 10 && mode === 'running'
  const split = digits.slice(0, -1)
  const announcement = mode === 'running'
    ? urgent ? 'Ten seconds or less.' : 'Clock running.'
    : { paused: 'Clock paused.', expired: 'Time is up.', finished: 'Round finished.' }[mode]

  return <div className={className ? `ba-clock ${className}` : 'ba-clock'}
    data-testid="stage-clock" data-mode={mode} data-seconds={count} data-urgent={urgent || undefined}>
    <span className="ba-clock-sr" role="timer" aria-label="Round clock">{captions[mode]}, {count} {count === 1 ? 'second' : 'seconds'} remaining</span>
    <span className="ba-clock-sr" role="status">{announcement}</span>
    <svg aria-hidden="true" focusable="false" viewBox="0 0 124 72" width="124" height="72">
      {/* A wire through the left lug. The right lug has been patched with a strip of tape. */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="m7 11 4-6 97-1 8 4-2 51-5 7-100-1-6-5z" fill="#282524" stroke="#201f20" strokeWidth="2.3" />
        <path d="m9 10 4-4 92-1 8 4-2 48-4 6-97-1-5-5z" fill="#475956" stroke="#262524" strokeWidth="2" />
        <path d="m11 13 3-4 82-2m-80 51 88 1" fill="none" stroke="#aead92" strokeWidth="1.15" />
        <path d="m93 7 14-5 2 2 1-1 5 10-2 1 1 2-14 4z" fill="#c8af78" stroke="#535548" strokeWidth="1" />
        <path d="m100 10 7-3m-6 6 10-4" stroke="#917951" strokeWidth="1" />
        <circle cx="12.5" cy="19" r="3.4" fill="#bbad82" stroke="#292829" strokeWidth="1.4" />
        <path d="m10.4 20.5 4.3-3.1" stroke="#494739" strokeWidth="1.3" />
        <path d="m15 25 8 1-7 3 3 4-6 3" fill="none" stroke="#283330" strokeWidth="1.3" />
        <path d="m21 22 72-1 2 34-73 2z" fill="#252726" stroke="#252726" strokeWidth="2" />
        <rect x="25" y="23" width="31" height="30" rx="1.5" className="ba-clock-stock" />
        <path d="m26 25 27-1" stroke="#fff4d8" strokeWidth=".7" />
        <text className="ba-clock-digit" x="40.5" y="48" textAnchor="middle" textLength={split.length > 1 ? 27 : undefined}
          lengthAdjust="spacingAndGlyphs">{split}</text>
        <g className="ba-clock-loose">
          <path d="m59 22 32 1-1 31-29 .2-3-2z" className="ba-clock-stock" />
          <path d="m61 24 28 .8" stroke="#fff4d8" strokeWidth=".7" />
          <text className="ba-clock-digit" x="75" y="48.5" textAnchor="middle">{digits.slice(-1)}</text>
          <circle cx="61.2" cy="24.4" r="1.15" fill="#665a44" />
        </g>
        <path d="m26 38 28-.3m6 .4 28 .6" stroke="#423e32" strokeWidth=".55" opacity=".36" />
        <text x="57" y="17" className="ba-clock-caption" textAnchor="middle">{captions[mode]}</text>
        <text x="104" y="43" className="ba-clock-unit" textAnchor="middle">SEC</text>
        <path d="m98 47 10-.4" stroke="#b1b59b" strokeWidth="1" />
        <path className="ba-clock-stress" d="m115 23 4-5m-3 11 6-2m-6 7 4 2" fill="none" stroke="#bb4334" strokeWidth="2.4" />
      </g>
    </svg>
  </div>
}
