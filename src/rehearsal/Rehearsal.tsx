import { memo, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  Eye,
  EyeOff,
  Hand,
  RefreshCw,
  RotateCcw,
  RotateCw,
  LogIn,
  X,
} from 'lucide-react'
import {
  PuppetStage,
  handShape,
  initialPose,
  phoneSamplePose,
  putDown,
  turnProp,
  withFace,
  withHandShape,
  withProp,
  type FaceShape,
  type PropKind,
  type PuppetPose,
  type PuppetStageApi,
} from '../puppet'
import { ServingTray } from '../puppet/PuppetArt'
import { Phone } from '../puppet/Phone'
import { ActorFace } from '../puppet/ActorFace'
import { isJoint, stageHandles } from '../puppet/geometry'
import { footAngle, turnFoot } from '../puppet/joints'
import { useStageSound } from './StageSound'
import { CastComic } from './CastComic'
import { AudienceSeat } from './AudienceSeat'
import { createAudience, type AudienceClient } from './audience-round'
import { StageClock } from './StageClock'
import { FlyCue } from './FlyCue'
import { drawAnotherCue, type ClockReading, type PlayMode } from './acting-clock'
import { checkOpeningGuess } from './opening-guess'
import { HandShapePicker, handShapeOptions } from './HandShapePicker'
import './rehearsal.css'

// These are public movement exercises. Live round assignments belong on the server.
const exercises = [
  { title: 'Drinking water', sketch: 'drink', note: 'Bring the cup rim to the mouth. Leave the eyes peeking over it.' },
  { title: 'Talking on the phone', sketch: 'call', note: 'Tuck the phone against one ear. Let the elbow hang below it.' },
  { title: 'Taking a selfie', sketch: 'selfie', note: 'Hold the phone high and out to one side, with daylight between it and the face. Give the free hand a peace sign.' },
  { title: 'Covering your eyes', sketch: 'eyes', note: 'Open both palms and bring one over each eye. Keep the mouth showing.' },
  { title: 'Surrendering', sketch: 'surrender', note: 'Empty both hands. Bend the elbows out and lift the open palms above the shoulders.' },
  { title: 'Carrying a tray', sketch: 'tray', note: 'Hold the tray level in front of the belly. Slide the other hand under its far rim.' },
]
const shelf: { kind: PropKind; label: string }[] = [
  { kind: 'phone', label: 'Phone' },
  { kind: 'cup', label: 'Cup' },
  { kind: 'plate', label: 'Tray' },
]
const faces: { shape: FaceShape; label: string }[] = [
  { shape: 'flat', label: 'Deadpan' },
  { shape: 'side-eye', label: 'Side-eye' },
  { shape: 'braced', label: 'Bracing' },
  { shape: 'smile', label: 'Forced smile' },
  { shape: 'open', label: 'Gulp' },
]
const fineJoints = new Set<string>(stageHandles.filter(isJoint))

const sessionKey = 'bad-actors:public-rehearsal:1'

type Phase = 'guess' | 'revealed' | 'practice'
type RehearsalSession = {
  phase: Phase
  cue: number
  pose: PuppetPose
  correct?: boolean
  cueHidden?: boolean
  askOnReturn?: boolean
}
type DialogKind = 'welcome' | 'help' | 'account'

function restoreSession(): RehearsalSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey)
    if (!raw) return null
    const saved = JSON.parse(raw) as RehearsalSession
    const p = saved.pose
    const base = initialPose()
    if (
      !['guess', 'revealed', 'practice'].includes(saved.phase) ||
      !Number.isInteger(saved.cue) ||
      saved.cue < 0 ||
      saved.cue >= exercises.length ||
      !p
    )
      return null
    if (
      ![p.left, p.right, p.head, p.propPosition].every(
        (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y),
      )
    )
      return null
    if (
      !faces.some((face) => face.shape === p.face) ||
      (p.prop !== null && !shelf.some((item) => item.kind === p.prop)) ||
      ![-1, 1].includes(p.leftBend) ||
      ![-1, 1].includes(p.rightBend) ||
      !['left', 'right', null].includes(p.holder) ||
      !Number.isFinite(p.propTurn) ||
      (p.joints !== undefined &&
        (!p.joints || typeof p.joints !== 'object' || Array.isArray(p.joints) ||
          Object.entries(p.joints).some(([name, point]) =>
            !fineJoints.has(name) || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y),
          ))) ||
      (p.handShapes !== undefined &&
        (!p.handShapes || typeof p.handShapes !== 'object' || Array.isArray(p.handShapes) ||
          Object.entries(p.handShapes).some(([side, shape]) =>
            (side !== 'left' && side !== 'right') || !handShapeOptions.some((option) => option.value === shape),
          ))) ||
      (p.footTurns !== undefined &&
        (!p.footTurns || typeof p.footTurns !== 'object' || Array.isArray(p.footTurns) ||
          Object.entries(p.footTurns).some(([side, degrees]) =>
            (side !== 'left' && side !== 'right') || !Number.isFinite(degrees) || Math.abs(degrees) > 100,
          ))) ||
      (p.pinned !== undefined &&
        (p.pinned === null || typeof p.pinned !== 'object' || Array.isArray(p.pinned) ||
          Object.values(p.pinned).some((pinned) => typeof pinned !== 'boolean')))
    )
      return null
    // Older saved poses predate free limbs. Keep their authored positions fixed.
    return { ...saved, pose: { ...base, ...p, pinned: p.pinned ?? { left: true, right: true, head: true } } }
  } catch {
    return null
  }
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <a className="ba-brand" href={href} aria-label="Bad Actors home">
      <img src="/favicon.svg" width="40" height="40" alt="" />
      <span>Community Hall Players</span>
    </a>
  )
}

const TopBar = memo(function TopBar({
  onHelp,
  accountControl,
}: {
  onHelp: () => void
  accountControl: ReactNode
}) {
  return (
    <header className="ba-masthead">
      <nav className="ba-wrap ba-nav" aria-label="Main navigation" data-testid="app-navigation">
        <Brand />
        <div className="ba-nav-actions">
          <button className="ba-help-button" type="button" onClick={onHelp}>
            <BookOpen size={17} aria-hidden="true" /> <span>How to play</span>
          </button>
          {accountControl}
        </div>
      </nav>
    </header>
  )
})

function PlayDialog({
  kind,
  close,
  compareMotion,
  bodyFollow,
  onBodyFollow,
}: {
  kind: DialogKind
  close: () => void
  compareMotion: boolean
  bodyFollow: boolean
  onBodyFollow: (follow: boolean) => void
}) {
  const { setPower } = useStageSound()
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  function dismiss() {
    if (leaving.current !== undefined) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { close(); return }
    setClosing(true)
    leaving.current = setTimeout(close, 125)
  }
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    node?.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true })
    return () => { clearTimeout(leaving.current); node?.close() }
  }, [])
  return (
    <dialog
      ref={ref} data-closing={closing || undefined}
      className={kind === 'account' ? 'ba-dialog' : 'ba-dialog ba-comic-book'}
      aria-labelledby="ba-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            dismiss()
        }
      }}
    >
      <button type="button" className="ba-dialog-x" aria-label="Close" onClick={dismiss}>
        <X size={19} />
      </button>
      {kind === 'account' ? <><div className="ba-stamp"><LogIn /></div><h2 id="ba-dialog-title">Local rehearsal</h2></> : <CastComic />}
      {kind === 'help' && <details className="ba-technical-notes"><summary>Keyboard, friends &amp; movement</summary>
        <p>Tab to a joint and use the arrow keys. Shift takes a bigger step. On a foot, R and Shift+R turn the shoe. To play with a friend, hide the cue and pass the screen.</p>
          {compareMotion && (
            <fieldset className="ba-motion">
              <legend>Compare the feel</legend>
              <label>
                <input type="radio" name="ba-follow" checked={bodyFollow} onChange={() => onBodyFollow(true)} />{' '}
                Body follow
              </label>
              <label>
                <input
                  type="radio"
                  name="ba-follow"
                  checked={!bodyFollow}
                  onChange={() => onBodyFollow(false)}
                />{' '}
                Direct only
              </label>
            </fieldset>
          )}
      </details>}
      {kind === 'account' && <p>The practice stage works here. Sign-in and live rooms need a connected Bad Actors app.</p>}
      {kind === 'welcome' && <p className="ba-opening-tip">On the opening stage, guess the sample or grab a joint to take over.</p>}
      <div className="ba-book-actions">
        {kind === 'welcome' ? <>
          <button type="button" className="ba-dark-button" data-sound-power onClick={() => { setPower(true); dismiss() }}>Places! Sound on <ArrowRight size={17} /></button>
          <button className="ba-quiet-entry" type="button" data-sound-power onClick={() => { setPower(false); dismiss() }}>Play quietly</button>
        </> : <button type="button" className="ba-dark-button" onClick={dismiss}>Back to the stage <ArrowRight size={16}/></button>}
      </div>
    </dialog>
  )
}

function PropDrawing({ kind }: { kind: PropKind }) {
  return (
    <svg
      viewBox="0 0 56 43"
      aria-hidden="true"
      className="ba-prop-art"
      stroke="#343c33"
      strokeWidth="2.1"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {kind === 'phone' ? (
        <g transform="translate(28 21) rotate(-10) scale(.82)"><Phone width={1} edge={0} /></g>
      ) : kind === 'cup' ? (
        <g transform="rotate(-5 28 23)">
          <path d="M34 13h5c9 0 9 14 1 15l-6 1" fill="#98594b" />
          <path d="M35 18h4q4 0 3 4t-6 3" fill="#edece3" />
          <path d="M10 11h26v15q-1 10-12 11-13-1-14-12z" fill="#aa6855" />
          <ellipse cx="23" cy="11.5" rx="13" ry="4.5" fill="#ebe0b9" />
          <path d="M14 12q10-4 18 0" fill="none" stroke="#765d47" />
          <path d="M14 18v5" fill="none" stroke="#dba88b" />
        </g>
      ) : (
        <g transform="translate(28 23) rotate(-7) scale(.48)"><ServingTray /></g>
      )}
    </svg>
  )
}

function ExpressionPicker({ value, select }: { value: FaceShape; select: (shape: FaceShape) => void }) {
  return (
    <section className="ba-faces" aria-label="Expression">
      <h3>Expression</h3>
      <div>
        {faces.map(({ shape, label }) => (
          <button
            key={shape}
            type="button"
            aria-label={label}
            aria-pressed={value === shape}
            onClick={() => select(shape)}
          >
            <svg viewBox="-31 -22 62 48" width="35" height="29" aria-hidden="true">
              <path d="m-29-15 4-5 44 1 8-3 1 6 1 29-6 8-42 2-9-7z"
                stroke="#5e5845" strokeWidth="2" strokeLinejoin="round" fill="#d7b67c" />
              <ActorFace shape={shape} />
            </svg>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

const publicAudience = createAudience('hosted')

type RehearsalProps = {
  accountAvailable?: boolean
  hostedAudience?: AudienceClient
  requestedPlay?: PlayMode
  accountControl?: ReactNode
}

export default function Rehearsal({ accountAvailable = true, hostedAudience, requestedPlay, accountControl }: RehearsalProps) {
  const [pose, setPose] = useState<PuppetPose>(phoneSamplePose)
  const [phase, setPhase] = useState<Phase>('guess')
  const [cue, setCue] = useState(0)
  const [cueHidden, setCueHidden] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [guess, setGuess] = useState('')
  const [correct, setCorrect] = useState(false)
  const [openingVerdict, setOpeningVerdict] = useState<'correct' | 'incorrect'>()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [resetMessage, setResetMessage] = useState('')
  const [grabbing, setGrabbing] = useState(false)
  const [bodyFollow, setBodyFollow] = useState(true)
  const { audio: houseAudio } = useStageSound()
  const [introChecked, setIntroChecked] = useState(false)
  const [firstLook, setFirstLook] = useState(false)
  const parkedLook = useRef<number | null>(null)
  const restored = useRef(false)
  const stage = useRef<PuppetStageApi>(null)
  const player = useRef<HTMLDivElement>(null)
  const [solo, setSolo] = useState<PlayMode | null>(null)
  const [clock, setClock] = useState<ClockReading | null>(null)
  const updateClock = useCallback((reading: ClockReading | null) => {
    houseAudio.clock(reading)
    setClock(reading)
  }, [houseAudio])
  const compareMotion = import.meta.env.DEV || !accountAvailable
  const helpTrigger = useRef<HTMLElement | null>(null)
  const cueHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (compareMotion && params.get('direct') === '1') setBodyFollow(false)
    if (restored.current) return
    restored.current = true
    // Every visit and every refresh opens on the handbook. Its "Places! Sound on" is the gesture
    // that lets the hall make sound, so a returning player is never left in a silent theatre.
    setDialog('welcome')
    setIntroChecked(true)
    const saved = restoreSession()
    if (saved) {
      parkedLook.current = saved.askOnReturn && saved.phase === 'practice' ? saved.cue : null
      setPose(saved.pose)
      setPhase(saved.phase)
      setCue(saved.cue)
      setCueHidden(saved.cueHidden === true)
      setCorrect(saved.correct === true)
      try {
        sessionStorage.removeItem(sessionKey)
      } catch {
        /* Private browsing. */
      }
    } else {
      const entry = Number(params.get('cue')) - 1
      if (Number.isInteger(entry) && entry >= 0 && entry < exercises.length) {
        setPhase('practice')
        setCue(entry)
        setPose(initialPose())
      }
    }
  }, [compareMotion])
  const parkPose = (askOnReturn = false) => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ pose, phase, cue, correct, cueHidden, askOnReturn }))
    } catch {
      /* Practice still works in memory. */
    }
  }
  function showDialog(kind: DialogKind) {
    helpTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDialog(kind)
  }
  function dismissDialog() {
    setDialog(null)
    requestAnimationFrame(() => (helpTrigger.current ?? cueHeading.current)?.focus({ preventScroll: true }))
  }
  function yourTurn() {
    setPhase('practice')
    setPose(initialPose())
    setCue(0)
    setCueHidden(false)
    setGuess('')
    setResetMessage('')
    requestAnimationFrame(() => cueHeading.current?.focus({ preventScroll: true }))
  }
  const publicEntry = accountAvailable && !hostedAudience
  function playWithAudience(mode: PlayMode, fromRoomLink = false) {
    if (publicEntry) {
      parkPose(mode === 'rehearse')
      const query = new URLSearchParams({ play: mode, cue: String(cue + 1) })
      window.location.assign('/room?' + query)
      return
    }
    if (hostedAudience) {
      const url = new URL(window.location.href)
      if (url.searchParams.has('play')) {
        url.searchParams.delete('play')
        window.history.replaceState(window.history.state, '', url)
      }
    }
    if (mode === 'draw') {
      const previous = phase === 'practice' ? cue : 1
      changeCue(drawAnotherCue(previous, exercises.length))
      setPose(initialPose())
      setPhase('practice')
    }
    setCueHidden(false)
    setNoteOpen(false)
    setFirstLook(mode === 'rehearse' && (!fromRoomLink || parkedLook.current === cue))
    parkedLook.current = null
    setSolo(mode)
  }
  function changeCue(index: number) {
    setFirstLook(false)
    if (solo && index !== cue) setPose(initialPose())
    setCue(index)
    setNoteOpen(false)
    setResetMessage('')
    const url = new URL(window.location.href)
    if (url.searchParams.has('cue')) {
      url.searchParams.set('cue', String(index + 1))
      window.history.replaceState(window.history.state, '', url)
    }
  }
  function rotatePart(part: 'left' | 'right' | 'prop', degrees: number) {
    const next = part === 'prop' ? turnProp(pose) : turnFoot(pose, part, degrees)
    if (next === pose) return
    if (part === 'prop') {
      stage.current?.reactToTurn('prop', degrees)
    } else {
      const change = footAngle(next, part) - footAngle(pose, part)
      stage.current?.reactToTurn(part === 'left' ? 'leftAnkle' : 'rightAnkle', change)
    }
    inputPose(next)
  }
  function inputPose(next: PuppetPose) {
    setPhase('practice')
    setResetMessage('')
    setPose(next)
  }
  function submitGuess(event: FormEvent) {
    event.preventDefault()
    const match = checkOpeningGuess(guess)
    if (match === null) return
    setCorrect(match)
    setOpeningVerdict(match ? 'correct' : 'incorrect')
    setPhase('revealed')
    // Return from the answer field to the stage so the crowd is in view on a phone.
    requestAnimationFrame(() => {
      const heading = cueHeading.current
      heading?.focus({ preventScroll: true })
      const scene = heading?.closest('.ba-scene-floor')
      const bounds = scene?.getBoundingClientRect()
      if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight))
        scene?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }
  function reset() {
    setPose(initialPose())
    setPhase('practice')
    setResetMessage('Pose reset.')
  }
  const prop = pose.prop
  const covered = phase === 'practice' && cueHidden
  const flyTitle = phase === 'guess' ? 'What’s the act?' : phase === 'revealed' ? 'Talking on the phone'
    : covered ? 'Guess the pose' : exercises[cue].title
  const account = accountControl ?? (accountAvailable ? (
    <a className="ba-nav-room" href="/room" onClick={() => parkPose()}>
      Backstage <ArrowRight size={16} />
    </a>
  ) : (
    <button type="button" className="ba-nav-room" onClick={() => showDialog('account')}>
      Sign in <ArrowRight size={16} />
    </button>
  ))

  return (
    <div className="ba-app" data-testid="static-landing">
      <TopBar onHelp={() => showDialog('help')} accountControl={account} />
      <main className="ba-wrap ba-main">
        <header className="ba-intro">
          <div className="ba-title-lockup">
            <h1><img src="/bad-actors-wordmark.svg" alt="Bad Actors" width="510" height="98" /></h1>
            <img className="ba-margin-actor" src="/margin-actor.svg" alt="" width="110" height="95" />
          </div>
          <div className="ba-billing">
            <h2>Puppet charades</h2>
            <p>Our lead called in sick. You pose the understudy. Stubbs guesses. Judge Monitor prints the verdict.</p>
          </div>
        </header>
        <div className="ba-workspace ba-has-audience">
          <section className="ba-stage-block" aria-label="Rehearsal stage">
            <div className="ba-theater">
              <AudienceSeat firstLook={firstLook} paused={!introChecked || dialog !== null} client={hostedAudience ?? (publicEntry ? publicAudience : undefined)} publicEntry={publicEntry} requestedPlay={requestedPlay} mode={solo} canRehearse={phase === 'practice' && !cueHidden} cue={cue + 1} pose={pose} stage={stage} player={player}
                openingVerdict={phase === 'revealed' ? openingVerdict : undefined}
                onStart={playWithAudience} onLeave={() => setSolo(null)} onClock={updateClock}
                onNext={() => solo === 'draw' ? playWithAudience('draw') : changeCue((cue + 1) % exercises.length)}
                flyCue={<FlyCue title={flyTitle} covered={covered} reveal={phase === 'revealed'} headingRef={cueHeading}
                  draw={solo === 'draw' ? cue : undefined} />}
                clock={solo === 'draw' && clock && <StageClock seconds={clock.seconds} mode={clock.mode} className="ba-show-clock" />}>
                <div className="ba-stage-canvas">
                  <div className="ba-player" ref={player}>
                    <PuppetStage
                      stageRef={stage}
                      onTug={houseAudio.tug}
                      pose={pose}
                      onPoseChange={inputPose}
                      bodyFollow={bodyFollow}
                      onGrabChange={setGrabbing}
                    />
                  </div>
                </div>
              </AudienceSeat>
            </div>
            <div className="ba-stage-bar">
              <span>
                <Hand size={17} aria-hidden="true" /> Drag any joint. A quick tug makes it wobble.
              </span>
              <button type="button" disabled={grabbing} onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" /> Reset pose
              </button>
            </div>
            <span className="ba-sr" role="status">
              {resetMessage}
            </span>
          </section>
          <section className="ba-cue" aria-label="Cue card" data-revealed={phase === 'revealed' || undefined} data-covered={covered || undefined}>
            <div className="ba-cue-header">
              <span>Cue controls</span>
              {phase === 'practice' ? (
                <div className="ba-cue-meta">
                  {!covered && <span>{String(cue + 1).padStart(2, '0')} / 06</span>}
                  {solo !== 'draw' && <button
                    type="button"
                    className="ba-hide-cue"
                    aria-expanded={!cueHidden}
                    aria-controls="ba-cue-heading"
                    onClick={() => {
                      if (!cueHidden) setSolo(null)
                      setCueHidden((hidden) => !hidden)
                      setNoteOpen(false)
                    }}
                  >
                    {cueHidden ? (
                      <Eye size={14} aria-hidden="true" />
                    ) : (
                      <EyeOff size={14} aria-hidden="true" />
                    )}
                    {cueHidden ? 'Show cue' : 'Hide cue'}
                  </button>}
                </div>
              ) : (
                <span>{phase === 'revealed' ? (correct ? 'Guessed it!' : 'The reveal') : 'Warm-up'}</span>
              )}
            </div>
            <div className="ba-cue-body">
              {phase === 'guess' ? (
                <form onSubmit={submitGuess} className="ba-guess-form">
                  <label className="ba-sr" htmlFor="sample-guess">
                    Guess the actor’s action
                  </label>
                  <input
                    id="sample-guess"
                    placeholder="Type a guess…"
                    autoComplete="off"
                    maxLength={80}
                    value={guess}
                    onChange={(event) => setGuess(event.target.value)}
                  />
                  <button type="submit" aria-label="Submit guess" disabled={!guess.trim()}>
                    <span>Guess</span> <CornerDownLeft size={14} aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <p className="ba-cue-hint">
                  {phase === 'practice'
                    ? cueHidden
                      ? 'Pass the screen to your guesser.'
                      : solo ? 'Stubbs sees the actor and the prop.' : 'Hide the cue before handing over the screen.'
                    : correct
                      ? 'You got it. Now take the stage.'
                      : 'That was the sample cue. Try acting one out.'}
                </p>
              )}
            </div>
            {phase === 'practice' && !cueHidden && (
              <div className="ba-cue-actor">
                <button type="button" className="ba-note-toggle" aria-expanded={noteOpen} aria-controls="ba-stage-note" onClick={() => setNoteOpen(!noteOpen)}>
                  <BookOpen size={14} aria-hidden="true" /> Acting hint
                </button>
                  <div id="ba-stage-note" className="ba-blocking" hidden={!noteOpen}>
                    {noteOpen && <img src={`/blocking/${exercises[cue].sketch}.png`} alt="" width="96" height="96" />}
                    <p>{exercises[cue].note}</p>
                  </div>
              </div>
            )}
            {solo !== 'draw' && <div className="ba-cue-bottom">
              {phase === 'practice' ? (
                <button
                  type="button"
                  onClick={() => changeCue((cue + 1) % exercises.length)}
                >
                  Next cue <ArrowRight size={17} />
                </button>
              ) : (
                <button type="button" onClick={yourTurn}>
                  Your turn <ArrowRight size={17} />
                </button>
              )}
            </div>}
            {solo !== 'draw' && phase === 'practice' && !cueHidden && (
              <label className="ba-choose-cue">
                <span>Choose a cue</span>
                <select value={cue} aria-label="Choose a cue" onChange={(event) => changeCue(Number(event.target.value))}>
                  {exercises.map((entry, index) => <option key={entry.title} value={index}>{entry.title}</option>)}
                </select>
              </label>
            )}
          </section>
          <section className="ba-dressing" aria-label="Props and expressions">
            <div className="ba-prop-shelf">
              <div className="ba-tray-heading">
                <h2>Prop tray</h2>
                <span>Pick one</span>
              </div>
              <div className="ba-props">
                {shelf.map((item) => (
                  <button
                    type="button"
                    key={item.kind}
                    aria-pressed={prop === item.kind}
                    onClick={() => inputPose(withProp(pose, prop === item.kind ? null : item.kind))}
                  >
                    <PropDrawing kind={item.kind} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              {phase === 'practice' && prop && (
                <div className="ba-prop-tools">
                  <button type="button" disabled={grabbing} onClick={() => rotatePart('prop', 45)}>
                    <RefreshCw size={13} /> Turn prop
                  </button>
                  {pose.holder && (
                    <button type="button" onClick={() => inputPose(putDown(pose))}>
                      <ArrowDownToLine size={13} /> Put down
                    </button>
                  )}
                </div>
              )}
            </div>
            <ExpressionPicker value={pose.face} select={(shape) => inputPose(withFace(pose, shape))} />
          </section>
          <section className="ba-adjust" aria-label="Actor controls">
            <h2>Hands &amp; feet</h2>
            <div className="ba-hand-shapes" role="group" aria-label="Hand shapes">
              {(['left', 'right'] as const).map(side => (
                <HandShapePicker key={side} side={side} value={handShape(pose, side)}
                  heldProp={pose.holder === side ? shelf.find(item => item.kind === pose.prop)?.label.toLowerCase() : undefined}
                  disabled={grabbing} onChange={shape => inputPose(withHandShape(pose, side, shape))} />
              ))}
            </div>
            <div className="ba-foot-turns" role="group" aria-label="Foot rotation">
              {(['left', 'right'] as const).map((side) => (
                <div key={side}>
                  <span>{side === 'left' ? 'Left foot' : 'Right foot'}</span>
                  <button
                    type="button"
                    aria-label={`Turn ${side} foot counterclockwise`}
                    title={`Turn ${side} foot counterclockwise`}
                    disabled={grabbing || turnFoot(pose, side, -12) === pose}
                    onClick={() => rotatePart(side, -12)}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Turn ${side} foot clockwise`}
                    title={`Turn ${side} foot clockwise`}
                    disabled={grabbing || turnFoot(pose, side, 12) === pose}
                    onClick={() => rotatePart(side, 12)}
                  >
                    <RotateCw size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
        <p className="ba-practice-note">
          Local rehearsal <span aria-hidden="true">/</span> The opening act uses a preset cue. Live AI starts when you invite Stubbs.
        </p>
      </main>
      {dialog && (
        <PlayDialog
          kind={dialog}
          close={dismissDialog}
          compareMotion={compareMotion}
          bodyFollow={bodyFollow}
          onBodyFollow={setBodyFollow}
        />
      )}
    </div>
  )
}
