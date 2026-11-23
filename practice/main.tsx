import { createRoot } from 'react-dom/client'
import Rehearsal from '../src/rehearsal/Rehearsal'

createRoot(document.getElementById('root')!).render(<Rehearsal accountAvailable={false} />)
