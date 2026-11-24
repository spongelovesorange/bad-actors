import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { rotate, type FaceShape, type PuppetPose } from '../puppet/geometry'
import { computeRig, stillMotion } from '../puppet/motion'
import { ActorFace } from '../puppet/ActorFace'
import type { Level } from '../deck'
import { useStageSound } from './StageSound'
import './stage-twists.css'

/** Where the actor's eyes are on the stage, for the glow in a blackout and the sweat of stage fright. */
function useHead(pose: PuppetPose) {
  return useMemo(() => {
    const rig = computeRig(pose, stillMotion)
    const head = rig.pose.head, angle = rig.headAngle
    const at = (x: number, y: number) => rotate({ x: head.x + x, y: head.y + y }, head, angle)
    return { left: at(-15, -7), right: at(15, -7), brow: at(30, -24), angle }
  }, [pose])
}

/**
 * The slate at the top of each act: which act, the cue, and the director's note. On the first act
 * of a night it also announces what will go wrong. It sits over the boards and never takes a click.
 */
export function ActSlate({ kicker, title, quip, twist, onDone }: {
  kicker: string; title: string; quip: string; twist?: Level['twist']; onDone: () => void
}) {
  const { audio } = useStageSound()
  useEffect(() => { audio.effect('clack') }, [audio])
  return <div className="ba-act-slate" role="status" onAnimationEnd={event => { if (event.target === event.currentTarget) onDone() }}>
    <span className="ba-act-kicker">{kicker}</span>
    <strong>{title}</strong>
    <em>“{quip}” <small>— the director</small></em>
    {twist && <span className="ba-act-twist">Tonight: <b>{twist.name}</b>. {twist.line}</span>}
  </div>
}

/** Stage fright: beads of sweat fly off the understudy until someone takes hold of it. */
export function StageFright({ pose }: { pose: PuppetPose }) {
  const { brow, angle } = useHead(pose)
  return <svg className="ba-twist-layer ba-fright-sweat" viewBox="0 0 500 360" aria-hidden="true" focusable="false">
    <g transform={`translate(${brow.x} ${brow.y}) rotate(${angle})`}>
      <path d="M0 0 Q-4 6 0 9 Q4 6 0 0Z" />
      <path d="M9 7 Q6 11 9 14 Q12 11 9 7Z" />
    </g>
  </svg>
}

/** Catch!: the stagehand's shout from the wings as the prop sails on. */
export function HeadsUp({ from }: { from: 'left' | 'right' }) {
  return <span className="ba-heads-up" data-from={from} aria-hidden="true">Heads up! <small>the stagehand, from the flies</small></span>
}

/** Feel it: the cue's mood, lit when the actor is wearing it. A hit in the mood earns a star. */
export function MoodBadge({ mood, label, wearing, earned }: { mood: FaceShape; label: string; wearing: boolean; earned: boolean }) {
  const { audio } = useStageSound()
  useEffect(() => { if (earned) audio.effect('sparkle') }, [audio, earned])
  return <div className="ba-mood-badge" data-wearing={wearing || undefined} data-earned={earned || undefined}>
    <svg viewBox="-31 -22 62 48" width="30" height="24" aria-hidden="true">
      <path d="m-29-15 4-5 44 1 8-3 1 6 1 29-6 8-42 2-9-7z" stroke="#5e5845" strokeWidth="2" strokeLinejoin="round" fill="#d7b67c" />
      <ActorFace shape={mood} />
    </svg>
    <span>{earned ? <>Method acting! <b>+1 <Star size={12} aria-hidden="true" /></b></> : <>Feel it: <b>{label}</b>{wearing && ' ✓'}</>}</span>
  </div>
}

const apologies = ['Sorry! Wrong lever!', 'Who sat on the fuse box?', 'It’s fine! Keep going!', 'Has anyone seen a torch?', 'That was the kettle. Sorry.']

/** Lights out: every few seconds the whole hall goes dark, with an apology from the wings. */
export function BlackoutCurtain({ seed }: { seed: number }) {
  const { audio } = useStageSound()
  // In step with the curtain's seven-second cycle: the fuse fries as it goes dark, the breaker clunks back.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const cycle = (at: number, cue: 'zap' | 'clunk') => timers.push(setTimeout(function again() {
      audio.effect(cue, .8)
      timers.push(setTimeout(again, 7000))
    }, at))
    cycle(4480, 'zap')
    cycle(6160, 'clunk')
    return () => timers.forEach(clearTimeout)
  }, [audio])
  return <div className="ba-blackout" aria-hidden="true"><span>{apologies[seed % apologies.length]}</span></div>
}
/** In the dark only the actor's eyes show. This layer sits over the puppet, in step with the curtain. */
export function BlackoutEyes({ pose }: { pose: PuppetPose }) {
  const { left, right } = useHead(pose)
  return <svg className="ba-twist-layer ba-blackout-eyes" viewBox="0 0 500 360" aria-hidden="true" focusable="false">
    <circle cx={left.x} cy={left.y} r="4.2" /><circle cx={right.x} cy={right.y} r="4.2" />
  </svg>
}

const heckles = [
  'It’s a sandwich!', 'Interpretive dance!', 'He’s being a teapot!', 'Is it a lighthouse?', 'Bring back the real actor!',
  'Ooh, a hat stand!', 'Waiting for a bus!', 'That’s my uncle!', 'Is it… modern art?', 'Boo! No wait, yay!',
]

/** Heckler: a voice from the balcony shouts confident nonsense through the act. */
export function Heckler({ seed }: { seed: number }) {
  const [line, setLine] = useState<number | null>(null)
  const { audio } = useStageSound()
  useEffect(() => {
    let shown = seed
    let pause: ReturnType<typeof setTimeout> | undefined
    const shout = () => { setLine(shown); audio.effect('heckle', .75) }
    const first = setTimeout(shout, 2200)
    const cycle = setInterval(() => {
      shown += 3
      setLine(null)
      pause = setTimeout(shout, 450)
    }, 4200)
    return () => { clearTimeout(first); clearInterval(cycle); clearTimeout(pause) }
  }, [seed, audio])
  return <div className="ba-heckler" aria-hidden="true">
    <svg viewBox="0 0 120 90" focusable="false" strokeLinecap="round" strokeLinejoin="round">
      {/* A man in a flat cap, mid-shout, a tomato ready in his raised fist. */}
      <path d="M28 62 Q30 45 49 42 Q68 45 71 62Z" fill="#3e5a7a" stroke="#2a221c" strokeWidth="2" />
      <path d="M64 48 L83 25" stroke="#2a221c" strokeWidth="11" />
      <path d="M64 48 L83 25" stroke="#3e5a7a" strokeWidth="7" />
      <circle cx="86" cy="20" r="6" fill="#e9c59a" stroke="#2a221c" strokeWidth="2" />
      <circle cx="92" cy="11" r="6.5" fill="#d8392f" stroke="#2a221c" strokeWidth="2" />
      <path d="M89.5 5.5 L92 7.5 L94.5 5" stroke="#3d6a37" strokeWidth="2" fill="none" />
      <circle cx="48" cy="30" r="12.5" fill="#e9c59a" stroke="#2a221c" strokeWidth="2" />
      <path d="M34 26 Q45 12 61 22 L66 25 L34 28Z" fill="#4a5a3c" stroke="#2a221c" strokeWidth="2" />
      <path d="M43 29 L49 31 M53 31 L58 29" stroke="#2a221c" strokeWidth="1.9" fill="none" />
      <ellipse cx="52" cy="37" rx="3.8" ry="3.3" fill="#2a221c" />
      <path d="M0 57 H120 V90 H0Z" fill="#a8332c" />
      <path d="M0 57 H120" stroke="#e2b34f" strokeWidth="3" />
      <path d="M0 63 H120" stroke="#e2b34f" strokeWidth="1.4" />
      <path d="M8 72 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0" fill="none" stroke="#e06a5e" strokeWidth="2" />
    </svg>
    {line !== null && <p key={line}>{heckles[line % heckles.length]}</p>}
  </div>
}
