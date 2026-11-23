import { memo, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  CircleHelp,
  CornerDownLeft,
  ClipboardList,
  Eye,
  EyeOff,
  Hand,
  Info,
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
  type HandShape,
  type PropKind,
  type PuppetPose,
  type PuppetStageApi,
} from '../puppet'
import { ActorFace } from '../puppet/ActorFace'
import { isJoint, stageHandles } from '../puppet/geometry'
import { footAngle, turnFoot } from '../puppet/joints'
import './rehearsal.css'

// These are public movement exercises. Live round assignments belong on the server.
const exercises = [
  'Drinking water',
  'Talking on the phone',
  'Taking a selfie',
  'Covering your eyes',
  'Surrendering',
  'Carrying a tray',
]
const shelf: { kind: PropKind; label: string }[] = [
  { kind: 'phone', label: 'Phone' },
  { kind: 'cup', label: 'Cup' },
  { kind: 'plate', label: 'Plate' },
]
const faces: { shape: FaceShape; label: string }[] = [
  { shape: 'flat', label: 'Deadpan' },
  { shape: 'side-eye', label: 'Side-eye' },
  { shape: 'braced', label: 'Bracing' },
  { shape: 'smile', label: 'Forced smile' },
  { shape: 'open', label: 'Gulp' },
]
const handShapes: { value: HandShape; label: string }[] = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'open', label: 'Open palm' },
  { value: 'fist', label: 'Fist' },
]
const fineJoints = new Set<string>(stageHandles.filter(isJoint))

const phoneGuesses = new Set([
  'phone',
  'calling',
  'calling someone',
  'phone call',
  'a phone call',
  'making a phone call',
  'taking a call',
  'answering the phone',
  'talking on a phone',
  'talking on the phone',
  'on the phone',
  'using a phone',
  'making a call',
  'talking on his phone',
  'talking on her phone',
  'talking on their phone',
])
const sessionKey = 'bad-actors:public-rehearsal:1'

type Phase = 'guess' | 'revealed' | 'practice'
type RehearsalSession = {
  phase: Phase
  cue: number
  pose: PuppetPose
  correct?: boolean
  cueHidden?: boolean
}
type DialogKind = 'help' | 'account'

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
            (side !== 'left' && side !== 'right') || !handShapes.some((option) => option.value === shape),
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
      <span>Bad Actors</span>
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
            <CircleHelp size={17} /> <span>How to play</span>
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
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    return () => node?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="ba-dialog"
      aria-labelledby="ba-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
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
            close()
        }
      }}
    >
      <button type="button" className="ba-dialog-x" aria-label="Close" onClick={close}>
        <X size={19} />
      </button>
      <div className="ba-stamp">{kind === 'help' ? <ClipboardList /> : <LogIn />}</div>
      <h2 id="ba-dialog-title">{kind === 'help' ? 'How to play' : 'Local rehearsal'}</h2>
      {kind === 'help' ? (
        <>
          <p>
            Guess the opening pose, then tap <strong>Your turn</strong> to draw a cue and pose the actor
            yourself.
          </p>
          <ul>
            <li>
              Drag any joint on the actor. Lift a shoulder, bend a knee or pull a foot forward.
              Drag the chest or head rotation point to turn it.
            </li>
            <li>Choose the cup, bring it to the mouth, then flick the empty hand up. You can also drag a prop between hands.</li>
            <li>
              Use Tab to reach a stage handle. Arrow keys move it and Shift makes a larger step. On a foot, R and Shift+R turn it in opposite directions.
            </li>
          </ul>
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
        </>
      ) : (
        <p>The practice stage works here. Sign-in and live rooms need a connected Bad Actors app.</p>
      )}
      <button type="button" className="ba-dark-button" onClick={close}>
        Back to the stage <ArrowRight size={16} />
      </button>
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
        <g transform="rotate(-11 28 22)">
          <rect x="18" y="2.5" width="21" height="36" rx="4" fill="#424f53" />
          <rect x="20.5" y="6" width="16" height="25" rx="1.4" fill="#b4c1ad" />
          <path d="m23 17 5-5m4 5-6 7" stroke="#e0e3ca" />
          <path d="M26 34.5h5" stroke="#cdc9ae" />
        </g>
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
        <g transform="rotate(-6 28 23)">
          <path d="M4 22q2 12 23 13 21 0 25-12" fill="#888e82" />
          <ellipse cx="28" cy="21" rx="24" ry="8" fill="#c9cbbb" />
          <ellipse cx="28" cy="21" rx="17" ry="4.7" fill="#a8b2a5" />
          <path d="M15 21q11-5 26 0" fill="none" stroke="#e2e1d0" />
        </g>
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

export default function Rehearsal({ accountAvailable = true }: { accountAvailable?: boolean }) {
  const [pose, setPose] = useState<PuppetPose>(phoneSamplePose)
  const [phase, setPhase] = useState<Phase>('guess')
  const [cue, setCue] = useState(0)
  const [cueHidden, setCueHidden] = useState(false)
  const [guess, setGuess] = useState('')
  const [correct, setCorrect] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [resetMessage, setResetMessage] = useState('')
  const [grabbing, setGrabbing] = useState(false)
  const [bodyFollow, setBodyFollow] = useState(true)
  const stage = useRef<PuppetStageApi>(null)
  const compareMotion = import.meta.env.DEV || !accountAvailable
  const helpTrigger = useRef<HTMLElement | null>(null)
  const cueHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (compareMotion && new URLSearchParams(window.location.search).get('direct') === '1') setBodyFollow(false)
    const saved = restoreSession()
    if (saved) {
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
    }
  }, [compareMotion])
  const parkPose = () => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ pose, phase, cue, correct, cueHidden }))
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
    requestAnimationFrame(() => helpTrigger.current?.focus({ preventScroll: true }))
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
    const answer = guess
      .trim()
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^(he is|she is|they are|hes|shes|theyre|the actor is) /, '')
      .trim()
    if (!answer) return
    setCorrect(phoneGuesses.has(answer))
    setPhase('revealed')
  }
  function reset() {
    setPose(initialPose())
    setPhase('practice')
    setResetMessage('Pose reset.')
  }
  const prop = pose.prop
  const account = accountAvailable ? (
    <a className="ba-nav-room" href="/room" onClick={parkPose}>
      Backstage <ArrowRight size={16} />
    </a>
  ) : (
    <button type="button" className="ba-nav-room" onClick={() => showDialog('account')}>
      Sign in <ArrowRight size={16} />
    </button>
  )

  return (
    <div className="ba-app" data-testid="static-landing">
      <TopBar onHelp={() => showDialog('help')} accountControl={account} />
      <main className="ba-wrap ba-main">
        <div className="ba-intro">
          <div>
            <div className="ba-section-tag">Charades rehearsal</div>
            <h1>The understudy is a sandbag.</h1>
            <p>Guess the opening act. Then drag the actor to perform your cue.</p>
          </div>
        </div>
        <div className="ba-workspace">
          <section className="ba-stage-block" aria-label="Rehearsal stage">
            <div className="ba-theater">
              <div className="ba-stage-canvas">
                <div className="ba-player">
                  <PuppetStage
                    stageRef={stage}
                    pose={pose}
                    onPoseChange={inputPose}
                    bodyFollow={bodyFollow}
                    onGrabChange={setGrabbing}
                  />
                </div>
              </div>
            </div>
            <div className="ba-stage-bar">
              <span>
                <Hand size={17} aria-hidden="true" /> Drag any joint. Turn the chest or head at its pin.
              </span>
              <button type="button" disabled={grabbing} onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" /> Reset pose
              </button>
            </div>
            <ExpressionPicker value={pose.face} select={(shape) => inputPose(withFace(pose, shape))} />
            <span className="ba-sr" role="status">
              {resetMessage}
            </span>
          </section>
          <aside className="ba-controls" aria-label="Rehearsal controls">
            <section className="ba-cue" aria-label="Cue card">
              <div className="ba-cue-header">
                <span>
                  <ClipboardList size={17} aria-hidden="true" /> Cue card
                </span>
                {phase === 'practice' ? (
                  <div className="ba-cue-meta">
                    <span>{String(cue + 1).padStart(2, '0')} / 06</span>
                    <button
                      type="button"
                      className="ba-hide-cue"
                      aria-expanded={!cueHidden}
                      aria-controls="ba-cue-heading"
                      onClick={() => setCueHidden((hidden) => !hidden)}
                    >
                      {cueHidden ? (
                        <Eye size={14} aria-hidden="true" />
                      ) : (
                        <EyeOff size={14} aria-hidden="true" />
                      )}
                      {cueHidden ? 'Show cue' : 'Hide cue'}
                    </button>
                  </div>
                ) : (
                  <span>Warm-up</span>
                )}
              </div>
              <div className="ba-cue-body">
                <h2 id="ba-cue-heading" ref={cueHeading} tabIndex={-1} aria-live="polite">
                  {phase === 'practice'
                    ? cueHidden
                      ? 'Guess the pose'
                      : exercises[cue]
                    : phase === 'revealed'
                      ? 'Talking on the phone'
                      : 'What’s the act?'}
                </h2>
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
                      <CornerDownLeft size={18} />
                    </button>
                  </form>
                ) : (
                  <p className="ba-cue-hint">
                    {phase === 'practice'
                      ? cueHidden
                        ? 'Pass the screen to your guesser.'
                        : 'Pose the actor, then hide the cue for a friend.'
                      : correct
                        ? 'You got it. Now take the stage.'
                        : 'That was the sample cue. Try acting one out.'}
                  </p>
                )}
              </div>
              <div className="ba-cue-bottom">
                {phase === 'practice' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCue((n) => (n + 1) % exercises.length)
                      setResetMessage('')
                    }}
                  >
                    Next cue <ArrowRight size={17} />
                  </button>
                ) : (
                  <button type="button" onClick={yourTurn}>
                    Your turn <ArrowRight size={17} />
                  </button>
                )}
              </div>
            </section>
            <section className="ba-dressing" aria-label="Actor controls">
              <div className="ba-tray-heading">
                <h2>Prop tray</h2>
                <span>Choose one</span>
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
              <div className="ba-hand-shapes" role="group" aria-label="Hand shapes">
                {(['left', 'right'] as const).map((side) => {
                  const label = side === 'left' ? 'Left hand' : 'Right hand'
                  const holding = pose.prop && pose.holder === side
                  return (
                    <label key={side}>
                      <span>{label}</span>
                      <select
                        aria-label={label + ' shape'}
                        aria-describedby={holding ? 'ba-hand-grip' : undefined}
                        value={handShape(pose, side)}
                        disabled={grabbing}
                        onChange={(event) => inputPose(withHandShape(pose, side, event.target.value as HandShape))}
                      >
                        {handShapes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  )
                })}
                {pose.prop && pose.holder && (
                  <small id="ba-hand-grip">
                    The {pose.holder} hand keeps its grip until you put the {pose.prop} down.
                  </small>
                )}
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
          </aside>
        </div>
        <p className="ba-practice-note">
          <Info size={15} aria-hidden="true" /> Local practice. The opening pose has a preset answer.
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
