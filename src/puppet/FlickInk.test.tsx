import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FlickInk, flickAt, traceFlick } from './FlickInk'
import { initialPose } from './geometry'
import { PuppetArt } from './PuppetArt'
import { PuppetStage } from './PuppetStage'
import { stillMotion } from './motion'

describe('drag feedback on the stage', () => {
  it('shows two tapered marks behind a swift pull and fades when the pointer stops', () => {
    const pull = traceFlick({ x: 0, y: -20 }, 12, 310)
    expect(pull?.angle).toBe(-90)
    expect(flickAt(pull, 325)?.opacity).toBe(1)
    expect(flickAt(pull, 388)?.opacity).toBeCloseTo(0.36)
    expect(flickAt(pull, 416)).toBeUndefined()
    const mark = renderToStaticMarkup(<FlickInk handle="right" point={{ x: 320, y: 120 }} angle={-90} opacity={1} />)
    expect(mark).toContain('rotate(-90) translate(-17 0)')
    expect(mark).toContain('pointer-events="none"')
    expect(mark.match(/<path/g)).toHaveLength(2)
    expect(mark).not.toContain('<text')
  })

  it('ignores jitter and deliberate placement and never appears in an observation or spectator view', () => {
    expect(traceFlick({ x: 0.1, y: -0.2 }, 2, 0)).toBeUndefined()
    expect(traceFlick({ x: 0, y: -20 }, 110, 0)).toBeUndefined()
    const pose = initialPose()
    const shot = renderToStaticMarkup(<PuppetArt pose={pose} motion={{ ...stillMotion, body: 16, head: -19 }} />)
    const watching = renderToStaticMarkup(<PuppetStage pose={pose} interactive={false} />)
    expect(shot).not.toContain('ba-flick-ink')
    expect(watching).not.toContain('ba-flick-ink')
    expect(watching).not.toContain('data-handle=')
  })
})
