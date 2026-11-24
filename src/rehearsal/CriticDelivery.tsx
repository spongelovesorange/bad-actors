import { useLayoutEffect, useMemo, useState } from 'react'
import { AudienceCritic, type CriticMood } from './AudienceCritic'
import { BoothReferee, type RefereeMood } from './BoothReferee'
import { scoreLine } from './critic-speech'
import type { TwistId } from '../deck'
import './critic-speech.css'

type DeliveryProps = {
  line: string
  mood: CriticMood
  observationId?: string
  referee: RefereeMood
  onVoiceBeat: (glyph: string) => void
  onDelivered: (id: string) => void
  animate: boolean
  /** Stubbs holds his glove up while his recorded line is on its way. */
  hold?: boolean
  /** Length of the recorded line in ms; the lettering keeps time with it. */
  pace?: number
  /** Called as the first letter appears, to start the recorded line with it. */
  onStart?: () => void
  /** Tonight's trouble, which colours how Stubbs behaves. */
  night?: TwistId
}

/** A new utterance mounts a fresh performance. The announcement lives outside it. */
export function CriticDelivery({ line, mood, observationId, referee, onVoiceBeat, onDelivered, animate, hold, pace, onStart, night }: DeliveryProps) {
  const { words, beats } = useMemo(() => scoreLine(line), [line])
  const [count, setCount] = useState<number | null>(null)
  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let tick: ReturnType<typeof setTimeout>
    const finish = () => {
      clearTimeout(tick)
      setCount(null)
      if (observationId) onDelivered(observationId)
    }
    if (animate && hold && !document.hidden) {
      setCount(0)
      return
    }
    if (!animate || !beats.length || preference.matches || document.hidden) {
      if (animate && !document.hidden) onStart?.()
      finish()
      return
    }
    const written = beats.reduce((total, beat) => total + beat.duration, 0)
    const scale = pace ? pace / written : 1
    const reveal = (visible: number) => {
      const beat = beats[visible - 1]
      if (visible === 1) onStart?.()
      if (beat.jaw !== 'closed') onVoiceBeat(beat.glyph)
      setCount(visible)
      tick = setTimeout(() => {
        if (visible === beats.length) finish()
        else reveal(visible + 1)
      }, beat.duration * scale)
    }
    const onVisibility = () => { if (document.hidden) finish() }
    const onPreference = () => { if (preference.matches) finish() }
    if (observationId) {
      setCount(0)
      tick = setTimeout(() => reveal(1), 210)
    } else reveal(1)
    document.addEventListener('visibilitychange', onVisibility)
    preference.addEventListener('change', onPreference)
    return () => {
      clearTimeout(tick)
      document.removeEventListener('visibilitychange', onVisibility)
      preference.removeEventListener('change', onPreference)
    }
  }, [animate, beats, observationId, onDelivered, onVoiceBeat, hold, pace, onStart])

  const performing = count !== null && animate
  const visible = performing ? count : beats.length
  const speaking = performing && visible > 0
  const jaw = speaking ? beats[visible - 1]?.jaw ?? 'closed' : 'closed'
  const awaitingReaction = performing && (Boolean(observationId) || mood === 'miss')
  const gesture = observationId && performing && visible <= 4 ? (visible === 0 ? 'raise' : 'hold') : 'rest'
  return <div className="ba-audience-seat-row">
    <div className="ba-front-patron">
      <p className="ba-audience-balloon" aria-hidden="true" data-revealed={visible} data-length={beats.length} data-speaking={speaking}
        data-size={beats.length > 36 ? 'long' : undefined}>
        {words.map(word =>
          <span key={word[0].index} className={/^\s/u.test(word[0].glyph) ? undefined : 'ba-speech-word'}>
            {word.map(beat => <span className="ba-speech-letter" key={beat.index} data-visible={beat.index < visible}>{beat.glyph}</span>)}
          </span>
        )}
      </p>
      <div className="ba-critic-portrait">
        <AudienceCritic mood={awaitingReaction ? 'guess' : mood} jaw={jaw} gesture={gesture} night={night} />
        <strong>Mr. Stubbs<small>AI guesser</small></strong>
      </div>
    </div>
    <div className="ba-referee-station" data-referee-mood={referee}>
      <BoothReferee mood={referee} />
    </div>
  </div>
}
