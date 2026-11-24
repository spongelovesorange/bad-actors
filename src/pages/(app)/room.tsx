import { useRef, useState } from 'react'
import { AuthOverlay, getAuthToken, signOut, useAuthStatus, useAuthUser } from 'deepspace'
import { ArrowRight, Ticket } from 'lucide-react'
import { APP_ID } from '../../constants'
import Rehearsal, { Brand } from '../../rehearsal/Rehearsal'
import { createAudience } from '../../rehearsal/audience-round'
import { useSearchParams } from 'react-router-dom'
import '../../rehearsal/rehearsal.css'

const hostedAudience = createAudience('hosted', getAuthToken)

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
  const signIn = <button className="ba-dark-button" type="button" data-testid="nav-sign-in-button" ref={trigger} onClick={() => setShowAuth(true)}>Sign in <ArrowRight size={16}/></button>
  if (ready && isLoaded && isSignedIn) {
    return <><title>Stage · Bad Actors</title><meta name="robots" content="noindex"/>
      <Rehearsal key={userId} hostedAudience={hostedAudience} requestedPlay={requestedPlay}
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
