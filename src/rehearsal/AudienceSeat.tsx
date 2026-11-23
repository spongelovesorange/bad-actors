import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ArrowRight, Check, CircleHelp, Eye, PlugZap, X } from 'lucide-react'
import type { PuppetPose, PuppetStageApi } from '../puppet'
import { AudienceCritic, type CriticMood } from './AudienceCritic'
import { AudienceRound, localAudience, quietAudience, type AudienceState, type Verdict } from './audience-round'
import { photographActor } from './audience-frame'
import type { ClockReading, PlayMode } from './acting-clock'
import './audience.css'

type Availability = 'checking' | 'live' | 'offline'
type SeatProps = {
  mode: PlayMode | null; canRehearse: boolean; cue: number; pose: PuppetPose
  player: RefObject<HTMLDivElement | null>; stage: RefObject<PuppetStageApi | null>
  onStart: (mode: PlayMode) => void; onLeave: () => void; onNext: () => void
  onClock: (reading: ClockReading | null) => void
}

const rulings = {
  correct: { label: 'Guessed it!', aside: 'A standing ovation. From my chair.', mood: 'hit', icon: Check },
  incorrect: { label: 'Miss!', aside: 'Someone printed my programme upside down.', mood: 'miss', icon: X },
  uncertain: { label: 'Too close to call', aside: 'The jury requests a second squint.', mood: 'guess', icon: CircleHelp },
  unjudged: { label: 'Score unavailable', aside: 'The referee missed the curtain.', mood: 'error', icon: PlugZap },
} as const satisfies Record<Verdict, { label: string; aside: string; mood: CriticMood; icon: typeof Check }>

export function AudienceSeat({ mode, canRehearse, cue, pose, stage, player, onStart, onLeave, onNext, onClock }: SeatProps) {
  const active = mode !== null
  const [availability, setAvailability] = useState<Availability>('checking')
  const [state, setState] = useState<AudienceState>(quietAudience)
  const round = useRef<AudienceRound | null>(null)
  const lastPose = useRef(pose)
  const latestPose = useRef(pose)
  useLayoutEffect(() => { latestPose.current = pose }, [pose])
  useEffect(() => {
    if (!/^https?:$/.test(window.location.protocol) ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) {
      setAvailability('offline')
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => { setAvailability('offline'); controller.abort() }, 5000)
    fetch('/api/local-ai/status', { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => response.ok && response.headers.get('content-type')?.includes('application/json') && (await response.json() as { available?: boolean }).available === true)
      .then((live) => { if (!controller.signal.aborted) setAvailability(live ? 'live' : 'offline') })
      .catch(() => { if (!controller.signal.aborted) setAvailability('offline') })
      .finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); controller.abort() }
  }, [])

  useLayoutEffect(() => {
    setState(quietAudience)
    if (mode !== 'draw') onClock(null)
    if (!mode) return
    lastPose.current = latestPose.current
    const controller = new AudienceRound(
      cue, localAudience, () => stage.current?.isSettled() === true,
      () => photographActor(player.current), setState, () => !document.hidden, mode === 'draw' ? onClock : undefined,
    )
    round.current = controller
    const visibility = () => controller.schedule()
    document.addEventListener('visibilitychange', visibility)
    void controller.start()
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      controller.dispose()
      round.current = null
    }
  }, [mode, cue, stage, player, onClock])
  useEffect(() => {
    if (lastPose.current !== pose) {
      lastPose.current = pose
      round.current?.poseChanged()
    }
  }, [pose])

  const last = state.history.at(-1)
  const ruling = last && rulings[last.verdict]
  const looking = state.phase === 'looking' || state.phase === 'starting'
  const finished = state.phase === 'complete'
  const timeUp = state.end === 'timeout'
  const offline = availability === 'offline'
  const localFile = offline && typeof window !== 'undefined' && window.location.protocol === 'file:'
  let mood: CriticMood = ruling?.mood ?? 'idle'
  let speech = last?.guess ?? (active ? 'Whenever you’re ready. I’ve warmed up my squint.' : 'Give me a pose. I’ll tell you what it is.')
  if (looking) { mood = 'looking'; speech = state.phase === 'starting' ? 'Is this seat taken? It is now.' : 'Hold it. Which end of these is the front?' }
  if (state.phase === 'error') { mood = 'error'; speech = 'We appear to have lost the booth.' }
  if (timeUp) { mood = 'miss'; speech = 'Was that the bell or my hearing aid?' }
  if (offline) { mood = 'idle'; speech = 'Off duty. My seat’s still warm.' }

  return <section className="ba-audience" data-testid="ai-audience" data-phase={state.phase}
    data-mode={mode ?? undefined} data-end={state.end} data-verdict={last?.verdict} data-service={availability} aria-label="AI audience">
    <header className="ba-audience-head">
      <h2>AI audience</h2>
      <span>{active ? `${state.used} / ${state.limit} looks` : offline ? 'Booth closed' : 'Front row'}</span>
    </header>
    <div className="ba-audience-comic">
      <p className="ba-audience-balloon" role="status" aria-live="polite" aria-atomic="true">{speech}</p>
      <div className="ba-audience-seat-row">
        <div className="ba-critic-portrait"><AudienceCritic mood={mood} /><strong>Mr. Stubbs</strong></div>
        <div className="ba-critic-caption">
          {timeUp ? <><div className="ba-verdict" data-result="incorrect">Time!</div><p>The hook gives you a very gentle nudge.</p></> : ruling && !looking && state.phase !== 'error'
            ? <><div className="ba-verdict" data-result={last?.verdict}><ruling.icon size={17} aria-hidden="true" />{ruling.label}</div>
                <p>{ruling.aside}</p></>
            : <p>{offline ? 'I’m on my tea break. You can still pose for a friend.'
              : active ? 'Hold still for a look. Five guesses per cue.'
                : 'Draw a cue. Give this ticket punch 45 seconds of your finest acting.'}</p>}
        </div>
      </div>
    </div>
    {state.message && <p className="ba-audience-message" role="status">{state.message}</p>}
    {finished && state.used >= state.limit && last?.verdict !== 'correct' && <p className="ba-audience-message"><strong>Out of looks.</strong> Curtain down on this one.</p>}
    {!active ? <div className="ba-audience-footer ba-box-office">
      {offline ? <span>{localFile ? <>For live guesses on this Mac, open <b>Play-Bad-Actors.command</b>.</> : 'Connect a model to the local rehearsal for live guesses.'}</span>
        : <button type="button" className="ba-audience-call" onClick={() => onStart('draw')} disabled={availability !== 'live'}>
          {availability === 'checking' ? 'Checking the booth…' : 'Play with AI'} <ArrowRight size={17} aria-hidden="true" />
        </button>}
      {availability === 'live' && canRehearse && <button type="button" className="ba-audience-rehearse"
        onClick={() => onStart('rehearse')}>Try this cue with AI</button>}
    </div> : <>
      <div className="ba-audience-footer">
        {finished
          ? <button type="button" className="ba-audience-call ba-audience-next" onClick={onNext}>{mode === 'draw' ? 'Draw another cue' : 'Play next cue'} <ArrowRight size={16} aria-hidden="true" /></button>
          : <button type="button" className="ba-audience-call" disabled={looking || state.recovery === 'daily-limit'} onClick={() => round.current?.ask()}>
            {state.recovery === 'restart' ? 'Restart this cue' : state.recovery === 'daily-limit' ? 'Daily looks used'
              : state.phase === 'error' ? 'Try again' : looking ? 'In the booth…' : 'Guess this pose'} <Eye size={15} aria-hidden="true" /></button>}
        <button type="button" className="ba-audience-leave" onClick={onLeave}>Stop AI</button>
      </div>
      {state.history.length > 0 && <details className="ba-audience-log">
        <summary>What Stubbs saw ({state.history.length})</summary>
        <ol>{state.history.map((look) => <li key={look.observationId}>
          <img src={look.image} alt={`Pose from look ${look.used}`} width="58" height="58" />
          <span><b>{look.guess}</b><small>{rulings[look.verdict].label}</small></span>
        </li>)}</ol>
      </details>}
    </>}
  </section>
}
