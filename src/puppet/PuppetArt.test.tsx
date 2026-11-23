import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActorFace } from './ActorFace'
import { handShape, initialPose, moveHandle, putDown, rotate, withHandShape, withProp, type FaceShape, type HandShape, type PuppetPose } from './geometry'
import { PuppetArt } from './PuppetArt'
import { advanceMotion, computeRig, createMotion, stillMotion, tug } from './motion'

const eyeX = (svg: string, eye: 'left-eye' | 'right-eye') => {
  const marker = svg.match(new RegExp(`data-landmark="${eye}" cx="([^"]+)"`))
  if (!marker) throw new Error(`Missing ${eye}`)
  return Number(marker[1])
}

describe('the sandbag face', () => {
  it('keeps five different embroidered expressions with the same drinking contact', () => {
    const faces: FaceShape[] = ['flat', 'side-eye', 'braced', 'smile', 'open']
    const features = faces.map(shape => {
      const svg = renderToStaticMarkup(<ActorFace shape={shape} landmarks />)
      expect(svg).toContain('data-landmark="mouth" cx="5" cy="14"')
      expect(svg).toContain('data-landmark="nose" cx="1" cy="1"')
      return svg.replace(/data-face="[^"]+"/, '')
    })
    expect(new Set(features).size).toBe(5)
    expect(eyeX(features[1], 'left-eye')).toBeLessThan(eyeX(features[0], 'left-eye'))
  })

  it('moves both eyes together on a hard recoil and replays the same frozen glance', () => {
    const pose = { ...stillMotion, head: -17, body: 15 }
    const neutral = renderToStaticMarkup(<ActorFace shape="flat" landmarks />)
    const recoil = renderToStaticMarkup(<ActorFace shape="flat" motion={pose} landmarks />)
    for (const eye of ['left-eye', 'right-eye'] as const) {
      expect(eyeX(recoil, eye)).toBeLessThan(eyeX(neutral, eye) - 4)
    }
    expect(renderToStaticMarkup(<ActorFace shape="flat" motion={{ ...pose }} landmarks />)).toBe(recoil)
    expect(renderToStaticMarkup(<ActorFace shape="flat" motion={{ ...stillMotion, head: 2, body: 1 }} landmarks />)).toBe(neutral)
    expect(renderToStaticMarkup(<ActorFace shape="flat" />)).not.toContain('data-landmark')
  })
})

describe('player-selected hands', () => {
  const handsOverEyes = moveHandle(moveHandle(initialPose(), 'left', { x: 233, y: 92 }), 'right', { x: 269, y: 92 })

  it('paints three different silhouettes at identical wrist coordinates in front of the eyes', () => {
    const shapes: HandShape[] = ['relaxed', 'open', 'fist']
    const outlines = shapes.map(shape => {
      const pose = withHandShape(handsOverEyes, 'left', shape)
      const art = renderToStaticMarkup(<PuppetArt pose={pose} />)
      const marker = art.indexOf(`data-palm="left" data-palm-shape="${shape}"`)
      expect(marker).toBeGreaterThan(art.indexOf('data-landmark="left-eye"'))
      expect(pose.left).toBe(handsOverEyes.left)
      expect(handShape(pose, 'right')).toBe('relaxed')
      const outline = art.slice(marker).match(/<path d="([^"]+)"/)?.[1]
      expect(outline).toBeDefined()
      return outline
    })
    expect(new Set(outlines).size).toBe(shapes.length)
    expect(withHandShape(handsOverEyes, 'left', 'relaxed')).toBe(handsOverEyes)
  })

  it('uses the prop grip while held and restores each authored shape on release or handoff', () => {
    const authored = withHandShape(withHandShape(handsOverEyes, 'left', 'open'), 'right', 'fist')
    const held = withProp(authored, 'cup')
    const draw = (pose: PuppetPose) => renderToStaticMarkup(<PuppetArt pose={pose} />)
    expect(draw(held)).toContain('data-palm="right" data-palm-shape="grip"')
    const passed: PuppetPose = { ...held, holder: 'left' }
    expect(draw(passed)).toContain('data-palm="right" data-palm-shape="fist"')
    expect(draw(passed)).toContain('data-palm="left" data-palm-shape="grip"')
    const released = putDown(passed)
    expect(draw(released)).toContain('data-palm="left" data-palm-shape="open"')
    expect(draw(released)).toContain('data-palm="right" data-palm-shape="fist"')
    expect(draw(structuredClone(released))).toBe(draw(released))
  })
})

describe('articulated stage artwork', () => {
  it('draws a posed shoulder, elbow, waist, ankle, knee and head at their pickable geometry', () => {
    const pose: PuppetPose = {
      ...initialPose(),
      joints: {
        waist: { x: 14, y: 9 }, chest: { x: 10, y: 0 }, headTilt: { x: -25, y: 0 },
        leftShoulder: { x: -9, y: -14 }, leftElbow: { x: -12, y: 17 },
        rightKnee: { x: -10, y: 1 }, rightAnkle: { x: 11, y: -15 },
      },
    }
    const rig = computeRig(pose, stillMotion)
    const saved = renderToStaticMarkup(<PuppetArt pose={pose} />)
    expect(renderToStaticMarkup(<PuppetArt pose={pose} rig={rig} />)).toBe(saved)
    const { leftShoulder, leftElbow, rightKnee, rightAnkle } = rig.joints
    expect(saved).toContain(`data-shoulder="${leftShoulder.x},${leftShoulder.y}"`)
    expect(saved).toContain(`${leftElbow.x} ${leftElbow.y} Q`)
    expect(saved).toContain(`data-knee="right" cx="${rightKnee.x}" cy="${rightKnee.y}"`)
    expect(saved).toContain(`data-sole="right" transform="translate(${rightAnkle.x} ${rightAnkle.y}) rotate(${rig.footAngle.right})`)
    expect(saved).toContain(`data-rig="torso" transform="${rig.matrix}"`)
    expect(saved).toContain(`rotate(${rig.headAngle})`)
  })

  it('keeps planted boots behind the sack and draws a raised toe in front, below the hands', () => {
    const atRest = renderToStaticMarkup(<PuppetArt pose={initialPose()} />)
    for (const foot of ['left', 'right']) {
      expect(atRest.indexOf(`data-sole="${foot}"`)).toBeLessThan(atRest.indexOf('data-rig="torso"'))
    }
    const step: PuppetPose = { ...initialPose(), joints: { leftAnkle: { x: -22, y: -37 } } }
    const raised = renderToStaticMarkup(<PuppetArt pose={step} />)
    const toe = raised.indexOf('data-sole="left"')
    expect(toe).toBeGreaterThan(raised.indexOf('data-rig="torso"'))
    expect(toe).toBeLessThan(raised.indexOf('data-arm="left"'))
    expect(raised.indexOf('data-sole="right"')).toBeLessThan(raised.indexOf('data-rig="torso"'))
  })

  it('replays a grabbed head corner and paints the neck to the rotating underside of the head', () => {
    const pose = initialPose()
    const motion = { ...stillMotion, head: -20, body: 14, balance: 4 }
    const grip = { handle: 'headTilt' as const, point: { x: 283, y: 71 } }
    const rig = computeRig(pose, motion, grip)
    const head = rig.pose.head
    const top = rotate({ x: head.x - 2, y: head.y + 23 }, head, rig.headAngle)
    const frame = renderToStaticMarkup(<PuppetArt pose={pose} motion={motion} grip={grip} />)
    expect(rig.joints.headTilt.x).toBeCloseTo(grip.point.x)
    expect(rig.joints.headTilt.y).toBeCloseTo(grip.point.y)
    expect(frame).toBe(renderToStaticMarkup(<PuppetArt pose={pose} rig={rig} />))
    expect(frame.match(/data-neck="" d="([^"]+)"/)?.[1]?.endsWith(` ${top.x} ${top.y}`)).toBe(true)
  })

  it('rocks a loose prop around its actual center with a smaller movement from the actor', () => {
    const pose = putDown(withProp(initialPose(), 'cup'))
    const engine = createMotion()
    tug(engine, 'prop', { x: 68, y: -18 }, 16)
    advanceMotion(engine, 0.04)
    const rig = computeRig(pose, engine.value)
    expect(Math.abs(rig.propAngle - pose.propTurn)).toBeGreaterThan(1)
    expect(rig.propCenter).toEqual(pose.propPosition)
    expect(Math.abs(engine.value.body)).toBeLessThan(Math.abs(rig.propAngle - pose.propTurn))
    const svg = renderToStaticMarkup(<PuppetArt pose={pose} rig={rig} />)
    expect(svg).toContain(`data-visible-prop="cup" transform="translate(${rig.propCenter.x} ${rig.propCenter.y}) rotate(${rig.propAngle})`)
  })

  it('seats a newly picked-up cup at the wrist even while the loose object still has angular momentum', () => {
    const engine = createMotion()
    tug(engine, 'prop', { x: 76, y: -23 }, 16)
    advanceMotion(engine, 0.04)
    const pose = moveHandle(withProp(initialPose(), 'cup'), 'right', { x: 269, y: 113 })
    const held = computeRig(pose, engine.value)
    const rest = computeRig(pose, stillMotion)
    expect(Math.abs(engine.value.prop)).toBeGreaterThan(1)
    expect(held.propAngle).toBe(pose.propTurn)
    expect(held.propCenter).toEqual(rest.propCenter)
    expect(held.pose.right).toEqual(rest.pose.right)
  })

  it('replays old two-channel motion without losing the rendered actor', () => {
    const pose = initialPose()
    const legacy = renderToStaticMarkup(<PuppetArt pose={pose} motion={{ body: 9, head: -8 }} />)
    expect(legacy).toBe(renderToStaticMarkup(<PuppetArt pose={pose} motion={{ ...stillMotion, body: 9, head: -8 }} />))
    expect(legacy).not.toContain('NaN')
  })
})
