import { useId, useState, type FormEvent } from 'react'
import { ArrowRight, Copy, Flag, LogOut } from 'lucide-react'
import { formatRaceTime, maxRacers, minRacers, readRaceCode } from '../race'
import type { useRaceRoom } from './race-client'
import './race.css'

type Room = ReturnType<typeof useRaceRoom>
const places = ['1st', '2nd', '3rd', '4th', '5th', '6th']

/**
 * The box a friend's four letters go in, like the code box on a Jackbox or Kahoot join screen.
 * Case and spaces don't matter. The race page then checks that the room exists.
 */
export function RaceCodeForm({ label, from }: { label: string; from?: 'room' }) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState<string>()
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = readRaceCode(typed)
    if (!code) { setProblem('A race code is four consonants, like KXTP.'); return }
    window.location.assign(`/race?code=${code}${from ? `&from=${from}` : ''}`)
  }
  return <form className="ba-race-join" onSubmit={join} noValidate data-testid="race-join">
    <label htmlFor={id}>{label}</label>
    <input id={id} name="code" value={typed} placeholder="KXTP" maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false}
      aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-problem` : undefined}
      onChange={event => { setTyped(event.target.value); setProblem(undefined) }} />
    <button type="submit">Join <ArrowRight size={16} aria-hidden="true" /></button>
    {problem && <p id={`${id}-problem`} role="alert">{problem}</p>}
  </form>
}

/**
 * The race desk under the stage, built like the party games it borrows from: the room code in
 * big letters (Jackbox, Kahoot), a roster that fills in live with who is here, every opponent's
 * progress while you act (TypeRacer), and the finishing order with one button for the next round.
 */
export function RaceBoard({ room, code, me, busy, error, onDeal, onLeave }: {
  room: Room; code: string; me: string; busy: boolean; error?: string
  onDeal: () => void; onLeave: () => void
}) {
  const { race, round, players, results, mine, online, progressOf, everyoneDone } = room
  const [copied, setCopied] = useState(false)
  const host = race?.host === me
  const hostName = race?.hostName || 'the host'
  const place = (userId: string) => results.findIndex(result => result.userId === userId)
  // Finishers in order, then whoever is still acting, in the order they sat down.
  const roster = round ? [...players].sort((a, b) => {
    const pa = place(a.userId), pb = place(b.userId)
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb)
  }) : players
  function status(userId: string) {
    const result = results.find(entry => entry.userId === userId)
    if (result) return result.outcome === 'guessed'
      ? `${formatRaceTime(result.ms)} · ${result.looks} ${result.looks === 1 ? 'look' : 'looks'}` : 'Out of looks'
    if (!online(userId)) return 'Away'
    if (!round) return 'Ready'
    const live = progressOf(userId)
    return live?.phase === 'looking' ? `Stubbs is looking · look ${(live.looks ?? 0) + 1}` : live?.phase === 'posing' ? 'Posing…' : 'Taking a seat…'
  }
  const winner = results[0]?.outcome === 'guessed' ? results[0] : undefined
  let line: string
  if (!round) line = host
    ? players.length < minRacers ? `Send the code to a friend. Up to ${maxRacers} can race.` : 'Everyone here? Deal the first cue.'
    : `Waiting for ${hostName} to deal the first cue.`
  else if (!mine) line = 'Same cue for everyone. First to make Stubbs say it wins.'
  else if (!everyoneDone) line = mine.outcome === 'guessed' ? `You got it in ${formatRaceTime(mine.ms)}! Waiting for the others.` : 'Out of looks. Cheer on the others.'
  else line = winner ? `${winner.userId === me ? 'You win' : winner.name + ' wins'} round ${round}!` : 'Nobody got it. Stubbs blames the lighting.'
  // Like a Kahoot lobby, the host's start button is there from the start, waiting for a second player.
  const canDeal = host && (!round || Boolean(mine))
  const waiting = !round && players.length < minRacers
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/race?code=${code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* The code is on screen to read out instead. */ }
  }
  return <section className="ba-race-board" aria-label="Race" data-testid="race-board" data-round={round}>
    <header className="ba-race-head">
      <span className="ba-race-label"><Flag size={15} aria-hidden="true" /> {round ? `Race · round ${round}` : 'Race room'}</span>
      <strong className="ba-race-code" aria-label={'Room code ' + code.split('').join(' ')} data-testid="race-code">{code}</strong>
      <button type="button" className="ba-race-copy" onClick={copy}><Copy size={14} aria-hidden="true" /> {copied ? 'Link copied' : 'Copy invite link'}</button>
    </header>
    <ol className="ba-race-roster" aria-label="Players">
      {roster.map(player => {
        const at = place(player.userId)
        return <li key={player.userId} data-me={player.userId === me || undefined} data-online={online(player.userId) || undefined}
          data-place={at >= 0 && results[at].outcome === 'guessed' ? at + 1 : undefined} data-out={results[at]?.outcome === 'out' || undefined}>
          <span className="ba-race-place">{at >= 0 && results[at].outcome === 'guessed' ? places[at] : ''}</span>
          <span className="ba-race-dot" aria-hidden="true" />
          <b>{player.name}{player.userId === me && <small> (you)</small>}{player.userId === race?.host && <small> · host</small>}</b>
          <span className="ba-race-status">{status(player.userId)}</span>
        </li>
      })}
    </ol>
    <p className="ba-race-line" role="status">{line}</p>
    {error && <p className="ba-race-error" role="alert">{error}</p>}
    <div className="ba-race-actions">
      {canDeal && <button type="button" className="ba-race-deal" disabled={busy || waiting} onClick={onDeal}>
        {!round ? 'Start the race' : everyoneDone ? 'Next round' : 'Next round now'}
      </button>}
      <button type="button" className="ba-race-leave" onClick={onLeave}><LogOut size={14} aria-hidden="true" /> Leave race</button>
    </div>
  </section>
}
