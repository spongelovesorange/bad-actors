import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createCrowdAudio } from './crowd-audio'

type SoundMode = 'off' | 'on' | 'unavailable'
const Sound = createContext<{
  audio: ReturnType<typeof createCrowdAudio>
  mode: SoundMode; setPower: (on: boolean) => void
  roomTone: boolean; setRoom: (on: boolean) => void
  music: boolean; setMusic: (on: boolean) => void
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
  const [music, setMusicState] = useState(true)
  const request = useRef(0)
  const restore = useRef(false)
  // The demo that offers "Let’s play! Sound on" opens every visit. The sound choice is kept in
  // localStorage, because a per-tab preference left returning players in a silent hall.
  function setRoom(on: boolean) {
    setRoomTone(on)
    audio.setRoom(on)
    try { localStorage.setItem('ba-room-tone', on ? 'on' : 'off') } catch { /* Optional preference. */ }
  }
  function setMusic(on: boolean) {
    setMusicState(on)
    audio.setMusic(on)
    try { localStorage.setItem('ba-music', on ? 'on' : 'off') } catch { /* Optional preference. */ }
  }
  async function setPower(on: boolean) {
    const ticket = ++request.current
    restore.current = false
    try { localStorage.setItem('ba-stage-sound', on ? 'on' : 'off') } catch { /* Optional preference. */ }
    if (!on) { audio.dispose(); setMode('off'); return }
    const success = await audio.enable()
    if (ticket !== request.current) return
    setMode(success ? 'on' : 'unavailable')
    if (success) audio.button('punch')
  }
  useEffect(() => {
    let room = true, band = true
    try {
      // Browsers still need a gesture: a returning player's first click or key turns it back on.
      restore.current = localStorage.getItem('ba-stage-sound') === 'on'
      room = localStorage.getItem('ba-room-tone') !== 'off'
      band = localStorage.getItem('ba-music') !== 'off'
    } catch { /* Private browsing starts silent. */ }
    audio.setRoom(room)
    setRoomTone(room)
    audio.setMusic(band)
    setMusicState(band)
    const visibility = () => audio.setOnstage(!document.hidden)
    const activate = (event: Event) => {
      if (!event.isTrusted || (event.target instanceof Element && event.target.closest('[data-sound-power]'))) return
      if (restore.current) void setPower(true)
      // Sound is on but the browser paused it (Safari can, after sleep or a long while away).
      else audio.wake()
    }
    const click = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest('button,a[href],summary,[role="button"]')
      // Controls marked data-sound make their own noise: a prop pops, a face boings.
      if (!control || control.matches(':disabled,[aria-disabled="true"],[data-handle],[data-sound-power],[data-sound]')) return
      const cue = control.closest('.ba-cue,.ba-box-office,dialog,summary,.ba-nav-room') ? 'paper'
        : control.closest('.ba-dock') ? 'wood' : 'punch'
      audio.button(cue)
    }
    const change = (event: Event) => {
      if (event.target instanceof Element && event.target.matches('select,input[type="radio"],input[type="checkbox"]') && !event.target.closest('[data-sound]')) audio.button('paper')
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
  return <Sound.Provider value={{audio, mode, setPower, roomTone, setRoom, music, setMusic}}>{children}</Sound.Provider>
}
