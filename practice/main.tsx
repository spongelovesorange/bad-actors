import { createRoot } from 'react-dom/client'
import '../src/typography.css'
import { StageSoundProvider } from '../src/rehearsal/StageSound'
import Rehearsal from '../src/rehearsal/Rehearsal'

createRoot(document.getElementById('root')!).render(<StageSoundProvider><Rehearsal accountAvailable={false} /></StageSoundProvider>)
