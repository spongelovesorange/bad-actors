import { Seo } from '../components/Seo'
import { seo } from '../seo'
import Rehearsal from '../rehearsal/Rehearsal'
import { APP_ID } from '../constants'

export default function Landing() {
  return <><Seo {...seo} path="/" /><Rehearsal accountAvailable={Boolean(APP_ID)}/></>
}
