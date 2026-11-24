import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthOverlay, getAuthToken, signOut, useAuthStatus, useAuthUser } from 'deepspace'
import { ArrowRight, Flag } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { APP_ID } from '../../constants'
import { raceName, readRaceCode } from '../../race'
import Rehearsal, { Brand } from '../../rehearsal/Rehearsal'
import { RaceBoard, RaceCodeForm } from '../../rehearsal/RaceBoard'
import { createAudience } from '../../rehearsal/audience-round'
import { raceAction, useRaceRoom, type RaceProgress } from '../../rehearsal/race-client'
import '../../rehearsal/rehearsal.css'

const hostedAudience = createAudience('hosted', getAuthToken)

/** /race?code=KXTP — a race room. Anyone with the link can sit down once they have signed in. */
export default function RaceEntry() {
  const [params] = useSearchParams()
  const code = readRaceCode(params.get('code'))
  const { isLoaded, isSignedIn, userId } = useAuthStatus()
  const { user } = useAuthUser()
  const [showAuth, setShowAuth] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const ready = Boolean(APP_ID)
  if (ready && isLoaded && isSignedIn && userId && code) {
    return <><title>Race · Bad Actors</title><meta name="robots" content="noindex" />
      <RaceRoom key={code + userId} code={code} me={userId} skipDemo={params.get('from') === 'room'}
        name={raceName(user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress.split('@')[0])} />
    </>
  }
  return <div className="ba-room">
    <title>Race · Bad Actors</title><meta name="robots" content="noindex" />
    <header className="ba-masthead"><nav className="ba-wrap ba-nav" aria-label="Main navigation" data-testid="app-navigation"><Brand /><a className="ba-nav-room" href="/">Rehearsal <ArrowRight size={16} /></a></nav></header>
    <main className="ba-room-main"><div className="ba-stamp"><Flag aria-hidden="true" /></div>
      <h1>{code ? `Race ${code}` : 'Race room'}</h1>
      <p role="status">{!code ? 'Type the four letters your friend sent you, or open their invite link.' :
        !ready ? 'Races need a connected Bad Actors app.' :
        !isLoaded ? 'Checking your sign-in…' : 'Sign in to take your seat. Same cue, two stages: first to make Stubbs say it wins.'}</p>
      {!code && <RaceCodeForm label="Race code" />}
      <div className="ba-room-actions">
        {code && ready && isLoaded && !isSignedIn && <button className="ba-dark-button" type="button" data-testid="nav-sign-in-button" ref={trigger} onClick={() => setShowAuth(true)}>Sign in <ArrowRight size={16} /></button>}
        <a href="/room" className="ba-back">Go backstage</a>
      </div>
    </main>
    {code && ready && isLoaded && showAuth && !isSignedIn && <AuthOverlay title="Join the race" description="Sign in with your DeepSpace account."
      onClose={() => { setShowAuth(false); requestAnimationFrame(() => trigger.current?.focus()) }} />}
  </div>
}

function RaceRoom({ code, me, name, skipDemo }: { code: string; me: string; name: string; skipDemo: boolean }) {
  const [seat, setSeat] = useState({ looking: false, looks: 0 })
  const [joined, setJoined] = useState<true | string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [dealt, setDealt] = useState(0)
  // What the other players see of this stage while it acts: kept in presence, never stored.
  const progress = useMemo<RaceProgress>(() => ({ phase: !dealt ? 'lobby' : seat.looking ? 'looking' : 'posing', looks: seat.looks }), [dealt, seat])
  const room = useRaceRoom(code, me, progress)
  useEffect(() => { setDealt(room.round) }, [room.round])
  useEffect(() => {
    let live = true
    void raceAction('raceJoin', { code, name }).then(reply => { if (live) setJoined(reply.ok ? true : reply.error) })
    return () => { live = false }
  }, [code, name])
  const onProgress = useCallback((next: { looking: boolean; looks: number }) =>
    setSeat(previous => previous.looking === next.looking && previous.looks === next.looks ? previous : next), [])
  // The referee checks the AI booth itself. A busy booth gets a few more tries before the player hears about it.
  const finishing = useRef(0)
  const onFinished = useCallback(() => {
    const attempt = ++finishing.current
    const send = async (tries: number): Promise<void> => {
      const reply = await raceAction('raceFinish', { code })
      if (reply.ok || attempt !== finishing.current) return
      if (tries < 3 && ['booth_unavailable', 'offline', 'not_finished'].includes(reply.code ?? '')) {
        setTimeout(() => void send(tries + 1), 1500)
        return
      }
      setError(reply.error)
    }
    setError(undefined)
    void send(0)
  }, [code])
  async function deal() {
    setBusy(true)
    setError(undefined)
    const reply = await raceAction('raceStart', { code })
    setBusy(false)
    if (!reply.ok) setError(reply.error)
  }
  const leave = () => window.location.assign('/room')
  if (typeof joined === 'string' || room.missing) return <div className="ba-room">
    <header className="ba-masthead"><nav className="ba-wrap ba-nav" aria-label="Main navigation"><Brand /><a className="ba-nav-room" href="/room">Backstage <ArrowRight size={16} /></a></nav></header>
    <main className="ba-room-main"><div className="ba-stamp"><Flag aria-hidden="true" /></div>
      <h1>Race {code}</h1>
      <p role="alert">{typeof joined === 'string' ? joined : `No race has the code ${code}.`}</p>
      <RaceCodeForm label="Try another code" />
      <div className="ba-room-actions"><a href="/room" className="ba-dark-button">Open your own race <ArrowRight size={16} /></a></div>
    </main>
  </div>
  const board = <RaceBoard room={room} code={code} me={me} busy={busy || joined === undefined} error={error} onDeal={deal} onLeave={leave} />
  return <Rehearsal key={me} hostedAudience={hostedAudience} skipDemo={skipDemo}
    race={{ round: room.round, cue: room.race?.cue ?? 0, board, onFinished, onProgress }}
    accountControl={<>
      <span data-testid="nav-user-name">{name}</span>
      <button type="button" className="ba-nav-room" onClick={() => void signOut()}>Sign out</button>
    </>} />
}
