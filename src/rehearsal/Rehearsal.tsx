import { memo, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  Hand,
  LayoutGrid,
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
import { ActorFace } from '../puppet/ActorFace'
import { isJoint, stageHandles, withLooseProp } from '../puppet/geometry'
import { footAngle, turnFoot } from '../puppet/joints'
import { useStageSound } from './StageSound'
import { HowToPlay } from './HowToPlay'
import { StageCoach } from './GhostHand'
import { PropDrawing } from './PropDrawing'
import { ActSlate, BlackoutCurtain, BlackoutEyes, Heckler, HeadsUp, MoodBadge, StageFright } from './StageTwists'
import type { Track } from './pit-band'
import { AudienceSeat, type RoundEnd } from './AudienceSeat'
import { createAudience, type AudienceClient } from './audience-round'
import { StageClock } from './StageClock'
import { FlyCue } from './FlyCue'
import { type ClockReading, type PlayMode } from './acting-clock'
import { deck, type Level, type LevelId } from '../deck'
import { actsPerShow, drawShow, levelOf, nextLevel, readBest, recordBest, unlocked, type Best, type Show } from './show'
import { CurtainDialog, DeckDialog, ShowDialog } from './ShowDialogs'
import { checkOpeningGuess } from './opening-guess'
import { HandShapePicker, handShapeOptions } from './HandShapePicker'
import './rehearsal.css'

const shelf: { kind: PropKind; label: string }[] = [
  { kind: 'phone', label: 'Phone' },
  { kind: 'cup', label: 'Cup' },
  { kind: 'plate', label: 'Tray' },
  { kind: 'mic', label: 'Mic' },
  { kind: 'umbrella', label: 'Umbrella' },
  { kind: 'book', label: 'Book' },
  { kind: 'rose', label: 'Rose' },
  { kind: 'banana', label: 'Banana' },
  { kind: 'chicken', label: 'Rubber chicken' },
]
const faces: { shape: FaceShape; label: string }[] = [
  { shape: 'flat', label: 'Deadpan' },
  { shape: 'side-eye', label: 'Side-eye' },
  { shape: 'braced', label: 'Bracing' },
  { shape: 'smile', label: 'Forced smile' },
  { shape: 'open', label: 'Gulp' },
  { shape: 'angry', label: 'Fuming' },
  { shape: 'sad', label: 'Weepy' },
  { shape: 'sleepy', label: 'Snoozing' },
  { shape: 'love', label: 'Smitten' },
  { shape: 'wink', label: 'Cheeky wink' },
]
const fineJoints = new Set<string>(stageHandles.filter(isJoint))
/** The pit band's arrangement for each night. */
const nightTracks: Record<LevelId, Track> = { 1: 'opening', 2: 'props', 3: 'feelings', 4: 'blackout', 5: 'gala' }

const sessionKey = 'bad-actors:public-rehearsal:1'

type Phase = 'guess' | 'revealed' | 'practice'
type RehearsalSession = {
  phase: Phase
  cue: number
  pose: PuppetPose
  correct?: boolean
  askOnReturn?: boolean
}
type DialogKind = 'welcome' | 'help' | 'account' | 'deck' | 'show' | 'curtain'
type BookKind = Extract<DialogKind, 'welcome' | 'help' | 'account'>
/** The glove's next hint after the demo: the way in, a hand to drag, then the Ready button. */
type Guide = 'ticket' | 'drag' | 'ready' | null
type DockTab = 'prop' | 'face' | 'hands' | 'feet'
const dockTabs: { id: DockTab; label: string }[] = [
  { id: 'prop', label: 'Prop' }, { id: 'face', label: 'Face' }, { id: 'hands', label: 'Hands' }, { id: 'feet', label: 'Feet' },
]

/** At 960 px and narrower the dressing room docks to the bottom of the screen as tabs. */
function useDocked() {
  const [docked, setDocked] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)')
    const update = () => setDocked(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return docked
}

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
      saved.cue >= deck.length ||
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
  kind: BookKind
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
      className={kind === 'account' ? 'ba-dialog' : 'ba-dialog ba-handbook'}
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
      {kind === 'account' ? <>
        <div className="ba-stamp"><LogIn /></div><h2 id="ba-dialog-title">Local rehearsal</h2>
        <p>The practice stage works here. Sign-in and live rooms need a connected Bad Actors app.</p>
        <div className="ba-book-actions">
          <button type="button" className="ba-dark-button" onClick={dismiss}>Back to the stage <ArrowRight size={16}/></button>
        </div>
      </> : <>
        <header className="ba-book-title">
          <img src="/bad-actors-wordmark.svg" width="132" height="26" alt="Bad Actors" />
          <h2 id="ba-dialog-title" tabIndex={-1}>How to play</h2>
        </header>
        <HowToPlay>
          <div className="ba-book-actions">
            {kind === 'welcome' ? <>
              <button type="button" className="ba-dark-button" data-sound-power onClick={() => { setPower(true); dismiss() }}>Let’s play! Sound on <ArrowRight size={17} /></button>
              <button className="ba-quiet-entry" type="button" data-sound-power onClick={() => { setPower(false); dismiss() }}>Play quietly</button>
            </> : <button type="button" className="ba-dark-button" onClick={dismiss}>Back to the stage <ArrowRight size={16}/></button>}
          </div>
          {kind === 'help' && <details className="ba-technical-notes"><summary>Keyboard &amp; movement</summary>
            <p>Tab to a joint and use the arrow keys. Shift takes a bigger step. On a foot, R and Shift+R turn the shoe.</p>
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
        </HowToPlay>
      </>}
    </dialog>
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
            data-sound
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
  const [noteOpen, setNoteOpen] = useState(false)
  const [dockTab, setDockTab] = useState<DockTab>('prop')
  const docked = useDocked()
  const [guide, setGuide] = useState<Guide>(null)
  // Once a player has moved the actor this visit, the glove stops showing them how.
  const posed = useRef(false)
  const [show, setShow] = useState<Show | null>(null)
  const [best, setBest] = useState<Best>({})
  const showRef = useRef<Show | null>(null)
  showRef.current = show
  const advancedFor = useRef(0)
  const [guess, setGuess] = useState('')
  const [correct, setCorrect] = useState(false)
  const [openingVerdict, setOpeningVerdict] = useState<'correct' | 'incorrect'>()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [resetMessage, setResetMessage] = useState('')
  const [grabbing, setGrabbing] = useState(false)
  // Each night's twist: the slate at the top of an act, nerves, a flung prop, and how the round ended.
  const [slate, setSlate] = useState<{ key: number; kicker: string; title: string; quip: string; twist?: Level['twist'] } | null>(null)
  const [fright, setFright] = useState(false)
  const [toss, setToss] = useState(0)
  const [roundEnd, setRoundEnd] = useState<{ guessed: boolean } | null>(null)
  const actSerial = useRef(0)
  const lastNight = useRef<LevelId | null>(null)
  const poseRef = useRef(pose)
  poseRef.current = pose
  const moodRef = useRef<FaceShape | undefined>(undefined)
  // On the Catch! night the prop waits in the wings until the slate is down, so the throw is seen.
  const pendingToss = useRef<PropKind | undefined>(undefined)
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
    // Every visit and every refresh opens on the silent how-to-play demo. Its "Let’s play! Sound on"
    // is the gesture that lets the hall make sound, so a returning player is never left in a silent
    // theatre. A ticket that brought the player here to play has already been past the demo.
    // Browser tests start past it too; players never set this key.
    let skipBook = Boolean(requestedPlay)
    try { skipBook ||= localStorage.getItem('bad-actors:handbook:skip') === '1' } catch { /* Private browsing shows it. */ }
    if (!skipBook) setDialog('welcome')
    setIntroChecked(true)
    setBest(readBest())
    const saved = restoreSession()
    if (saved) {
      posed.current = saved.phase === 'practice'
      parkedLook.current = saved.askOnReturn && saved.phase === 'practice' ? saved.cue : null
      setPose(saved.pose)
      setPhase(saved.phase)
      setCue(saved.cue)
      setCorrect(saved.correct === true)
      try {
        sessionStorage.removeItem(sessionKey)
      } catch {
        /* Private browsing. */
      }
    } else {
      const entry = Number(params.get('cue')) - 1
      if (Number.isInteger(entry) && entry >= 0 && entry < deck.length) {
        setPhase('practice')
        setCue(entry)
        setPose(initialPose())
      }
    }
  }, [compareMotion, requestedPlay])
  const parkPose = (askOnReturn = false) => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ pose, phase, cue, correct, askOnReturn }))
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
  /** After the opening demo, the glove points at the way in. */
  function closeWelcome() {
    dismissDialog()
    if (!solo) setGuide('ticket')
  }
  /** A game begins: show a newcomer which part of the actor to grab. */
  function enterGame() {
    setGuide(posed.current ? null : 'drag')
    // On a phone the tickets sit below the stage. Bring the actor back up for the game.
    requestAnimationFrame(() => {
      const scene = cueHeading.current?.closest('.ba-scene-floor')
      if ((scene?.getBoundingClientRect().top ?? 0) < 0) scene?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
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
    // A pose made before signing in goes straight to Stubbs; otherwise the player picks first.
    if (mode === 'rehearse' && fromRoomLink && parkedLook.current === cue) {
      parkedLook.current = null
      startFree(cue, true)
      return
    }
    parkedLook.current = null
    helpTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDialog(mode === 'rehearse' ? 'deck' : 'show')
  }
  /** Raise the curtain on one cue: its slate, and whatever the night has in store for it. */
  function stageAct(index: number, kicker: string, fresh: boolean, announce: boolean) {
    const card = deck[index], night = levelOf(card.level)
    actSerial.current += 1
    lastNight.current = card.level
    setSlate({ key: actSerial.current, kicker, title: card.title, quip: card.quip, twist: announce ? night.twist : undefined })
    setFright(night.twist.id === 'fright')
    if (night.twist.id === 'fright') houseAudio.effect('rattle')
    setRoundEnd(null)
    setToss(0)
    pendingToss.current = fresh && night.twist.id === 'catch' ? card.prop : undefined
  }
  /** The slate comes down, by itself or as soon as the player starts acting. Then any prop is thrown on. */
  function lowerSlate() {
    setSlate(null)
    const flung = pendingToss.current
    if (!flung) return
    pendingToss.current = undefined
    setPose(current => withLooseProp(current, flung))
    setToss(actSerial.current)
    houseAudio.effect('whoosh')
    setTimeout(() => houseAudio.effect('thud'), 480)
  }
  const freeKicker = (index: number) => 'Free play · ' + levelOf(deck[index].level).name
  /** Free play: one cue, no clock, as many tries as the five looks allow. */
  function startFree(index: number, lookNow = false) {
    setDialog(null)
    setShow(null)
    // Keep a pose already made for this cue; a different cue starts from a fresh actor.
    const fresh = !lookNow && (index !== cue || phase !== 'practice')
    if (fresh) setPose(initialPose())
    stageAct(index, freeKicker(index), fresh, lastNight.current !== deck[index].level)
    setCue(index)
    setPhase('practice')
    setNoteOpen(false)
    setResetMessage('')
    setFirstLook(lookNow)
    setSolo('rehearse')
    enterGame()
  }
  function beginAct(index: number, act: number, level: LevelId) {
    setCue(index)
    setPose(initialPose())
    stageAct(index, `Act ${act} of ${actsPerShow} · ${levelOf(level).name}`, true, act === 1)
    setPhase('practice')
    setNoteOpen(false)
    setResetMessage('')
    setFirstLook(false)
    setSolo('draw')
    enterGame()
  }
  function startShow(level: LevelId) {
    const evening = drawShow(level)
    advancedFor.current = 0
    setShow(evening)
    setDialog(null)
    beginAct(evening.queue[0], 1, level)
  }
  const handleRoundEnd = useCallback((end: RoundEnd) => {
    // On the Feel it night, a hit made wearing the cue's mood is method acting.
    const feeling = end.guessed && Boolean(moodRef.current) && poseRef.current.face === moodRef.current
    setShow(current => {
      if (!current || current.results.length >= actsPerShow) return current
      return { ...current, results: [...current.results, { cue: current.queue[current.results.length], ...end, ...(feeling && { feeling }) }] }
    })
  }, [])
  /** Next act, or the curtain call after the last one. Each finished act advances exactly once. */
  function advance() {
    const current = showRef.current
    if (!current) return
    const done = current.results.length
    if (done === 0 || advancedFor.current === done) return
    advancedFor.current = done
    if (done < actsPerShow) { beginAct(current.queue[done], done + 1, current.level); return }
    setSolo(null)
    setBest(recordBest(best, current.level, current.results))
    houseAudio.effect('fanfare')
    setDialog('curtain')
  }
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  // The pit band plays the lobby tune between games and tonight's arrangement during one.
  const track: Track = solo ? nightTracks[deck[cue].level] : 'lobby'
  useEffect(() => { houseAudio.music(track) }, [houseAudio, track])
  // A flung prop's shout and bounce last under two seconds; the attribute comes off for the next throw.
  useEffect(() => {
    if (!toss) return
    const timer = setTimeout(() => setToss(0), 1800)
    return () => clearTimeout(timer)
  }, [toss])
  // Give each act's applause or heckle its moment, then raise the curtain on the next.
  const actsDone = show?.results.length ?? 0
  useEffect(() => {
    if (!actsDone) return
    const timer = setTimeout(() => advanceRef.current(), 3200)
    return () => clearTimeout(timer)
  }, [actsDone])
  /** Docked on a narrow screen, each drawer is a tab panel; beside the stage they are plain sections. */
  const drawer = (id: DockTab) => docked
    ? { role: 'tabpanel', id: 'ba-panel-' + id, 'aria-labelledby': 'ba-tab-' + id, hidden: dockTab !== id }
    : {}
  /** Arrow keys move between the dressing-room tabs, as in any tab strip. */
  function moveDockTab(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = dockTabs[(dockTabs.findIndex(tab => tab.id === dockTab) + step + dockTabs.length) % dockTabs.length].id
    setDockTab(next)
    document.getElementById('ba-tab-' + next)?.focus()
  }
  function leaveGame() {
    setSolo(null)
    setShow(null)
    setNoteOpen(false)
    setGuide(null)
    setSlate(null)
    setFright(false)
    setToss(0)
    setRoundEnd(null)
    pendingToss.current = undefined
  }
  function changeCue(index: number) {
    setFirstLook(false)
    if (guide === 'ready') setGuide(null)
    if (solo && index !== cue) setPose(initialPose())
    if (solo) stageAct(index, freeKicker(index), index !== cue, lastNight.current !== deck[index].level)
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
    posed.current = true
    if (fright) setFright(false)
    if (slate) lowerSlate()
    // The first move in a game hands the glove over to the Ready button.
    if (guide === 'drag' && solo) setGuide('ready')
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
  const flyTitle = phase === 'guess' ? 'What’s the act?' : phase === 'revealed' ? 'Talking on the phone' : deck[cue].title
  const inShow = Boolean(show) && solo === 'draw'
  // Tonight's trouble follows the cue's level, in free play as in the show.
  const night = solo ? levelOf(deck[cue].level) : null
  const twist = night?.twist.id
  const mood = twist === 'feel' ? deck[cue].mood : undefined
  moodRef.current = mood
  const moodLabel = mood && faces.find(face => face.shape === mood)?.label
  const playing = Boolean(solo) && !roundEnd
  const act = show ? show.queue.indexOf(cue) + 1 : 0
  // Before a game: the opening guess, then a nudge toward the two tickets.
  const lobby = phase === 'guess' ? (
    <form onSubmit={submitGuess} className="ba-guess-form ba-lobby-guess">
      <label htmlFor="sample-guess">What’s the act? Guess the opening pose:</label>
      <input id="sample-guess" placeholder="Type a guess…" autoComplete="off" maxLength={80}
        value={guess} onChange={(event) => setGuess(event.target.value)} />
      <button type="submit" aria-label="Submit guess" disabled={!guess.trim()}>
        <span>Guess</span> <CornerDownLeft size={14} aria-hidden="true" />
      </button>
    </form>
  ) : phase === 'revealed' ? (
    <p className="ba-lobby-note">{correct ? 'You got it! Now it’s your turn on stage.' : 'It was “Talking on the phone”. Your turn on stage now.'}</p>
  ) : null
  const cueTools = solo && <>
    <button type="button" className="ba-audience-leave" aria-expanded={noteOpen} onClick={() => setNoteOpen(open => !open)}>
      <BookOpen size={14} aria-hidden="true" /> Hint
    </button>
    {solo === 'rehearse' && <button type="button" className="ba-audience-leave" onClick={() => playWithAudience('rehearse')}>
      <LayoutGrid size={14} aria-hidden="true" /> Change cue
    </button>}
  </>
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
              <AudienceSeat firstLook={firstLook} paused={!introChecked || dialog !== null || slate !== null} client={hostedAudience ?? (publicEntry ? publicAudience : undefined)} publicEntry={publicEntry} requestedPlay={requestedPlay} mode={solo} cue={cue + 1} pose={pose} stage={stage} player={player}
                openingVerdict={phase === 'revealed' ? openingVerdict : undefined}
                lobby={lobby} cueTools={cueTools}
                beckon={guide === 'ticket' || guide === 'ready' ? guide : undefined}
                opener={night?.opener} actSeconds={inShow && night ? night.seconds : 45} onRoundOver={setRoundEnd} night={twist}
                actLabel={inShow ? `Act ${act} of ${actsPerShow}` : undefined}
                nextLabel={inShow ? (act >= actsPerShow ? 'Curtain call' : 'Next act') : 'Next cue'}
                onRoundEnd={inShow ? handleRoundEnd : undefined}
                onStart={playWithAudience} onLeave={leaveGame} onClock={updateClock}
                onNext={() => inShow ? advance() : changeCue((cue + 1) % deck.length)}
                flyCue={<FlyCue title={flyTitle} covered={false} reveal={phase === 'revealed'} headingRef={cueHeading}
                  draw={solo === 'draw' ? cue : undefined} />}
                clock={solo === 'draw' && clock && <StageClock seconds={clock.seconds} mode={clock.mode} className="ba-show-clock" />}>
                <div className="ba-stage-canvas" data-fright={(fright && solo) || undefined} data-toss={toss || undefined}>
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
                  {guide === 'drag' && solo && !grabbing && <StageCoach wrist={pose.right} />}
                  {fright && solo && <StageFright pose={pose} />}
                </div>
                {twist === 'blackout' && playing && <>
                  <BlackoutCurtain seed={actSerial.current} />
                  <div className="ba-stage-twin"><BlackoutEyes pose={pose} /></div>
                </>}
                {twist === 'heckler' && playing && <Heckler seed={actSerial.current} />}
                {toss > 0 && <HeadsUp key={toss} from="right" />}
                {mood && moodLabel && <MoodBadge mood={mood} label={moodLabel} wearing={pose.face === mood}
                  earned={Boolean(roundEnd?.guessed) && pose.face === mood} />}
                {slate && <ActSlate key={slate.key} kicker={slate.kicker} title={slate.title} quip={slate.quip} twist={slate.twist}
                  onDone={lowerSlate} />}
              </AudienceSeat>
            </div>
            <div className="ba-stage-bar">
              {noteOpen && solo ? <span className="ba-stage-hint">
                {deck[cue].sketch && <img src={`/blocking/${deck[cue].sketch}.png`} alt="" width="40" height="40" />}
                <BookOpen size={15} aria-hidden="true" /> {deck[cue].note}
              </span> : <span>
                <Hand size={17} aria-hidden="true" /> Drag any joint. A quick tug makes it wobble.
              </span>}
              <button type="button" disabled={grabbing} onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" /> Reset pose
              </button>
            </div>
            <span className="ba-sr" role="status">
              {resetMessage}
            </span>
          </section>
          {/* The dressing room keeps every control beside the stage on a desktop and docked to the
              bottom of a phone, the way drawing and dress-up games keep their tools in reach. */}
          <section className="ba-dock" aria-label="Dressing room" data-docked={docked || undefined}>
            {docked && <div className="ba-dock-tabs" role="tablist" aria-label="Dressing room" onKeyDown={moveDockTab}>
              {dockTabs.map(({ id, label }) => (
                <button key={id} type="button" role="tab" id={'ba-tab-' + id} aria-controls={'ba-panel-' + id}
                  aria-selected={dockTab === id} tabIndex={dockTab === id ? 0 : -1} onClick={() => setDockTab(id)}>
                  {label}
                </button>
              ))}
            </div>}
            <div className="ba-dock-panel ba-prop-shelf" {...drawer('prop')}>
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
                    data-sound
                    onClick={() => {
                      houseAudio.effect(prop === item.kind ? 'click' : 'pop')
                      inputPose(withProp(pose, prop === item.kind ? null : item.kind))
                    }}
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
            <div className="ba-dock-panel" {...drawer('face')}>
              <ExpressionPicker value={pose.face} select={(shape) => { houseAudio.effect('boing'); inputPose(withFace(pose, shape)) }} />
            </div>
            <div className="ba-dock-panel" {...drawer('hands')}>
              <h2 className="ba-dock-heading">Hands</h2>
              <div className="ba-hand-shapes" role="group" aria-label="Hand shapes" data-sound>
                {(['left', 'right'] as const).map(side => (
                  <HandShapePicker key={side} side={side} value={handShape(pose, side)}
                    heldProp={pose.holder === side ? shelf.find(item => item.kind === pose.prop)?.label.toLowerCase() : undefined}
                    disabled={grabbing} onChange={shape => { houseAudio.effect('click'); inputPose(withHandShape(pose, side, shape)) }} />
                ))}
              </div>
            </div>
            <div className="ba-dock-panel" {...drawer('feet')}>
              <h2 className="ba-dock-heading">Feet</h2>
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
            </div>
          </section>
        </div>
        <p className="ba-practice-note">
          Designed by Shi Qiu
        </p>
      </main>
      {(dialog === 'welcome' || dialog === 'help' || dialog === 'account') && (
        <PlayDialog
          kind={dialog}
          close={dialog === 'welcome' ? closeWelcome : dismissDialog}
          compareMotion={compareMotion}
          bodyFollow={bodyFollow}
          onBodyFollow={setBodyFollow}
        />
      )}
      {dialog === 'deck' && <DeckDialog current={cue} pick={index => startFree(index)} close={dismissDialog} />}
      {dialog === 'show' && <ShowDialog best={best} start={startShow} close={dismissDialog} />}
      {dialog === 'curtain' && show && (() => {
        const following = nextLevel(show.level)
        return <CurtainDialog level={show.level} results={show.results} best={best}
          again={() => startShow(show.level)}
          next={following && unlocked(following, best) ? () => startShow(following) : undefined}
          close={() => { setShow(null); dismissDialog() }} />
      })()}
    </div>
  )
}
