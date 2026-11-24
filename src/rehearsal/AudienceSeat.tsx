import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { ArrowRight, Drama, Eye, Flag, Timer, Volume2, VolumeX } from 'lucide-react'
import type { PuppetPose, PuppetStageApi } from '../puppet'
import type { CriticMood } from './AudienceCritic'
import { deck, type TwistId } from '../deck'
import { CriticDelivery } from './CriticDelivery'
import { refereeLabels, type RefereeMood } from './BoothReferee'
import { FrontRowRail } from './FrontRowRail'
import { GhostHand } from './GhostHand'
import { RaceCodeForm } from './RaceBoard'
import { StageVerdictEffects } from './StageVerdictEffects'
import { useStageSound } from './StageSound'
import { AudienceRound, localAudience, quietAudience, type AudienceState, type AudienceClient, type Verdict } from './audience-round'
import { photographActor } from './audience-frame'
import { modelIssue } from './audience-issue'
import type { ClockReading, PlayMode } from './acting-clock'
import './audience.css'

type Availability = 'checking' | Awaited<ReturnType<AudienceClient['status']>>
/** How a round ended, for the evening's running total. */
export type RoundEnd = { guessed: boolean; looks: number; line?: string; image?: string }
type SeatProps = {
  children: ReactNode; clock: ReactNode; flyCue: ReactNode
  /** Shown above the tickets before a game, such as the opening guess. */
  lobby?: ReactNode
  /** Extra buttons beside the Ready button during a game. */
  cueTools?: ReactNode
  /** The cue's hint, opened from cueTools and shown under them. */
  cueHint?: ReactNode
  /** Where the tutorial glove taps: the Free play ticket, or Ready once a newcomer has posed. */
  beckon?: 'ticket' | 'ready'
  /** Stubbs's first words as a game begins. Each night has its own. */
  opener?: string
  /** Seconds per timed act. */
  actSeconds?: number
  /** Tonight's trouble, for Stubbs's manner. */
  night?: TwistId
  /** "Act 2 of 5" during a show. */
  actLabel?: string
  nextLabel?: string
  onRoundEnd?: (result: RoundEnd) => void
  /** Whether this round is over, and whether Stubbs got it, in free play as in a show. */
  onRoundOver?: (end: { guessed: boolean } | null) => void
  /** In a race the desk holds the race board, and the race deals the rounds: no tickets, no Next or Stop buttons. */
  raceBoard?: ReactNode
  /** Opens a race room: the third ticket, offered on the signed-in stage. */
  onRace?: () => void
  /** Whether Stubbs is looking and how many looks are spent, for the other racers' boards. */
  onProgress?: (progress: { looking: boolean; looks: number }) => void
  client?: AudienceClient; publicEntry: boolean; requestedPlay?: PlayMode
  firstLook: boolean; paused: boolean
  openingVerdict?: 'correct' | 'incorrect'
  mode: PlayMode | null; cue: number; pose: PuppetPose
  player: RefObject<HTMLDivElement | null>; stage: RefObject<PuppetStageApi | null>
  onStart: (mode: PlayMode, fromRoomLink?: boolean) => void; onLeave: () => void; onNext: () => void
  onClock: (reading: ClockReading | null) => void
}

// Stubbs fills the wait between looks; the line rotates so a long round doesn't repeat itself.
const squints = ['Just a squint…', 'Hold it. Art takes time.', 'Polishing my monocle…', 'My programme’s upside down. One moment.', 'Squinting professionally…']

const reaction: Record<Verdict, CriticMood> = {
  correct: 'hit', incorrect: 'miss', uncertain: 'guess', unjudged: 'guess',
}

export function AudienceSeat({ firstLook, paused, children, clock, flyCue, lobby, cueTools, cueHint, beckon, opener, actSeconds = 45, night, actLabel, nextLabel, onRoundEnd, onRoundOver, raceBoard, onRace, onProgress, openingVerdict, client = localAudience, publicEntry, requestedPlay, mode, cue, pose, stage, player, onStart, onLeave, onNext, onClock }: SeatProps) {
  const active = mode !== null
  const [availability, setAvailability] = useState<Availability>('checking')
  const [statusCheck, setStatusCheck] = useState(0)
  const opened = useRef(false)
  const hosted = client.mode === 'hosted'
  const localServer = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
    && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)
  const [state, setState] = useState<AudienceState>(quietAudience)
  const [heardObservation, setHeardObservation] = useState<string>()
  const { audio, mode: crowdSound, setPower, roomTone, setRoom, music, setMusic } = useStageSound()
  const lastCrowdCue = useRef<string | null>(null)
  const [playingCrowdCue, setPlayingCrowdCue] = useState<string | null>(null)
  const lastHeard = useRef<{ id: string; at: number } | null>(null)
  const markDelivered = useCallback((id: string) => {
    if (lastHeard.current?.id === id) return
    lastHeard.current = { id, at: Date.now() }
    setHeardObservation(id)
  }, [])
  const round = useRef<AudienceRound | null>(null)
  const pausedRef = useRef(paused)
  useLayoutEffect(() => { pausedRef.current = paused; round.current?.schedule() }, [paused])
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
    if (paused || !requestedPlay || availability !== 'live' || opened.current || active) return
    opened.current = true
    onStart(requestedPlay, true)
  }, [active, availability, requestedPlay, onStart, paused])

  const roundSerial = useRef(0)
  const reportedSerial = useRef(0)
  useLayoutEffect(() => {
    setState(quietAudience)
    roundSerial.current += 1
    if (mode !== 'draw') onClock(null)
    if (!mode) return
    lastPose.current = latestPose.current
    const controller = new AudienceRound(
      cue, client, () => stage.current?.isSettled() === true,
      () => photographActor(player.current), setState, () => !document.hidden && !pausedRef.current, mode === 'draw' ? onClock : undefined,
      id => lastHeard.current?.id === id ? lastHeard.current.at : undefined, true, actSeconds,
    )
    round.current = controller
    const visibility = () => controller.schedule()
    document.addEventListener('visibilitychange', visibility)
    void controller.start(firstLook)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      controller.dispose()
      round.current = null
    }
  }, [mode, cue, stage, player, onClock, client, firstLook, actSeconds])
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
    offlineDetail = <>For live guesses on this computer, run <b>npm run practice:ai</b>.</>
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
      audio.stopVerdict()
      return
    }
    if (lastCrowdCue.current === performanceKey) return
    lastCrowdCue.current = performanceKey
    if (!document.hidden) {
      setPlayingCrowdCue(performanceKey)
      audio.play(crowdVerdict)
    }
  }, [performanceKey, crowdVerdict, audio])
  // With stage sound on, the hosted Stubbs reads his line aloud. His glove stays up for up to six
  // seconds while the clip arrives; after that he falls back to his tin syllables.
  const voiceId = active && hosted && crowdSound === 'on' && observation?.line ? observation.observationId : undefined
  const voiceRound = observation?.roundId
  const [voice, setVoice] = useState<{ id: string; clip?: AudioBuffer; settled: boolean }>()
  useEffect(() => {
    if (!voiceId || !voiceRound) return
    let current = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    setVoice({ id: voiceId, settled: false })
    client.voice(voiceRound, voiceId, controller.signal)
      .then(bytes => audio.prepareLine(bytes))
      .catch(() => undefined)
      .then(clip => { if (current) setVoice({ id: voiceId, clip, settled: true }) })
      .finally(() => clearTimeout(timer))
    return () => { current = false; controller.abort(); clearTimeout(timer) }
  }, [voiceId, voiceRound, client, audio])
  const clip = voiceId && voice?.id === voiceId ? voice.clip : undefined
  const awaitingVoice = Boolean(voiceId) && !(voice?.id === voiceId && voice?.settled)
  const startLine = useCallback(() => { if (clip) audio.speakLine(clip) }, [clip, audio])
  // Report each finished round once, after Stubbs has had his say.
  const roundOver = active && (finished || timeUp) && !finishingLine
  const roundHit = roundOver && state.history.some(look => look.verdict === 'correct')
  useEffect(() => { onRoundOver?.(roundOver ? { guessed: roundHit } : null) }, [roundOver, roundHit, onRoundOver])
  useEffect(() => {
    if (!roundOver || !onRoundEnd || reportedSerial.current === roundSerial.current) return
    reportedSerial.current = roundSerial.current
    const hit = state.history.find(look => look.verdict === 'correct')
    const shown = hit ?? state.history.at(-1)
    onRoundEnd({ guessed: Boolean(hit), looks: state.used, line: shown?.line ?? shown?.guess, image: shown?.image })
  }, [roundOver, onRoundEnd, state.history, state.used])
  useEffect(() => { onProgress?.({ looking, looks: state.used }) }, [onProgress, looking, state.used])
  const beckonTicket = beckon === 'ticket' && !active && !offline && readyToStart
  const beckonReady = beckon === 'ready' && active && state.used === 0 && !looking && !finished && !timeUp
    && !finishingLine && !state.recovery && state.phase !== 'error'
  const picker = useRef<HTMLDivElement>(null)
  // After the demo, bring the way in to where the glove can be seen.
  useEffect(() => {
    if (!beckonTicket) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    picker.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [beckonTicket])
  const referee: RefereeMood = ruling ?? (observation && !state.issue ? 'listening' : 'idle')
  let mood: CriticMood = verdict ? reaction[verdict] : observation ? 'guess' : 'idle'
  let speech = observation?.line ?? observation?.guess ?? (active ? opener ?? 'My squint is ready.' : 'I’ll take a guess.')
  if (looking && !observation) { mood = 'looking'; speech = state.phase === 'starting' ? 'My usual seat.' : squints[state.used % squints.length] }
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
        referee={referee} onVoiceBeat={audio.speak} onDelivered={markDelivered}
        hold={awaitingVoice} pace={clip && clip.duration * 1000} onStart={startLine} night={night}
        animate={(publicEntry || availability !== 'checking') && (Boolean(observation) || (!state.issue && state.phase !== 'error'))} />
    </div>
    <FrontRowRail />
    {crowdVerdict && performanceKey && playingCrowdCue === performanceKey &&
      <StageVerdictEffects key={performanceKey} verdict={crowdVerdict} performanceKey={performanceKey} />}
    </div>
    <div className="ba-front-desk">
    <header className="ba-audience-head">
      <h2>Stage controls</h2>
      <span>{active ? `${actLabel ? actLabel + ' · ' : ''}${state.used} / ${state.limit} looks` : offline ? 'Booth closed' : publicEntry && readyToStart ? 'AI booth' : availability === 'live' ? 'AI audience ready' : 'Checking connection…'}</span>
    </header>
    <button className="ba-crowd-sound" type="button" aria-label="Stage sound" aria-pressed={crowdSound === 'on'} data-sound-power onClick={() => setPower(crowdSound !== 'on')}>
      {crowdSound === 'on' ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
      Stage sound <span>{crowdSound === 'on' ? 'On' : 'Off'}</span>
    </button>
    {crowdSound === 'on' && <>
      <button className="ba-room-tone" type="button" aria-pressed={music} onClick={() => setMusic(!music)}>Pit band <span>{music ? 'On' : 'Off'}</span></button>
      <button className="ba-room-tone" type="button" aria-pressed={roomTone} onClick={() => setRoom(!roomTone)}>Room tone <span>{roomTone ? 'On' : 'Off'}</span></button>
    </>}
    {crowdSound === 'unavailable' && <span role="status" className="ba-audience-message">Stage sound couldn’t start in this browser.</span>}
    {active && !timeUp && !finished && !looking && state.used === 0 && !state.issue && !state.message &&
      <p className="ba-audience-message ba-audience-direction">Strike the pose first. Stubbs looks only when you press <b>Ready</b>.</p>}
    {timeUp && <p className="ba-audience-message" role="status">Time’s up for this act.</p>}
    {state.issue && observation && <p className="ba-audience-message" role="status">{state.issue}</p>}
    {state.message && <p className="ba-audience-message" role="status">{state.message}</p>}
    {verdict === 'unjudged' && <p className="ba-audience-message" role="status">
      {modelIssue('referee', scored?.judgeFailure)}{!finished && ' Change the pose for another look.'}
    </p>}
    {finished && state.used >= state.limit && last?.verdict !== 'correct' && <p className="ba-audience-message"><strong>Out of looks.</strong> Curtain down on this one.</p>}
    {!active && raceBoard}
    {raceBoard && !active ? null : !active ? <div className={'ba-audience-footer ba-box-office' + (offline ? '' : ' ba-box-office-open')}>
      {lobby}
      {offline ? <><span>{offlineDetail}</span>
        {(localServer || hosted) && <button type="button" className="ba-audience-rehearse" onClick={() => {
          setAvailability('checking')
          setStatusCheck(check => check + 1)
        }}>Recheck connection</button>}</>
        // Two tickets are the way in: an untimed game with any cue, or the 45-second show.
        : <div className="ba-show-picker" role="group" aria-label="Play with Stubbs" ref={picker}>
          <button type="button" className="ba-show-ticket ba-show-free" onClick={() => onStart('rehearse')} disabled={!readyToStart}
            data-beckon={beckonTicket || undefined}>
            <Drama size={28} aria-hidden="true" />
            <span><b>Free play</b><small>{readyToStart ? `Any of ${deck.length} cues. Strike a pose, no clock.` : 'Checking the booth…'}</small></span>
            <ArrowRight className="ba-show-arrow" size={22} aria-hidden="true" />
            {beckonTicket && <GhostHand className="ba-beckon-hand" />}
          </button>
          <button type="button" className="ba-show-ticket ba-show-timed" onClick={() => onStart('draw')} disabled={!readyToStart}>
            <Timer size={28} aria-hidden="true" />
            <span><b>Timed show · 5 acts</b><small>{readyToStart ? '45 seconds an act. Unlock the next level.' : 'Checking the booth…'}</small></span>
            <ArrowRight className="ba-show-arrow" size={22} aria-hidden="true" />
          </button>
          {onRace && <button type="button" className="ba-show-ticket ba-show-race" onClick={onRace} disabled={!readyToStart}>
            <Flag size={28} aria-hidden="true" />
            <span><b>Race a friend</b><small>{readyToStart ? 'Same cue on two stages. First to make Stubbs say it wins.' : 'Checking the booth…'}</small></span>
            <ArrowRight className="ba-show-arrow" size={22} aria-hidden="true" />
          </button>}
          {onRace && <RaceCodeForm label="Got a race code from a friend?" from="room" />}
        </div>}
    </div> : <>
      <div className="ba-audience-footer">
        {finished && !finishingLine
          ? !raceBoard && <button type="button" className="ba-audience-call ba-audience-next" onClick={onNext}>{nextLabel ?? (mode === 'draw' ? 'Draw another cue' : 'Play next cue')} <ArrowRight size={16} aria-hidden="true" /></button>
          : <button type="button" className="ba-audience-call ba-guess-now" disabled={looking || finishingLine || state.recovery === 'daily-limit' || state.recovery === 'change-pose'} onClick={() => round.current?.ask()}
            data-beckon={beckonReady || undefined}>
            {state.recovery === 'restart' ? 'Restart this cue' : state.recovery === 'daily-limit' ? 'Daily looks used'
              : state.recovery === 'change-pose' ? 'Change your pose' : state.phase === 'error' ? 'Try again'
                : finishingLine ? 'Hearing Stubbs…' : looking ? (pending ? 'Waiting for the referee…' : 'In the booth…') : 'Ready! Guess, Stubbs'} <Eye size={18} aria-hidden="true" />
            {beckonReady && <GhostHand className="ba-beckon-hand" />}</button>}
        {cueTools}
        {!raceBoard && <button type="button" className="ba-audience-leave" onClick={onLeave}>Stop AI</button>}
      </div>
      {cueHint}
      {raceBoard}
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
