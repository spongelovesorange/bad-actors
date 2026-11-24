import { useId } from 'react'
import type { Hand, HandShape } from '../puppet/geometry'
import { PalmDrawing } from '../puppet/PuppetArt'

export const handShapeOptions = [
  { value: 'relaxed', label: 'Relaxed', viewBox: '-22 -15 44 36' },
  { value: 'open', label: 'Open palm', viewBox: '-30 -32 60 54' },
  { value: 'fist', label: 'Fist', viewBox: '-22 -15 44 36' },
  { value: 'peace', label: 'Peace sign', viewBox: '-30 -36 60 58' },
] satisfies { value: HandShape; label: string; viewBox: string }[]

type HandShapePickerProps = {
  side: Hand
  value: HandShape
  heldProp?: string
  disabled: boolean
  onChange: (shape: HandShape) => void
}

export function HandShapePicker({ side, value, heldProp, disabled, onChange }: HandShapePickerProps) {
  const name = useId()
  const description = name + '-grip'
  const chosen = handShapeOptions.find(option => option.value === value)!
  return (
    <fieldset className="ba-hand-picker" disabled={disabled} aria-describedby={heldProp ? description : undefined}>
      <legend>{side === 'left' ? 'Left hand' : 'Right hand'}</legend>
      <div className="ba-hand-options">
        {handShapeOptions.map(({ value: shape, label, viewBox }) => (
          <label className="ba-hand-option" key={shape}>
            <input type="radio" name={name} value={shape}
              checked={value === shape} onChange={() => onChange(shape)} />
            <span className="ba-hand-card">
              <svg viewBox={viewBox} width="43" height="35" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
                <g transform={side === 'left' ? 'scale(-1 1)' : undefined}>
                  <path d="m-4 6 9-.5 2 14-9 1z" fill="#80735a" stroke="#302d27" strokeWidth="1.8" />
                  <path d="m-.6 16 5-1" fill="none" stroke="#bfa47a" strokeWidth="1.3" />
                  <PalmDrawing shape={shape} />
                </g>
              </svg>
              <span>{label}</span>
            </span>
          </label>
        ))}
      </div>
      {heldProp && <small id={description}>Put down the {heldProp} to switch to “{chosen.label}”.</small>}
    </fieldset>
  )
}
