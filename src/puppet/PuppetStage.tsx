import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import type { Grip } from './contact'
import { PuppetArt } from './PuppetArt'
import { FlickInk, flickAt, traceFlick } from './FlickInk'
import { advanceMotion, computeRig, createMotion, displayPose, headAngle, motionAtRest, stillMotion, tug, type PuppetMotion, type PuppetRig } from './motion'
import { pickTarget, stageTargets } from './hit'
import { moveJoint, turnFoot, turnJoint } from './joints'
import { defaultAnkle } from './legs'
import { distance, dragHandle, isJoint, moveHandle, putDown, snapHand, turnProp, type Hand, type StageHandle, type Point, type PuppetPose } from './geometry'
import './puppet.css'

export type PuppetSnapshot = { pose: PuppetPose; motion: PuppetMotion; grip?: Grip }
type TurnHandle = 'prop' | 'leftAnkle' | 'rightAnkle'
export type PuppetStageApi = {
  freeze: () => PuppetSnapshot
  isSettled: () => boolean
  reactToTurn: (handle: TurnHandle, degrees: number) => void
}
type Props = {
  pose: PuppetPose
  onPoseChange?: (pose: PuppetPose) => void
  onPosePreview?: (pose: PuppetPose) => void
  onGrabChange?: (grabbed: boolean) => void
  interactive?: boolean
  stageRef?: Ref<PuppetStageApi>
  bodyFollow?: boolean
}
type Drag = {
  id: number; handle: StageHandle; before: PuppetPose; current: PuppetPose; offset: Point
  flick?: ReturnType<typeof traceFlick>
  startClient: Point; restRig: PuppetRig; restStart: Point; grabStart: Point; grip: Grip; last: Point; lastAt: number; candidate: Hand | null; moved: boolean
}
const handleNames: Record<StageHandle, string> = {
  head: 'Head', left: 'Left hand', right: 'Right hand', prop: 'Prop',
  leftElbow: 'Left elbow', rightElbow: 'Right elbow', leftShoulder: 'Left shoulder', rightShoulder: 'Right shoulder',
  waist: 'Waist', chest: 'Turn torso', headTilt: 'Tilt head', leftKnee: 'Left knee', rightKnee: 'Right knee',
  leftAnkle: 'Left foot', rightAnkle: 'Right foot',
}
function rigPoint(rig: PuppetRig, handle: StageHandle) {
  return isJoint(handle) ? rig.joints[handle] : handle === 'prop' ? rig.propCenter : rig.pose[handle]
}

function toStage(svg: SVGSVGElement, client: Point): Point | null {
  const matrix = svg.getScreenCTM()
  if (!matrix || !matrix.a || !matrix.d) return null
  const point = new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse())
  return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null
}
function scaleFor(svg: SVGSVGElement) {
  const m = svg.getScreenCTM()
  return m ? Math.hypot(m.a, m.b) || 1 : 1
}
export function PuppetStage({ pose, onPoseChange, onPosePreview, onGrabChange, interactive = true, stageRef, bodyFollow = true }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const help = useId()
  const [active, setActive] = useState<StageHandle | null>(null)
  const [hovered, setHovered] = useState<StageHandle | null>(null)
  const lastTap = useRef<{ client: Point; id: StageHandle; at: number } | null>(null)
  const [grip, setGrip] = useState<Grip>()
  const released = useRef<{ grip: Grip; at: number } | null>(null)
  const [draft, setDraft] = useState<PuppetPose | null>(null)
  const [preview, setPreview] = useState<Hand | null>(null)
  const [ink, setInk] = useState<ReturnType<typeof flickAt>>()
  const [motion, setMotion] = useState<PuppetMotion>(stillMotion)
  const [scale, setScale] = useState(1)
  const [reduced, setReduced] = useState(false)
  const drag = useRef<Drag | null>(null)
  const frame = useRef(0)
  const lastFrame = useRef(0)
  const lastBroadcast = useRef(0)
  const [initialEngine] = useState(createMotion)
  const engine = useRef(initialEngine)
  const rendered = draft ?? pose
  const rig = useMemo(() => computeRig(rendered, motion, grip), [rendered, motion, grip])
  const targets = useMemo(() => stageTargets(rig, scale), [rig, scale])
  const handleCenter = (handle: StageHandle) => rigPoint(rig, handle)
  const settled = !active && motion === stillMotion
  const visible = useRef<PuppetSnapshot>({ pose: rendered, motion })
  const handlers = useRef({ onPoseChange, onPosePreview, onGrabChange, reduced, bodyFollow })
  useLayoutEffect(() => {
    visible.current = grip ? { pose: rendered, motion, grip } : { pose: rendered, motion }
    handlers.current = { onPoseChange, onPosePreview, onGrabChange, reduced, bodyFollow }
  })
  useImperativeHandle(stageRef, () => ({
    freeze: () => structuredClone(visible.current),
    reactToTurn,
    isSettled: () => !drag.current && motionAtRest(engine.current) && visible.current.motion === stillMotion,
  }), [])
  useEffect(() => {
    const node = svg.current
    if (!node) return
    // A Vite refresh may preserve an engine created before the latest rig channels existed.
    engine.current = createMotion()
    setMotion(stillMotion)
    const measure = () => setScale(scaleFor(node))
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReduced(media.matches)
    const observer = new ResizeObserver(measure)
    measure()
    updateMotion()
    observer.observe(node)
    media.addEventListener('change', updateMotion)
    return () => { observer.disconnect(); media.removeEventListener('change', updateMotion) }
  }, [])

  function step(now: number) {
    frame.current = 0
    const e = engine.current, current = drag.current
    const elapsed = (now - (lastFrame.current || now - 1000 / 60)) / 1000
    lastFrame.current = now
    if (current) {
      setDraft(current.current)
      setGrip(current.grip)
      setPreview(current.candidate)
      setInk(flickAt(current.flick, now))
      if (now - lastBroadcast.current >= 110 && visible.current.pose !== current.current) {
        handlers.current.onPosePreview?.(current.current)
        lastBroadcast.current = now
      }
    }
    const release = released.current
    if (!current && release) {
      const t = Math.min(1, Math.max(0, (now - release.at) / 160))
      const strength = 1 - t * t * (3 - 2 * t)
      setGrip(strength > 0 ? { ...release.grip, strength } : undefined)
      if (!strength) released.current = null
    }
    const direct = handlers.current.reduced || !handlers.current.bodyFollow
    if (!direct && advanceMotion(e, elapsed)) {
      setMotion({ ...e.value })
      frame.current = requestAnimationFrame(step)
    } else {
      if (direct) engine.current = createMotion()
      setMotion(stillMotion)
      if (!current) { setGrip(undefined); released.current = null }
      lastFrame.current = 0
    }
  }
  function drive(handle: StageHandle, delta: Point, milliseconds: number, holder: Hand | null = null) {
    if (!handlers.current.bodyFollow || handlers.current.reduced) return
    const now = performance.now()
    // A fresh pull after an event-loop stall starts now, not at the previous paint.
    if (lastFrame.current && now - lastFrame.current > 200) lastFrame.current = now
    tug(engine.current, handle, delta, milliseconds, holder)
  }
  function reactToTurn(handle: TurnHandle, degrees: number) {
    if (!degrees || !Number.isFinite(degrees) || !handlers.current.bodyFollow || handlers.current.reduced) return
    // A 12-degree toe flick and a quarter-turn of a small prop turn a short lever.
    const travel = degrees * (handle === 'prop' ? 0.32 : 0.75)
    drive(handle, { x: travel, y: travel * 0.30 }, 16, visible.current.pose.holder)
    queueFrame()
  }
  function queueFrame() {
    if (!frame.current) frame.current = requestAnimationFrame(step)
  }
  function finish(revert = false, snap = false) {
    const current = drag.current
    if (!current) return
    drag.current = null
    if (!revert && snap && !current.moved) {
      lastTap.current = { client: current.startClient, id: current.handle, at: performance.now() }
    } else lastTap.current = null
    let finalPose = revert || !current.moved ? current.before : current.current
    if (!revert && snap && current.handle === 'prop' && !finalPose.holder && svg.current) {
      const displayed = displayPose(finalPose, engine.current.value)
      const holder = snapHand(displayed, scaleFor(svg.current), current.candidate, true)
      if (holder) finalPose = { ...moveHandle(finalPose, holder, displayed[holder]), holder }
    }
    if (finalPose !== current.before || revert) handlers.current.onPoseChange?.(finalPose)
    const node = svg.current
    if (node?.hasPointerCapture(current.id)) node.releasePointerCapture(current.id)
    setDraft(null); setActive(null); setPreview(null); setInk(undefined)
    handlers.current.onGrabChange?.(false)
    if (revert) engine.current = createMotion()
    if (current.moved && !motionAtRest(engine.current)) {
      released.current = { grip: current.grip, at: performance.now() }
      setGrip(current.grip)
      setMotion({ ...engine.current.value })
    } else { released.current = null; setGrip(undefined) }
    queueFrame()
  }
  const finishRef = useRef(finish)
  useLayoutEffect(() => { finishRef.current = finish })
  useEffect(() => {
    const stop = () => {
      finishRef.current()
      cancelAnimationFrame(frame.current)
      frame.current = 0
      lastFrame.current = 0
      engine.current = createMotion()
      released.current = null
      setGrip(undefined)
      setMotion(stillMotion)
    }
    const hidden = () => { if (document.hidden) stop() }
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); finishRef.current(true) }
    }
    window.addEventListener('blur', stop)
    window.addEventListener('resize', stop)
    window.addEventListener('orientationchange', stop)
    window.addEventListener('keydown', escape)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('blur', stop)
      window.removeEventListener('resize', stop)
      window.removeEventListener('orientationchange', stop)
      window.removeEventListener('keydown', escape)
      document.removeEventListener('visibilitychange', hidden)
      cancelAnimationFrame(frame.current)
      frame.current = 0
      lastFrame.current = 0
    }
  }, [])
  useEffect(() => {
    if (!interactive) {
      // Losing this round's controls discards uncommitted local input.
      const current = drag.current
      if (!current) return
      drag.current = null
      if (svg.current?.hasPointerCapture(current.id)) svg.current.releasePointerCapture(current.id)
      setDraft(null); setActive(null); setPreview(null); setGrip(undefined); setInk(undefined)
      released.current = null
      handlers.current.onGrabChange?.(false)
    }
  }, [interactive])
  function start(event: PointerEvent<SVGSVGElement>) {
    if (!interactive || drag.current || event.button !== 0 || !svg.current) return
    const node = event.target as Element
    if (!node.getAttribute('data-handle')) return
    const client = { x: event.clientX, y: event.clientY }
    const point = toStage(svg.current, client)
    if (!point) return
    const coarse = event.pointerType === 'touch'
    const last = lastTap.current
    const cycle = last && performance.now() - last.at < 1000 && distance(client, last.client) < 5
      ? { previous: last.id, slop: (coarse ? 8 : 4) / scale } : undefined
    const handle = pickTarget(point, targets, coarse, cycle)
    if (!handle) return
    setHovered(null)
    const anchor = handleCenter(handle)
    event.preventDefault()
    svg.current.setPointerCapture(event.pointerId)
    svg.current.querySelector<SVGCircleElement>('[data-handle="' + handle + '"]')?.focus({ preventScroll: true })
    // Take over a still-moving joint at the material point actually touched.
    // The following drag therefore settles where the moving actor was placed.
    let captured = pose
    if (isJoint(handle)) {
      if (!motionAtRest(engine.current)) captured = moveJoint(pose, handle, anchor, computeRig(pose, stillMotion))
    } else if (handle !== 'prop') captured = moveHandle(pose, handle, anchor)
    if (handle === 'head' && !motionAtRest(engine.current)) {
      // The rotating neck carries on while the skull pivots about the captured point.
      engine.current.value.head += rig.headAngle - headAngle(captured, engine.current.value)
      setMotion({ ...engine.current.value })
    }
    const restRig = computeRig(captured, stillMotion)
    const restStart = rigPoint(restRig, handle)
    const contact = { handle, point: anchor }
    released.current = null
    setGrip(contact)
    drag.current = {
      handle, id: event.pointerId, before: pose, current: captured, restRig, restStart, grabStart: anchor, grip: contact, offset: { x: anchor.x - point.x, y: anchor.y - point.y },
      startClient: client, last: restStart, lastAt: event.timeStamp, candidate: null, moved: false,
    }
    setDraft(captured)
    setActive(handle)
    handlers.current.onGrabChange?.(true)
  }
  function update(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!svg.current) return
    const client = { x: event.clientX, y: event.clientY }
    if (!current) {
      if (interactive && event.pointerType !== 'touch') {
        const hitPoint = toStage(svg.current, client)
        setHovered(hitPoint ? pickTarget(hitPoint, targets, false) : null)
      }
      return
    }
    if (current.id !== event.pointerId) return
    const point = toStage(svg.current, client)
    if (!point) return
    // Author against the unsprung skeleton. A moving shoulder or ringing neck
    // may change the displayed grip but can never manufacture new player input.
    const target = {
      x: current.restStart.x + point.x + current.offset.x - current.grabStart.x,
      y: current.restStart.y + point.y + current.offset.y - current.grabStart.y,
    }
    const at = event.timeStamp, h = current.handle
    const next = isJoint(h) ? moveJoint(current.current, h, target, current.restRig) : dragHandle(current.current, h, target)
    if (next === current.current) return
    const rest = computeRig(next, stillMotion)
    const actual = rigPoint(rest, h)
    if (distance(actual, current.last) < 0.001) return
    const delta = { x: actual.x - current.last.x, y: actual.y - current.last.y }
    drive(h, delta, at - current.lastAt, current.current.holder)
    current.flick = bodyFollow && !reduced ? traceFlick(delta, at - current.lastAt, performance.now()) : undefined
    current.grip = { handle: h, point: {
      x: current.grabStart.x + actual.x - current.restStart.x,
      y: current.grabStart.y + actual.y - current.restStart.y,
    } }
    current.restRig = rest
    current.current = next
    current.last = actual
    current.lastAt = at
    current.moved = true
    if (current.handle === 'prop') {
      current.candidate = snapHand(displayPose(next, engine.current.value), scaleFor(svg.current), current.candidate)
    }
    queueFrame()
  }
  function key(event: KeyboardEvent<SVGCircleElement>, handle: StageHandle) {
    if (!interactive || drag.current) return
    const arrows: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    }
    if (handle === 'prop' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      const holder = snapHand(pose, scale, null, true)
      if (pose.holder) onPoseChange?.(putDown(pose))
      else if (holder) onPoseChange?.({ ...pose, holder })
      return
    }
    if (handle === 'prop' && event.key.toLowerCase() === 'r') {
      event.preventDefault()
      reactToTurn(handle, 45)
      onPoseChange?.(turnProp(pose))
      return
    }
    if ((handle === 'leftAnkle' || handle === 'rightAnkle') && event.key.toLowerCase() === 'r') {
      event.preventDefault()
      const side = handle === 'leftAnkle' ? 'left' : 'right'
      const next = turnFoot(pose, side, event.shiftKey ? -12 : 12)
      reactToTurn(handle, (next.footTurns?.[side] ?? 0) - (pose.footTurns?.[side] ?? 0))
      onPoseChange?.(next)
      return
    }
    const dir = arrows[event.key]
    if (!dir) return
    event.preventDefault()
    const rest = computeRig(pose, stillMotion)
    const from = rigPoint(rest, handle), n = event.shiftKey ? 12 : 3
    const target = { x: from.x + dir.x * n, y: from.y + dir.y * n }
    const next = handle === 'chest' || handle === 'headTilt'
      ? turnJoint(pose, handle, (dir.x + dir.y) * (event.shiftKey ? 10 : 3))
      : isJoint(handle) ? moveJoint(pose, handle, target, rest) : dragHandle(pose, handle, target)
    if (event.shiftKey && next !== pose) {
      const actual = rigPoint(computeRig(next, stillMotion), handle)
      drive(handle, { x: actual.x - from.x, y: actual.y - from.y }, 16, pose.holder)
      queueFrame()
    }
    onPoseChange?.(next)
  }

  return <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360" className="ba-puppet-stage" data-puppet-stage="" data-targeting={hovered || undefined} data-grabbed={active ?? undefined}
    data-body-angle={motion.body} data-head-angle={rig.headAngle} data-balance={motion.balance} data-body-lift={motion.lift}
    data-prop-sway={motion.prop} data-loose-swing={motion.loose} data-settled={settled ? '1' : '0'}
    role={interactive ? 'group' : 'img'} aria-label={interactive ? 'Puppet stage' : 'Actor’s pose'} aria-describedby={interactive ? help : undefined}
    onPointerDown={start} onPointerMove={update} onPointerLeave={() => setHovered(null)} onPointerUp={event => { if (drag.current?.id === event.pointerId) { update(event); finish(false, true) } }}
    onPointerCancel={event => { if (drag.current?.id === event.pointerId) finish() }}
    onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) finish() }}>
    {interactive && <desc id={help}>Drag any joint, grip, or object. Dragging a held prop moves the hand with it. To pass it, put it down and drag it to the other palm. Tap again in the same spot to reach an overlapping joint. Tab focuses each grip in turn. With a control focused, use arrow keys to move, Shift to move farther, and Escape to undo a drag. For a prop, Enter picks up or puts down and R turns it. For a boot, R and Shift–R turn the toes.</desc>}
    <g pointerEvents="none" aria-hidden="true" fill="#432f23">
      {(['left', 'right'] as const).map(side => {
        const ankle = rig.joints[side === 'left' ? 'leftAnkle' : 'rightAnkle']
        const floor = defaultAnkle(side).y
        const height = Math.max(0, floor - ankle.y)
        return <ellipse key={side} cx={ankle.x + (side === 'left' ? -6 : 6)} cy={Math.max(floor, ankle.y) + 9}
          rx={17 + height * .10} ry={3.1 + height * .025} opacity={.32 / (1 + height / 22)} />
      })}
    </g>
    {interactive && active && grip && ink && bodyFollow && !reduced &&
      <FlickInk handle={active} point={grip.point} angle={ink.angle} opacity={ink.opacity} />}
    <PuppetArt pose={rendered} motion={motion} rig={rig}/>
    {interactive && targets.map(({ id: handle, center: p, radius, touchRadius }) => {
      const rotation = handle === 'headTilt' || handle === 'chest'
      return <g key={handle} className="ba-handle" data-selected={active === handle || undefined}
        data-hovered={hovered === handle || undefined} data-snap={preview === handle || undefined}>
        <circle data-handle={handle} className="ba-hit" cx={p.x} cy={p.y} r={touchRadius} tabIndex={0} role="button"
          aria-label={handle === 'prop' ? 'Move ' + (rendered.prop === 'plate' ? 'tray' : rendered.prop) : handleNames[handle]}
          aria-describedby={help} onKeyDown={event => key(event, handle)}/>
        {isJoint(handle) && <path className="ba-joint-stitch" aria-hidden="true" transform={`translate(${p.x} ${p.y})`}
          d={rotation ? 'M-4 1 A4 4 0 0 1 3-2 M3-4 V-1 H0' : 'M-2.2 1.2 L2.2-1.2'}/>}
        <circle className="ba-handle-ring" aria-hidden="true" cx={p.x} cy={p.y} r={radius}/>
      </g>
    })}
  </svg>
}
