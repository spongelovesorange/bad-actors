import { Suspense, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DeepSpaceAuthProvider, RecordProvider, RecordScope } from 'deepspace'
import { SCOPE_ID } from '../../constants'
import { schemas } from '../../schemas'
import { useToast } from '@/components/ui'

/** The app's record room: race rooms, rosters and results, and each player's best shows, all live. */
function Records({ children }: { children: ReactNode }) {
  const { error, warning } = useToast()
  return <RecordProvider allowAnonymous onWriteError={e => e.kind === 'permission' ? warning(e.title, e.detail) : error(e.title, e.detail)}>
    <RecordScope roomId={SCOPE_ID} schemas={schemas}>{children}</RecordScope>
  </RecordProvider>
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const outlet = <Suspense fallback={<p role="status">Opening backstage…</p>}><Outlet/></Suspense>
  // /home only redirects to /room, so it opens no socket.
  return <DeepSpaceAuthProvider>{pathname === '/home' ? outlet : <Records>{outlet}</Records>}</DeepSpaceAuthProvider>
}
