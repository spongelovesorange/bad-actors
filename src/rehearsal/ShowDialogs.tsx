import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowRight, Lock, Sparkles, Star, Timer, X } from 'lucide-react'
import { deck, levels, type Cue, type LevelId } from '../deck'
import { ActorFace } from '../puppet/ActorFace'
import { PalmDrawing } from '../puppet/PuppetArt'
import { PropDrawing } from './PropDrawing'
import { actsPerShow, cuesInLevel, reviewFor, scoreOf, starsFor, unlockScore, unlocked, type ActResult, type Best } from './show'
import './show.css'

/** A modal sheet on the hall's paper stock. Escape and a click outside both close it. */
function StageDialog({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    node?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    return () => node?.close()
  }, [])
  return <dialog ref={ref} className={'ba-dialog ba-show-dialog' + (wide ? ' ba-dialog-wide' : '')} aria-labelledby="ba-show-dialog-title"
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const r = event.currentTarget.getBoundingClientRect()
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close()
    }}>
    <button type="button" className="ba-dialog-x" aria-label="Close" onClick={close}><X size={19} /></button>
    <h2 id="ba-show-dialog-title" tabIndex={-1}>{title}</h2>
    {children}
  </dialog>
}

const Stars = ({ count, of = 3 }: { count: number; of?: number }) =>
  <span className="ba-stars" aria-label={`${count} of ${of} stars`}>
    {Array.from({ length: of }, (_, i) => <Star key={i} size={15} aria-hidden="true" data-lit={i < count || undefined} />)}
  </span>

/** A cue's card picture: its pose sheet, else its prop, its face or its hand. */
function CueIcon({ cue, number }: { cue: Cue; number: number }) {
  if (cue.sketch) return <img src={`/blocking/${cue.sketch}.png`} alt="" width="44" height="44" />
  if (cue.prop) return <span className="ba-deck-icon" aria-hidden="true"><PropDrawing kind={cue.prop} /></span>
  if (cue.mood) return <span className="ba-deck-icon" aria-hidden="true">
    <svg viewBox="-31 -22 62 48"><path d="m-29-15 4-5 44 1 8-3 1 6 1 29-6 8-42 2-9-7z" stroke="#5e5845" strokeWidth="2" strokeLinejoin="round" fill="#d7b67c" /><ActorFace shape={cue.mood} /></svg>
  </span>
  if (cue.hand) return <span className="ba-deck-icon" aria-hidden="true">
    <svg viewBox="-30 -36 60 58" strokeLinecap="round" strokeLinejoin="round"><PalmDrawing shape={cue.hand} /></svg>
  </span>
  return <span className="ba-deck-number" aria-hidden="true">{number}</span>
}

/** Free play: every cue in the deck, grouped by level. */
export function DeckDialog({ current, pick, close }: { current: number; pick: (cue: number) => void; close: () => void }) {
  return <StageDialog title="Pick a cue" close={close} wide>
    <p className="ba-show-lede">No clock. Strike the pose, then press <b>Ready</b> and Stubbs takes a look.</p>
    {levels.map(level => <section key={level.id} className="ba-deck-level" aria-label={level.name}>
      <h3>{level.name} <small>{level.blurb}</small> <span className="ba-deck-twist">{level.twist.name}</span></h3>
      <div className="ba-deck-cards">
        {cuesInLevel(level.id).map(index => <button key={index} type="button" className="ba-deck-card"
          aria-pressed={index === current} onClick={() => pick(index)}>
          <CueIcon cue={deck[index]} number={index + 1} />
          <span>{deck[index].title}</span>
        </button>)}
      </div>
    </section>)}
  </StageDialog>
}

/** Tonight's show: choose a night. Each goes wrong in its own way; the next opens at three acts guessed. */
export function ShowDialog({ best, start, close }: { best: Best; start: (level: LevelId) => void; close: () => void }) {
  return <StageDialog title="Tonight’s show" close={close} wide>
    <p className="ba-show-lede">{actsPerShow} acts a night, five looks per act. Every night something goes wrong. Guess {unlockScore} acts to open the next.</p>
    <div className="ba-level-cards">
      {levels.map(level => {
        const open = unlocked(level.id, best)
        const record = best[level.id]
        return <button key={level.id} type="button" className="ba-level-card" data-level={level.id} disabled={!open} onClick={() => start(level.id)}>
          <span className="ba-level-name">{open ? null : <Lock size={16} aria-hidden="true" />} Level {level.id} · {level.name}</span>
          <span className="ba-level-blurb">{level.blurb}</span>
          <span className="ba-level-twist"><Sparkles size={14} aria-hidden="true" /> <b>{level.twist.name}:</b> {level.twist.line}
            <span className="ba-level-time"><Timer size={13} aria-hidden="true" /> {level.seconds}s</span></span>
          <span className="ba-level-best">{!open ? `Guess ${unlockScore} acts in Level ${level.id - 1} to open`
            : record ? <>Best: {record.score}/{actsPerShow} · {record.stars} ★</> : 'Not played yet'}</span>
          {open && <ArrowRight className="ba-level-go" size={20} aria-hidden="true" />}
        </button>
      })}
    </div>
  </StageDialog>
}

/** The curtain call: every act's frozen pose, what Stubbs said, and his notice for the evening. */
export function CurtainDialog({ level, results, best, again, next, close }: {
  level: LevelId; results: ActResult[]; best: Best; again: () => void; next?: () => void; close: () => void
}) {
  const { score, stars } = scoreOf(results)
  const name = levels.find(entry => entry.id === level)?.name
  return <StageDialog title="Curtain call" close={close} wide>
    <p className="ba-curtain-score"><b>{score}/{actsPerShow}</b> acts guessed · {stars} ★ <small>Level {level} · {name}</small></p>
    <blockquote className="ba-curtain-review">“{reviewFor(score, level)}” <cite>Mr. Stubbs, front row</cite></blockquote>
    <ol className="ba-curtain-acts">
      {results.map((result, i) => <li key={i} data-guessed={result.guessed || undefined}>
        {result.image ? <img src={result.image} alt={`Act ${i + 1} pose`} width="64" height="64" /> : <span className="ba-curtain-empty" aria-hidden="true">?</span>}
        <span><b>{deck[result.cue].title}</b>
          <small>{result.line ? `“${result.line}”` : 'Stubbs never got a look.'}</small>
          {result.feeling && <small className="ba-curtain-method">Method acting: +1 ★</small>}</span>
        <Stars count={starsFor(result)} of={result.feeling ? 4 : 3} />
      </li>)}
    </ol>
    <p className="ba-curtain-best">Best for this level: {best[level]?.score ?? score}/{actsPerShow}</p>
    <div className="ba-book-actions ba-curtain-actions">
      <button type="button" className="ba-dark-button" onClick={again}>Play again <ArrowRight size={16} /></button>
      {next && <button type="button" className="ba-dark-button ba-curtain-next" onClick={next}>Next level <ArrowRight size={16} /></button>}
      <button type="button" className="ba-quiet-entry" onClick={close}>Back to the stage</button>
    </div>
  </StageDialog>
}
