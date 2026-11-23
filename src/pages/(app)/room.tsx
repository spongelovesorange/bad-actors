import { useEffect, useRef, useState } from 'react'
import { AuthOverlay, useAuthStatus, useAuthUser } from 'deepspace'
import { ArrowRight, Ticket } from 'lucide-react'
import { APP_ID } from '../../constants'
import { Brand } from '../../rehearsal/Rehearsal'
import '../../rehearsal/rehearsal.css'

export default function RoomEntry() {
  const [showAuth, setShowAuth] = useState(false)
  const { isLoaded, isSignedIn, status } = useAuthStatus()
  const { user } = useAuthUser()
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isSignedIn) return
    setShowAuth(false)
    try {
      if (sessionStorage.getItem('bad-actors:return-after-auth') === 'yes') {
        sessionStorage.removeItem('bad-actors:return-after-auth')
        window.location.replace('/')
      }
    } catch { /* The return link remains available if storage is disabled. */ }
  }, [isSignedIn])
  function openAuth() {
    try { sessionStorage.setItem('bad-actors:return-after-auth', 'yes') } catch { /* Private browsing. */ }
    setShowAuth(true)
  }
  function closeAuth() {
    try { sessionStorage.removeItem('bad-actors:return-after-auth') } catch { /* Private browsing. */ }
    setShowAuth(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  const ready = Boolean(APP_ID)
  const signIn = <button className="ba-dark-button" type="button" data-testid="nav-sign-in-button" ref={trigger} onClick={openAuth}>Sign in <ArrowRight size={16}/></button>
  return <div className="ba-room">
    <title>Room · Bad Actors</title><meta name="robots" content="noindex"/>
    <header className="ba-masthead"><nav className="ba-wrap ba-nav" aria-label="Main navigation" data-testid="app-navigation"><Brand/><a className="ba-nav-room" href="/">Rehearsal <ArrowRight size={16}/></a></nav></header>
    <main className="ba-room-main"><div className="ba-stamp"><Ticket aria-hidden="true"/></div>
      <h1>Backstage</h1>
      <p role="status">{!ready ? 'This preview is open for rehearsal. Sign-in needs a connected Bad Actors app.' :
        !isLoaded ? 'Checking your sign-in…' : isSignedIn ? <>Signed in{user?.firstName ? <> as <strong data-testid="nav-user-name">{user.firstName}</strong></> : ''}. The rehearsal stage is open. Live rounds are in development.</> :
        'Sign in to Bad Actors. You can also keep practicing on the public stage.'}</p>
      {ready && status === 'error' && <p>Sign-in could not connect. Rehearsal is available below.</p>}
      <div className="ba-room-actions">{ready && isLoaded && !isSignedIn && signIn}<a href="/" className="ba-back">Return to your stage</a></div>
    </main>
    {showAuth && !isSignedIn && <AuthOverlay title="Join Bad Actors" description="Sign in with your DeepSpace account." onClose={closeAuth}/>}
  </div>
}
