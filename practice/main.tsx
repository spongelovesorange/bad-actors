import { createRoot } from 'react-dom/client'
import '../src/typography.css'
import Rehearsal from '../src/rehearsal/Rehearsal'

createRoot(document.getElementById('root')!).render(<Rehearsal accountAvailable={false} />)
