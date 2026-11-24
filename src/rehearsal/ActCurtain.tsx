import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Level } from '../deck'
import { useStageSound } from './StageSound'
import './act-curtain.css'

/** How long each beat of the curtain lasts, in milliseconds. A night's warning and a stuck curtain add their own. */
export const curtainBeats = { close: 450, read: 2300, twist: 1700, open: 900, stuck: 1150 }
/** The drum roll is this long, and starts so that it ends as the curtain opens. */
const rollMs = 1750
/** Every so often the curtain sticks halfway and somebody in the wings has to give it a yank. */
export const curtainSticks = (seed: number) => seed % 5 === 3

// Notices pasted across the corner of the board. The whole house is one critic, after all.
const sashes = ['Sold out · 1 seat', 'Understudy on tonight', 'No refunds', 'By popular demand', 'Mostly rehearsed', 'Lead still off sick']
const yanks = ['It’s stuck! Nobody panic!', 'Derek! The rope!', 'One sec. It does this.']

/** The two halves of the house curtain, hanging from their rod. */
export function Drapes() {
  return <>
    <span className="ba-drape ba-drape-left" aria-hidden="true" />
    <span className="ba-drape ba-drape-right" aria-hidden="true" />
  </>
}

/** The cue in big letters on a board of bulbs, hung from two ropes in front of the closed curtain. */
export function CueSign({ kicker, title, quip, twist, sash, style, children }: {
  kicker: string; title: string; quip?: string; twist?: Level['twist']; sash?: string; style?: CSSProperties
  /** Hangs below the board and moves with it. */
  children?: ReactNode
}) {
  return <div className="ba-cue-sign" style={style}>
    <div className="ba-cue-sign-board">
      <div className="ba-cue-sign-paper">
        <span className="ba-cue-sign-kicker">{kicker}</span>
        <strong className="ba-cue-sign-title">{title}</strong>
        {quip && <em className="ba-cue-sign-quip">“{quip}” <small>— the director</small></em>}
        {twist && <span className="ba-cue-sign-twist">Tonight: <b>{twist.name}</b>. {twist.line}</span>}
      </div>
    </div>
    {sash && <span className="ba-cue-sign-sash" aria-hidden="true">{sash}</span>}
    {children}
  </div>
}

type Beat = 'closing' | 'reading' | 'opening'

/**
 * The house curtain at the top of every act. It closes over the boards, the stagehands lower the
 * cue on a big board under the follow spot, and after a drum roll the curtain parts on the actor.
 * A click on the curtain, or any move the player makes, opens it at once. Stubbs sits in the front
 * row, in front of it all, and the act's clock waits until the curtain is open.
 */
export function ActCurtain({ seed, kicker, title, quip, twist, rush, onOpen }: {
  seed: number; kicker: string; title: string; quip: string; twist?: Level['twist']
  /** The player has started acting: open now. */
  rush: boolean
  onOpen: () => void
}) {
  const { audio } = useStageSound()
  const [beat, setBeat] = useState<Beat>('closing')
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const hurry = useRef(false)
  const opened = useRef(onOpen)
  opened.current = onOpen
  const jam = curtainSticks(seed) && !still
  const read = curtainBeats.read + (twist ? curtainBeats.twist : 0)
  function open() {
    hurry.current = true
    setBeat(current => current === 'reading' ? 'opening' : current)
  }
  useEffect(() => {
    if (!rush) return
    hurry.current = true
    setBeat(current => current === 'reading' ? 'opening' : current)
  }, [rush])
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, then: () => void) => { timers.push(setTimeout(then, ms)) }
    if (beat === 'closing') {
      if (!still) audio.effect('drape', .6, 1.35)
      at(still ? 0 : curtainBeats.close, () => setBeat(hurry.current ? 'opening' : 'reading'))
    } else if (beat === 'reading') {
      // The board lands on its ropes, then a roll on the snare while the house reads it.
      if (!still) at(330, () => audio.effect('clack', .5))
      at(read - rollMs, () => audio.effect('roll', .75))
      at(read, () => setBeat('opening'))
    } else {
      const part = () => { audio.effect('tada', .85); audio.effect('drape', .7) }
      if (jam) { audio.cut('roll'); audio.effect('rattle', .9); at(curtainBeats.stuck - 120, part) } else part()
      at(still ? 350 : curtainBeats.open + (jam ? curtainBeats.stuck : 0), () => opened.current())
    }
    return () => timers.forEach(clearTimeout)
  }, [beat, audio, still, jam, read])
  // Leaving in the middle of an act stops the drum roll along with the curtain.
  useEffect(() => () => audio.cut('roll'), [audio])
  return <div className="ba-act-curtain" data-testid="act-curtain" data-beat={beat} data-jam={jam || undefined} onClick={open}>
    <Drapes />
    <span className="ba-curtain-spot" aria-hidden="true" />
    <div role="status" className="ba-curtain-billing">
      <CueSign kicker={kicker} title={title} quip={quip} twist={twist} sash={sashes[seed % sashes.length]}>
        {beat === 'reading' && <span className="ba-curtain-skip" aria-hidden="true">
          <span className="ba-curtain-skip-mouse">Click</span><span className="ba-curtain-skip-touch">Tap</span> the curtain to start
        </span>}
      </CueSign>
    </div>
    {jam && beat === 'opening' && <span className="ba-curtain-yank" aria-hidden="true">
      {yanks[Math.floor(seed / 5) % yanks.length]} <small>the stagehand</small>
    </span>}
  </div>
}
