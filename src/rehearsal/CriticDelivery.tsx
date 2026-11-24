import { useLayoutEffect, useMemo, useState } from 'react'
import { AudienceCritic, type CriticMood } from './AudienceCritic'
import { BoothReferee, type RefereeMood } from './BoothReferee'
import { scoreLine } from './critic-speech'
import './critic-speech.css'

type DeliveryProps = {
  line: string
  mood: CriticMood
  observationId?: string
  referee: RefereeMood
  onVoiceBeat: (glyph: string) => void
  onDelivered: (id: string) => void
  animate: boolean
}

/** A new utterance mounts a fresh performance. The announcement lives outside it. */
export function CriticDelivery({ line, mood, observationId, referee, onVoiceBeat, onDelivered, animate }: DeliveryProps) {
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
    if (!animate || !beats.length || preference.matches || document.hidden) {
      finish()
      return
    }
    const reveal = (visible: number) => {
      const beat = beats[visible - 1]
      if (beat.jaw !== 'closed') onVoiceBeat(beat.glyph)
      setCount(visible)
      tick = setTimeout(() => {
        if (visible === beats.length) finish()
        else reveal(visible + 1)
      }, beats[visible - 1].duration)
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
  }, [animate, beats, observationId, onDelivered, onVoiceBeat])

  const performing = count !== null && animate
  const visible = performing ? count : beats.length
  const speaking = performing && visible > 0
  const jaw = speaking ? beats[visible - 1]?.jaw ?? 'closed' : 'closed'
  const awaitingReaction = performing && (Boolean(observationId) || mood === 'miss')
  const gesture = observationId && performing && visible <= 4 ? (visible === 0 ? 'raise' : 'hold') : 'rest'
  return <div className="ba-audience-seat-row">
    <div className="ba-front-patron">
      <p className="ba-audience-balloon" aria-hidden="true" data-revealed={visible} data-length={beats.length} data-speaking={speaking}>
        {words.map(word =>
          <span key={word[0].index} className={/^\s/u.test(word[0].glyph) ? undefined : 'ba-speech-word'}>
            {word.map(beat => <span className="ba-speech-letter" key={beat.index} data-visible={beat.index < visible}>{beat.glyph}</span>)}
          </span>
        )}
      </p>
      <div className="ba-critic-portrait">
        <AudienceCritic mood={awaitingReaction ? 'guess' : mood} jaw={jaw} gesture={gesture} />
        <strong>Mr. Stubbs<small>AI guesser</small></strong>
      </div>
    </div>
    <div className="ba-referee-station" data-referee-mood={referee}>
      <BoothReferee mood={referee} />
    </div>
  </div>
}
