import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Eye, Pause, Play } from 'lucide-react'
import { PuppetStage } from '../puppet'
import { AudienceCritic } from './AudienceCritic'
import { CueSign, Drapes } from './ActCurtain'
import { GhostHand } from './GhostHand'
import { PropDrawing } from './PropDrawing'
import { demoFrame, demoLength, demoStill, wristPath } from './how-to-play'
import './handbook.css'
import './how-to-play.css'

const steps = [
  { title: 'Read the cue', note: 'The curtain opens on what to act out.' },
  { title: 'Drag the puppet', note: 'Grab a hand, a knee or the head.' },
  { title: 'Add a prop', note: 'Phone, cup or tray, if the cue needs one.' },
  { title: 'Press Ready', note: 'Stubbs guesses from the pose alone.' },
]
const trail = Array.from({ length: 41 }, (_, i) => wristPath(i / 40))
const props = ['phone', 'cup', 'plate'] as const

function prefersStill() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * The silent demo that opens the handbook: the curtain opens on a cue, then a white glove plays one
 * whole round on the real puppet, so a newcomer sees where to look and where to touch before reading
 * a word. Reduced motion shows the finished scene.
 */
export function HowToPlay({ children }: { children?: ReactNode }) {
  const [still] = useState(prefersStill)
  const [playing, setPlaying] = useState(!still)
  const [time, setTime] = useState(still ? demoStill : 0)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last: number | undefined
    const tick = (now: number) => {
      // A slow frame or a hidden tab carries on from where it was rather than skipping ahead.
      if (last !== undefined) {
        const step = Math.min(now - last, 80)
        setTime(t => (t + step) % demoLength)
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  const f = demoFrame(time)
  const drawn = Math.round(f.trail * (trail.length - 1))
  return <div className="ba-howto">
    <div className="ba-howto-stage" data-step={f.step}>
      <div className="ba-howto-film" aria-hidden="true">
        <div className="ba-howto-boards">
          <span className="ba-howto-cue">Cue: <b>Talking on the phone</b></span>
          <PuppetStage pose={f.pose} interactive={false} />
          <svg className="ba-howto-trail" viewBox="0 0 500 360" focusable="false">
            {drawn > 0 && <polyline points={trail.slice(0, drawn + 1).map(p => `${p.x},${p.y}`).join(' ')} />}
            {f.grip && <circle cx={f.grip.x} cy={f.grip.y} r="15" />}
          </svg>
          {f.curtain < 1 && <div className="ba-act-curtain ba-howto-curtain" style={{ '--open': f.curtain } as CSSProperties}>
            <Drapes />
            {f.sign < 1 && <CueSign kicker="Your cue" title="Talking on the phone"
              style={{ translate: `-50% ${(-f.sign * 70).toFixed(2)}cqw` }} />}
          </div>}
          <div className="ba-howto-critic">
            {f.line && <p key={f.line} className="ba-howto-balloon">{f.line}</p>}
            <AudienceCritic mood={f.critic} jaw={f.critic === 'guess' ? 'open' : 'closed'} />
          </div>
          {f.stamp && <span className="ba-howto-stamp">DING!</span>}
          {f.stamp && <span className="ba-howto-confetti">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</span>}
        </div>
        <div className="ba-howto-tray" />
        {props.map(kind => <span key={kind} className="ba-howto-chip" data-kind={kind}
          data-pressed={(kind === 'phone' && f.chip) || undefined}><PropDrawing kind={kind} /></span>)}
        <span className="ba-howto-ready" data-state={f.ready}>{f.ready === 'looking' ? 'Looking…' : 'Ready!'} <Eye size={15} /></span>
        {f.tap && <span className="ba-howto-tap" style={{
          left: `${f.tap.x}%`, top: `${f.tap.y}%`, opacity: 1 - f.tap.age, scale: String(.35 + f.tap.age * 1.1),
        }} />}
        {f.hand && <GhostHand className="ba-howto-hand" style={{
          left: `${f.hand.x}%`, top: `${f.hand.y}%`, opacity: f.hand.opacity, scale: f.hand.pressed ? '.84' : '1',
        }} />}
      </div>
      {!still && <button type="button" className="ba-howto-pause" aria-label={playing ? 'Pause the demo' : 'Play the demo'}
        onClick={() => setPlaying(on => !on)}>
        {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
      </button>}
    </div>
    <div className="ba-howto-side">
      <ol className="ba-howto-steps">
        {steps.map((step, i) => <li key={step.title} aria-current={!still && f.step === i ? 'step' : undefined}>
          <b>{step.title}</b><span>{step.note}</span>
        </li>)}
      </ol>
      {children}
    </div>
  </div>
}
