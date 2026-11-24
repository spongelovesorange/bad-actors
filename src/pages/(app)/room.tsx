import { useCallback, useMemo, useRef, useState } from 'react'
import { AuthOverlay, getAuthToken, signOut, useAuthStatus, useAuthUser, useMutations, useQuery } from 'deepspace'
import { ArrowRight, Ticket } from 'lucide-react'
import { APP_ID } from '../../constants'
import Rehearsal, { Brand } from '../../rehearsal/Rehearsal'
import { createAudience } from '../../rehearsal/audience-round'
import { raceAction } from '../../rehearsal/race-client'
import { raceName } from '../../race'
import type { Best } from '../../rehearsal/show'
import type { LevelId } from '../../deck'
import { useSearchParams } from 'react-router-dom'
import '../../rehearsal/rehearsal.css'

const hostedAudience = createAudience('hosted', getAuthToken)

type BestRow = { level: number; score: number; stars: number }

/** The player's best show on each night, kept with their account. Only their own rows ever arrive. */
function useAccountBest() {
  const { records } = useQuery<BestRow>('show_bests')
  const { create, put } = useMutations<BestRow>('show_bests')
  const saved = useMemo(() => {
    const best: Best = {}
    for (const { data } of records)
      if (Number.isInteger(data.level) && data.level >= 1 && data.level <= 5) best[data.level as LevelId] = { score: data.score, stars: data.stars }
    return best
  }, [records])
  const save = useCallback((level: LevelId, evening: { score: number; stars: number }) => {
    const row = records.find(record => record.data.level === level)
    if (row) void put(row.recordId, evening)
    else void create({ level, ...evening })
  }, [records, create, put])
  return { saved, save }
}

export default function RoomEntry() {
  const [params] = useSearchParams()
  const mode = params.get('play')
  const requestedPlay = mode === 'draw' || mode === 'rehearse' ? mode : undefined
  const [showAuth, setShowAuth] = useState(Boolean(requestedPlay))
  const { isLoaded, isSignedIn, status, userId } = useAuthStatus()
  const { user } = useAuthUser()
  const trigger = useRef<HTMLButtonElement>(null)
  function closeAuth() {
    setShowAuth(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  const ready = Boolean(APP_ID)
  const accountBest = useAccountBest()
  const [opening, setOpening] = useState(false)
  /** Opens a race room with a fresh code and takes the host there. */
  async function openRace() {
    if (opening) return
    setOpening(true)
    const reply = await raceAction<{ code: string }>('raceCreate', { name: raceName(user?.firstName || user?.fullName) })
    if (reply.ok) { window.location.assign(`/race?code=${reply.data.code}&from=room`); return }
    setOpening(false)
    window.alert(reply.error)
  }
  const signIn = <button className="ba-dark-button" type="button" data-testid="nav-sign-in-button" ref={trigger} onClick={() => setShowAuth(true)}>Sign in <ArrowRight size={16}/></button>
  if (ready && isLoaded && isSignedIn) {
    return <><title>Stage · Bad Actors</title><meta name="robots" content="noindex"/>
      <Rehearsal key={userId} hostedAudience={hostedAudience} requestedPlay={requestedPlay} onRace={openRace}
        savedBest={accountBest.saved} onBest={accountBest.save}
        accountControl={<>
          <span data-testid="nav-user-name">{user?.firstName || 'Signed in'}</span>
          <button type="button" className="ba-nav-room" onClick={() => { setShowAuth(false); void signOut() }}>Sign out</button>
        </>} />
    </>
  }
  return <div className="ba-room">
    <title>Room · Bad Actors</title><meta name="robots" content="noindex"/>
    <header className="ba-masthead"><nav className="ba-wrap ba-nav" aria-label="Main navigation" data-testid="app-navigation"><Brand/><a className="ba-nav-room" href="/">Rehearsal <ArrowRight size={16}/></a></nav></header>
    <main className="ba-room-main"><div className="ba-stamp"><Ticket aria-hidden="true"/></div>
      <h1>Backstage</h1>
      <p role="status">{!ready ? 'This preview is open for rehearsal. Sign-in needs a connected Bad Actors app.' :
        !isLoaded ? 'Checking your sign-in…' :
        'Sign in to visit the AI booth. The public stage is open for practice.'}</p>
      {ready && status === 'error' && <p>Sign-in could not connect. Rehearsal is available below.</p>}
      <div className="ba-room-actions">{ready && isLoaded && !isSignedIn && signIn}<a href="/" className="ba-back">Return to your stage</a></div>
    </main>
    {ready && isLoaded && showAuth && !isSignedIn && <AuthOverlay title="Join Bad Actors" description="Sign in with your DeepSpace account." onClose={closeAuth}/>}
  </div>
}
