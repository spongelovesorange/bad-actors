import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ArrowRight, Eye, Volume2, VolumeX } from 'lucide-react'
import type { PuppetPose, PuppetStageApi } from '../puppet'
import type { CriticMood } from './AudienceCritic'
import { CriticDelivery } from './CriticDelivery'
import { refereeLabels, type RefereeMood } from './BoothReferee'
import { FrontRowRail } from './FrontRowRail'
import { StageVerdictEffects } from './StageVerdictEffects'
import { createCrowdAudio } from './crowd-audio'
import { AudienceRound, localAudience, quietAudience, type AudienceState, type AudienceClient, type Verdict } from './audience-round'
import { photographActor } from './audience-frame'
import { modelIssue } from './audience-issue'
import type { ClockReading, PlayMode } from './acting-clock'
import './audience.css'

type Availability = 'checking' | Awaited<ReturnType<AudienceClient['status']>>
type SeatProps = {
  children: ReactNode; clock: ReactNode; flyCue: ReactNode
  client?: AudienceClient; publicEntry: boolean; requestedPlay?: PlayMode
  openingVerdict?: 'correct' | 'incorrect'
  mode: PlayMode | null; canRehearse: boolean; cue: number; pose: PuppetPose
  player: RefObject<HTMLDivElement | null>; stage: RefObject<PuppetStageApi | null>
  onStart: (mode: PlayMode) => void; onLeave: () => void; onNext: () => void
  onClock: (reading: ClockReading | null) => void
}

const reaction: Record<Verdict, CriticMood> = {
  correct: 'hit', incorrect: 'miss', uncertain: 'guess', unjudged: 'guess',
}

export function AudienceSeat({ children, clock, flyCue, openingVerdict, client = localAudience, publicEntry, requestedPlay, mode, canRehearse, cue, pose, stage, player, onStart, onLeave, onNext, onClock }: SeatProps) {
  const active = mode !== null
  const [availability, setAvailability] = useState<Availability>('checking')
  const [statusCheck, setStatusCheck] = useState(0)
  const opened = useRef(false)
  const hosted = client.mode === 'hosted'
  const localServer = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
    && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)
  const [state, setState] = useState<AudienceState>(quietAudience)
  const [heardObservation, setHeardObservation] = useState<string>()
  const crowdAudio = useRef<ReturnType<typeof createCrowdAudio> | null>(null)
  const [crowdSound, setCrowdSound] = useState<'off' | 'on' | 'unavailable'>('off')
  const lastCrowdCue = useRef<string | null>(null)
  const [playingCrowdCue, setPlayingCrowdCue] = useState<string | null>(null)
  useEffect(() => () => {
    crowdAudio.current?.dispose()
    crowdAudio.current = null
  }, [])
  async function toggleCrowdSound() {
    if (crowdAudio.current) {
      crowdAudio.current.dispose()
      crowdAudio.current = null
      setCrowdSound('off')
      return
    }
    const speaker = createCrowdAudio()
    crowdAudio.current = speaker
    const enabled = await speaker.enable()
    if (speaker !== crowdAudio.current) return
    if (!enabled) {
      crowdAudio.current = null
      speaker.dispose()
    }
    setCrowdSound(enabled ? 'on' : 'unavailable')
  }
  const lastHeard = useRef<{ id: string; at: number } | null>(null)
  const markDelivered = useCallback((id: string) => {
    if (lastHeard.current?.id === id) return
    lastHeard.current = { id, at: Date.now() }
    setHeardObservation(id)
  }, [])
  const round = useRef<AudienceRound | null>(null)
  const lastPose = useRef(pose)
  const latestPose = useRef(pose)
  useLayoutEffect(() => { latestPose.current = pose }, [pose])
  useEffect(() => {
    if (!hosted && !localServer) {
      setAvailability('offline')
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => { setAvailability('offline'); controller.abort() }, 5000)
    client.status(controller.signal)
      .then(result => { if (!controller.signal.aborted) setAvailability(result) })
      .catch(() => { if (!controller.signal.aborted) setAvailability('offline') })
      .finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); controller.abort() }
  }, [client, hosted, localServer, statusCheck])

  useEffect(() => {
    if (!requestedPlay || availability !== 'live' || opened.current || active) return
    opened.current = true
    onStart(requestedPlay)
  }, [active, availability, requestedPlay, onStart])

  useLayoutEffect(() => {
    setState(quietAudience)
    if (mode !== 'draw') onClock(null)
    if (!mode) return
    lastPose.current = latestPose.current
    const controller = new AudienceRound(
      cue, client, () => stage.current?.isSettled() === true,
      () => photographActor(player.current), setState, () => !document.hidden, mode === 'draw' ? onClock : undefined,
      id => lastHeard.current?.id === id ? lastHeard.current.at : undefined,
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
  }, [mode, cue, stage, player, onClock, client])
  useEffect(() => {
    if (lastPose.current !== pose) {
      lastPose.current = pose
      round.current?.poseChanged()
    }
  }, [pose])

  const last = state.history.at(-1)
  const looking = state.phase === 'looking' || state.phase === 'starting'
  const finished = state.phase === 'complete'
  const timeUp = state.end === 'timeout'
  const offline = availability === 'offline' || availability === 'unconfigured' || (!publicEntry && availability === 'signin')
  const readyToStart = availability === 'live' || (publicEntry && availability === 'signin')
  const localFile = offline && typeof window !== 'undefined' && window.location.protocol === 'file:'
  let offlineDetail: ReactNode = 'Live guesses are available in the local AI rehearsal.'
  if (hosted) {
    offlineDetail = 'The AI booth is unavailable. Try the connection again.'
    if (availability === 'signin') offlineDetail = 'Your sign-in has expired. Refresh to sign in again.'
    if (availability === 'unconfigured') offlineDetail = 'Hosted AI hasn’t been enabled yet. You can still practice or guess with a friend.'
  } else if (localFile || localServer) {
    offlineDetail = <>For live guesses on this Mac, open <b>Play-Bad-Actors.command</b>.</>
  }
  // The image reader can finish before the referee does. A retry keeps the words already heard.
  const pending = state.pendingGuess
  const scored = !pending && !looking && !state.issue && active && !timeUp && !offline ? last : undefined
  const observation = active && !timeUp && !offline ? pending ?? scored : undefined
  const verdict = scored && scored.observationId === heardObservation ? scored.verdict : undefined
  const finishingLine = Boolean(scored && !verdict)
  const ruling = active ? verdict : openingVerdict
  const crowdVerdict = ruling === 'correct' || ruling === 'incorrect' ? ruling : undefined
  const performanceKey = crowdVerdict ? (active ? scored?.observationId : 'opening-guess') : undefined
  useEffect(() => {
    if (!performanceKey || !crowdVerdict) {
      setPlayingCrowdCue(null)
      crowdAudio.current?.stop()
      return
    }
    if (lastCrowdCue.current === performanceKey) return
    lastCrowdCue.current = performanceKey
    if (!document.hidden) {
      setPlayingCrowdCue(performanceKey)
      crowdAudio.current?.play(crowdVerdict)
    }
  }, [performanceKey, crowdVerdict])
  const referee: RefereeMood = ruling ?? (observation && !state.issue ? 'listening' : 'idle')
  let mood: CriticMood = verdict ? reaction[verdict] : observation ? 'guess' : 'idle'
  let speech = observation?.guess ?? (active ? 'My squint is ready.' : 'I’ll take a guess.')
  if (looking && !observation) { mood = 'looking'; speech = state.phase === 'starting' ? 'My usual seat.' : 'Just a squint…' }
  if (state.issue && !observation) { mood = 'error'; speech = state.issue }
  if (timeUp) { mood = 'miss'; speech = 'Was that the bell or my hearing aid?' }
  if (offline) { mood = 'idle'; speech = 'Off duty. My seat’s still warm.' }
  if (!active && openingVerdict) {
    mood = openingVerdict === 'correct' ? 'hit' : 'guess'
    speech = openingVerdict === 'correct' ? 'I knew that.' : 'Tough crowd.'
  }

  return <section className="ba-audience" data-testid="ai-audience" data-phase={state.phase}
    data-mode={mode ?? undefined} data-end={state.end} data-verdict={verdict} data-service={availability} aria-label="AI audience">
    <div className="ba-scene-floor">
    {flyCue}
    {children}
    {clock}
    <div className="ba-audience-comic">
      <span className="ba-sr ba-critic-announcement" role="status" aria-live="polite" aria-atomic="true">{speech}</span>
      <span className="ba-sr ba-referee-announcement" role="status" aria-live="polite" aria-atomic="true">
        {ruling && `Judge Monitor: ${refereeLabels[ruling]}`}
      </span>
      <CriticDelivery key={JSON.stringify([cue, mode, observation?.observationId, speech])}
        line={speech} mood={mood} observationId={observation?.observationId}
        referee={referee} onDelivered={markDelivered}
        animate={(publicEntry || availability !== 'checking') && (Boolean(observation) || (!state.issue && state.phase !== 'error'))} />
    </div>
    <FrontRowRail />
    {crowdVerdict && performanceKey && playingCrowdCue === performanceKey &&
      <StageVerdictEffects key={performanceKey} verdict={crowdVerdict} performanceKey={performanceKey} />}
    </div>
    <div className="ba-front-desk">
    <header className="ba-audience-head">
      <h2>Stage controls</h2>
      <span>{active ? `${state.used} / ${state.limit} looks` : offline ? 'Booth closed' : publicEntry && readyToStart ? 'AI booth' : availability === 'live' ? 'AI audience ready' : 'Checking connection…'}</span>
    </header>
    <button className="ba-crowd-sound" type="button" aria-label="Crowd sound" aria-pressed={crowdSound === 'on'} onClick={toggleCrowdSound}>
      {crowdSound === 'on' ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
      Crowd sound <span>{crowdSound === 'on' ? 'On' : 'Off'}</span>
    </button>
    {crowdSound === 'unavailable' && <span role="status" className="ba-audience-message">Crowd sound couldn’t start in this browser.</span>}
    {timeUp && <p className="ba-audience-message" role="status">Time! Draw another cue to play again.</p>}
    {state.issue && observation && <p className="ba-audience-message" role="status">{state.issue}</p>}
    {state.message && <p className="ba-audience-message" role="status">{state.message}</p>}
    {verdict === 'unjudged' && <p className="ba-audience-message" role="status">
      {modelIssue('referee', scored?.judgeFailure)}{!finished && ' Change the pose for another look.'}
    </p>}
    {finished && state.used >= state.limit && last?.verdict !== 'correct' && <p className="ba-audience-message"><strong>Out of looks.</strong> Curtain down on this one.</p>}
    {!active ? <div className="ba-audience-footer ba-box-office">
      {offline ? <><span>{offlineDetail}</span>
        {(localServer || hosted) && <button type="button" className="ba-audience-rehearse" onClick={() => {
          setAvailability('checking')
          setStatusCheck(check => check + 1)
        }}>Recheck connection</button>}</>
        : <button type="button" className="ba-audience-call" onClick={() => onStart('draw')} disabled={!readyToStart}>
          {!readyToStart ? 'Checking the booth…' : publicEntry ? 'Visit AI booth' : 'Play with AI'} <ArrowRight size={17} aria-hidden="true" />
        </button>}
      {readyToStart && canRehearse && <button type="button" className="ba-audience-rehearse"
        onClick={() => onStart('rehearse')}>Try this cue with AI</button>}
    </div> : <>
      <div className="ba-audience-footer">
        {finished && !finishingLine
          ? <button type="button" className="ba-audience-call ba-audience-next" onClick={onNext}>{mode === 'draw' ? 'Draw another cue' : 'Play next cue'} <ArrowRight size={16} aria-hidden="true" /></button>
          : <button type="button" className="ba-audience-call" disabled={looking || finishingLine || state.recovery === 'daily-limit' || state.recovery === 'change-pose'} onClick={() => round.current?.ask()}>
            {state.recovery === 'restart' ? 'Restart this cue' : state.recovery === 'daily-limit' ? 'Daily looks used'
              : state.recovery === 'change-pose' ? 'Change your pose' : state.phase === 'error' ? 'Try again'
                : finishingLine ? 'Hearing Stubbs…' : looking ? (pending ? 'Waiting for the referee…' : 'In the booth…') : 'Guess this pose'} <Eye size={15} aria-hidden="true" /></button>}
        <button type="button" className="ba-audience-leave" onClick={onLeave}>Stop AI</button>
      </div>
      {state.history.length > 0 && <details className="ba-audience-log">
        <summary>What Stubbs saw ({state.history.length})</summary>
        <ol>{state.history.map((look) => <li key={look.observationId}>
          <img src={look.image} alt={`Pose from look ${look.used}`} width="58" height="58" />
          <span><b>{look.guess}</b>{(look.observationId !== observation?.observationId || verdict) && <small>{refereeLabels[look.verdict]}</small>}</span>
        </li>)}</ol>
      </details>}
    </>}
    </div>
  </section>
}
