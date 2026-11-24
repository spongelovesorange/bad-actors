import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createCrowdAudio } from './crowd-audio'

type SoundMode = 'off' | 'on' | 'unavailable'
const Sound = createContext<{
  audio: ReturnType<typeof createCrowdAudio>
  mode: SoundMode; setPower: (on: boolean) => void
  roomTone: boolean; setRoom: (on: boolean) => void
} | null>(null)
export function useStageSound() {
  const value = useContext(Sound)
  if (!value) throw Error('Missing stage sound provider')
  return value
}

export function StageSoundProvider({children}: {children: ReactNode}) {
  const [audio] = useState(createCrowdAudio)
  const [mode, setMode] = useState<SoundMode>('off')
  const [roomTone, setRoomTone] = useState(true)
  const request = useRef(0)
  const restore = useRef(false)
  function setRoom(on: boolean) {
    setRoomTone(on)
    audio.setRoom(on)
    try { sessionStorage.setItem('ba-room-tone', on ? 'on' : 'off') } catch { /* Optional preference. */ }
  }
  async function setPower(on: boolean) {
    const ticket = ++request.current
    restore.current = false
    try { sessionStorage.setItem('ba-stage-sound', on ? 'on' : 'off') } catch { /* Optional preference. */ }
    if (!on) { audio.dispose(); setMode('off'); return }
    const success = await audio.enable()
    if (ticket !== request.current) return
    setMode(success ? 'on' : 'unavailable')
    if (success) audio.button('punch')
  }
  useEffect(() => {
    let room = true
    try {
      restore.current = sessionStorage.getItem('ba-stage-sound') === 'on'
      room = sessionStorage.getItem('ba-room-tone') !== 'off'
    } catch { /* Private browsing starts silent. */ }
    audio.setRoom(room)
    setRoomTone(room)
    const visibility = () => audio.setOnstage(!document.hidden)
    const activate = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-sound-power]')) return
      if (restore.current && event.isTrusted) void setPower(true)
    }
    const click = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest('button,a[href],summary,[role="button"]')
      if (!control || control.matches(':disabled,[aria-disabled="true"],[data-handle],[data-sound-power]')) return
      const cue = control.closest('.ba-cue,.ba-box-office,dialog,summary,.ba-nav-room') ? 'paper'
        : control.closest('.ba-dressing,.ba-adjust') ? 'wood' : 'punch'
      audio.button(cue)
    }
    const change = (event: Event) => {
      if (event.target instanceof Element && event.target.matches('select,input[type="radio"],input[type="checkbox"]')) audio.button('paper')
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('pointerdown', activate, true)
    document.addEventListener('keydown', activate, true)
    document.addEventListener('click', click, true)
    document.addEventListener('change', change, true)
    return () => {
      ++request.current
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('pointerdown', activate, true)
      document.removeEventListener('keydown', activate, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('change', change, true)
      audio.dispose()
    }
  }, [audio])
  return <Sound.Provider value={{audio, mode, setPower, roomTone, setRoom}}>{children}</Sound.Provider>
}
