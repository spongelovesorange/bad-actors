/**
 * The newer props from the hall's cupboard. Each is drawn about its own middle, with the hand's
 * grip where geometry.ts puts it, so the same art serves the stage and the tray buttons.
 */
const ink = '#302d27'

/** A stage microphone, held by the handle under its mesh ball. */
export function Microphone() {
  return <g transform="scale(1.2)" strokeWidth="2.1">
    <path d="M-5-3 L5-3 L3.2 19 Q0 23-3.2 19Z" fill="#36383a" />
    <path d="M-1.6 2 L-1.2 15" fill="none" stroke="#6f7376" strokeWidth="1.4" />
    <rect x="-6.5" y="-6.5" width="13" height="4.5" rx="1.6" fill="#8f979c" />
    <circle cx="0" cy="-14" r="9.5" fill="#c3c9cc" />
    <path d="M-8-18 L8-18 M-9.5-14 L9.5-14 M-8-10 L8-10 M-4-22.5 L-4-5.5 M0-23.5 L0-4.5 M4-22.5 L4-5.5"
      fill="none" stroke="#7f888d" strokeWidth="1.1" />
    <path d="M-5.5-19 Q-3-21.5 0-22" fill="none" stroke="#eef1f2" strokeWidth="1.6" />
  </g>
}

/** A red-and-cream umbrella, drawn full size. The hand closes on the shaft above the wooden crook. */
export function Umbrella() {
  return <g transform="scale(1.45)" strokeWidth="2.1"><UmbrellaShape /></g>
}
function UmbrellaShape() {
  const canopy = 'M-38-26 Q-36-54 0-56 Q36-54 38-26 Q32-31 25-26 Q19-32 12.5-26 Q6-32 0-26 Q-6-32-12.5-26 Q-19-32-25-26 Q-32-31-38-26Z'
  return <g>
    <path d="M0-26 L0 24" fill="none" strokeWidth="3.2" />
    <path d="M0 23 Q0 33-6.5 33 Q-12 33-12 27.5" fill="none" strokeWidth="5.6" />
    <path d="M0 23 Q0 33-6.5 33 Q-12 33-12 27.5" fill="none" stroke="#8a5b33" strokeWidth="2.6" />
    <path d={canopy} fill="#c9473b" stroke="none" />
    <path d="M0-56 Q-27-46-25-26 Q-19-32-12.5-26 Q-14-44 0-56Z M0-56 Q27-46 25-26 Q19-32 12.5-26 Q14-44 0-56Z" fill="#efe2b8" stroke="none" />
    <path d="M0-56 Q-14-44-12.5-26 M0-56 Q14-44 12.5-26 M0-56 Q-27-46-25-26 M0-56 Q27-46 25-26"
      fill="none" stroke="#8e2f27" strokeWidth="1.3" />
    <path d={canopy} fill="none" />
    <path d="M0-56 L0-62" fill="none" strokeWidth="3" />
  </g>
}

/** A ripe banana, stem down, curving away from the thumb. */
export function Banana() {
  return <g transform="scale(1.25)" strokeWidth="2">
    <path d="M-3 13 C-12 2-10-14 3-22 L6-21 C-2-12-2 2 4 12Z" fill="#f3cf45" />
    <path d="M3-18 C-3-10-3 3 2.5 10.5" fill="none" stroke="#c79a2a" strokeWidth="1.5" />
    <path d="M3-22 L6-21 L5.5-24.5Z" fill="#5a4325" strokeWidth="1.5" />
    <path d="M-3 13 L4 12 L3 17.5 L-2 17.5Z" fill="#7a5b2c" strokeWidth="1.8" />
  </g>
}

/** An open hardback, held up by the bottom of its spine. */
export function OpenBook() {
  return <g transform="scale(1.1)" strokeWidth="2.3">
    <path d="M0 13 L-27 9 L-27-15 L0-11 L27-15 L27 9Z" fill="#8a3b2f" />
    <path d="M0 10.5 L-24 6.5 L-24-15.5 Q-12-14 0-11.5Z M0 10.5 L24 6.5 L24-15.5 Q12-14 0-11.5Z" fill="#f6eedb" strokeWidth="1.8" />
    <path d="M-20-9 L-5-7 M-20-4 L-5-2 M-20 1 L-5 3 M5-7 L20-9 M5-2 L20-4 M5 3 L20 1"
      fill="none" stroke="#a1937a" strokeWidth="1.2" />
    <path d="M0-11.5 L0 10.5" fill="none" strokeWidth="1.6" />
  </g>
}

/** A single red rose, held by the stem below its leaves. */
export function Rose() {
  return <g transform="scale(1.3)" strokeWidth="1.9">
    <path d="M0 21 Q-2 6 0-6" fill="none" strokeWidth="5" />
    <path d="M0 21 Q-2 6 0-6" fill="none" stroke="#3d6a37" strokeWidth="2.6" />
    <path d="M-1 7 Q-11 4-13-3 Q-5-3-1 4Z M1 12 Q10 10 12 4 Q4 4 1 10Z" fill="#5f9150" strokeWidth="1.6" />
    <path d="M0-5 Q-10-7-9-16 Q-7-25 0-22 Q7-25 9-16 Q10-7 0-5Z" fill="#c63a3d" />
    <path d="M-4-15 Q0-20 4-15 Q2-10-3-12" fill="none" stroke="#7c1f24" strokeWidth="1.3" />
    <path d="M-4-6 L0-3 L4-6" fill="none" stroke="#3d6a37" strokeWidth="1.6" />
  </g>
}

/** The rubber chicken: held by its feet, beak open in a silent squawk, eyes crossed out. */
export function RubberChicken() {
  return <g transform="scale(1.4)" strokeWidth="2"><ChickenShape /></g>
}
function ChickenShape() {
  return <g>
    <path d="M-3-22 L-3-12 M3-22 L3-12" fill="none" stroke="#e0892b" strokeWidth="2.6" />
    <path d="M-7-27 L-3-22 L-4-28.5 M-3-22 L0-27 M7-27 L3-22 L4-28.5 M3-22 L0-27" fill="none" stroke="#e0892b" strokeWidth="1.8" />
    <path d="M-10-12 Q-14 2-6 12 L-4 16 Q-6 22-3 28 Q0 32 4 28 Q7 22 5 16 L7 12 Q15 0 10-12 Q0-17-10-12Z" fill="#f3d641" />
    <path d="M-7-4 Q-1 1 7-4 Q2 5-6 2Z" fill="#e6c234" strokeWidth="1.5" />
    <path d="M-3.5 29.5 Q-8.5 30-8.5 35 Q-5.5 34.5-4 32Z" fill="#d8392f" strokeWidth="1.4" />
    <path d="M1 31 L3.5 39.5 L6.5 31Z" fill="#ef9a2c" strokeWidth="1.4" />
    <path d="M0.4 24.6 L3.4 27.6 M3.4 24.6 L0.4 27.6" fill="none" stroke={ink} strokeWidth="1.3" />
  </g>
}
