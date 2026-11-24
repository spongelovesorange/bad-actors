import type { PropKind } from '../puppet'
import { ServingTray } from '../puppet/PuppetArt'
import { Phone } from '../puppet/Phone'
import { Banana, Microphone, OpenBook, Rose, RubberChicken, Umbrella } from '../puppet/props'

// The tray sketches reuse the stage drawings, laid at an angle to fit a 56 × 43 card.
const laid: Partial<Record<PropKind, { art: () => React.JSX.Element; at: string }>> = {
  mic: { art: Microphone, at: 'translate(28 22) rotate(-24) scale(.66)' },
  umbrella: { art: Umbrella, at: 'translate(29 27) rotate(-14) scale(.28)' },
  banana: { art: Banana, at: 'translate(28 22) rotate(58) scale(.74)' },
  book: { art: OpenBook, at: 'translate(28 22) rotate(-6) scale(.78)' },
  rose: { art: Rose, at: 'translate(28 22) rotate(-38) scale(.62)' },
  chicken: { art: RubberChicken, at: 'translate(28 20) rotate(74) scale(.4)' },
}

/** The small prop sketches on the tray buttons and in the how-to-play demo. */
export function PropDrawing({ kind }: { kind: PropKind }) {
  const sketch = laid[kind]
  return (
    <svg
      viewBox="0 0 56 43"
      aria-hidden="true"
      className="ba-prop-art"
      stroke="#343c33"
      strokeWidth="2.1"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {sketch ? (
        <g transform={sketch.at}><sketch.art /></g>
      ) : kind === 'phone' ? (
        <g transform="translate(28 21) rotate(-10) scale(.82)"><Phone width={1} edge={0} /></g>
      ) : kind === 'cup' ? (
        <g transform="rotate(-5 28 23)">
          <path d="M34 13h5c9 0 9 14 1 15l-6 1" fill="#98594b" />
          <path d="M35 18h4q4 0 3 4t-6 3" fill="#edece3" />
          <path d="M10 11h26v15q-1 10-12 11-13-1-14-12z" fill="#aa6855" />
          <ellipse cx="23" cy="11.5" rx="13" ry="4.5" fill="#ebe0b9" />
          <path d="M14 12q10-4 18 0" fill="none" stroke="#765d47" />
          <path d="M14 18v5" fill="none" stroke="#dba88b" />
        </g>
      ) : (
        <g transform="translate(28 23) rotate(-7) scale(.48)"><ServingTray /></g>
      )}
    </svg>
  )
}
