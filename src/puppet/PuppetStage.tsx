import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import { PuppetArt } from './PuppetArt'
import { advanceMotion, createMotion, displayPose, headAngle, motionAtRest, stillMotion, tug, type PuppetMotion } from './motion'
import { distance, feel, moveHandle, propCenter, putDown, snapHand, turnProp, type Hand, type Handle, type Point, type PuppetPose } from './geometry'
import './puppet.css'

export type PuppetSnapshot = { pose: PuppetPose; motion: PuppetMotion }
export type PuppetStageApi = { freeze: () => PuppetSnapshot; isSettled: () => boolean }
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
  id: number; handle: Handle; before: PuppetPose; current: PuppetPose; offset: Point
  startClient: Point; last: Point; lastAt: number; candidate: Hand | null; moved: boolean
}
const handleNames = { head: 'Head', left: 'Left hand', right: 'Right hand', prop: 'Prop' }
const allHandles: Handle[] = ['head', 'prop', 'left', 'right']
function center(p: PuppetPose, handle: Handle) { return handle === 'prop' ? propCenter(p) : p[handle] }

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
  const [active, setActive] = useState<Handle | null>(null)
  const [draft, setDraft] = useState<PuppetPose | null>(null)
  const [preview, setPreview] = useState<Hand | null>(null)
  const [motion, setMotion] = useState<PuppetMotion>(stillMotion)
  const [scale, setScale] = useState(1)
  const [reduced, setReduced] = useState(false)
  const drag = useRef<Drag | null>(null)
  const frame = useRef(0)
  const lastFrame = useRef(0)
  const lastBroadcast = useRef(0)
  const engine = useRef(createMotion())
  const rendered = draft ?? pose
  const drawn = displayPose(rendered, motion)
  const settled = !active && motion === stillMotion
  const visible = useRef<PuppetSnapshot>({ pose: rendered, motion })
  const handlers = useRef({ onPoseChange, onPosePreview, onGrabChange, reduced, bodyFollow })
  useLayoutEffect(() => {
    visible.current = { pose: rendered, motion }
    handlers.current = { onPoseChange, onPosePreview, onGrabChange, reduced, bodyFollow }
  })
  useImperativeHandle(stageRef, () => ({
    freeze: () => structuredClone(visible.current),
    isSettled: () => !drag.current && motionAtRest(engine.current) && visible.current.motion === stillMotion,
  }), [])
  useEffect(() => {
    const node = svg.current
    if (!node) return
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
      setPreview(current.candidate)
      if (now - lastBroadcast.current >= 110 && visible.current.pose !== current.current) {
        handlers.current.onPosePreview?.(current.current)
        lastBroadcast.current = now
      }
    }
    const direct = handlers.current.reduced || !handlers.current.bodyFollow
    if (!direct && advanceMotion(e, elapsed, current?.handle === 'head')) {
      setMotion({ ...e.value })
      frame.current = requestAnimationFrame(step)
    } else {
      if (direct) engine.current = createMotion()
      setMotion(stillMotion)
      lastFrame.current = 0
    }
  }
  function queueFrame() {
    if (!frame.current) frame.current = requestAnimationFrame(step)
  }
  function finish(revert = false, snap = false) {
    const current = drag.current
    if (!current) return
    drag.current = null
    let finalPose = revert || !current.moved ? current.before : current.current
    if (!revert && snap && current.handle === 'prop' && !finalPose.holder && svg.current) {
      const displayed = displayPose(finalPose, engine.current.value)
      const holder = snapHand(displayed, scaleFor(svg.current), current.candidate, true)
      if (holder) finalPose = { ...moveHandle(finalPose, holder, displayed[holder]), holder }
    }
    if (finalPose !== current.before || revert) handlers.current.onPoseChange?.(finalPose)
    const node = svg.current
    if (node?.hasPointerCapture(current.id)) node.releasePointerCapture(current.id)
    setDraft(null); setActive(null); setPreview(null)
    handlers.current.onGrabChange?.(false)
    if (revert) engine.current = createMotion()
    if (!motionAtRest(engine.current)) setMotion({ ...engine.current.value })
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
    }
  }, [])
  useEffect(() => {
    if (!interactive) {
      // Losing this round's controls discards uncommitted local input.
      const current = drag.current
      if (!current) return
      drag.current = null
      if (svg.current?.hasPointerCapture(current.id)) svg.current.releasePointerCapture(current.id)
      setDraft(null); setActive(null); setPreview(null)
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
    // Overlapping touch targets resolve to the nearest actual control center.
    const allowed = allHandles.filter(id => id !== 'prop' || pose.prop)
    const handle = allowed.reduce((best, id) => distance(point, center(drawn, id)) < distance(point, center(drawn, best)) ? id : best)
    const anchor = center(drawn, handle)
    event.preventDefault()
    svg.current.setPointerCapture(event.pointerId)
    svg.current.querySelector<SVGCircleElement>('[data-handle="' + handle + '"]')?.focus({ preventScroll: true })
    // Take control at the displayed position, including an otherwise loose wrist.
    const captured = handle === 'prop' ? pose : moveHandle(pose, handle, anchor)
    if (handle === 'head') {
      engine.current.speed.head = 0
      engine.current.value.head = 0
      setMotion({ ...engine.current.value })
    }
    drag.current = {
      handle, id: event.pointerId, before: pose, current: captured, offset: { x: anchor.x - point.x, y: anchor.y - point.y },
      startClient: client, last: anchor, lastAt: event.timeStamp, candidate: null, moved: false,
    }
    setDraft(captured)
    setActive(handle)
    handlers.current.onGrabChange?.(true)
  }
  function update(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId || !svg.current) return
    const client = { x: event.clientX, y: event.clientY }
    const point = toStage(svg.current, client)
    if (!point) return
    if (current.handle === 'prop' && current.current.holder && distance(client, current.startClient) <= feel.detachPx) return
    const target = { x: point.x + current.offset.x, y: point.y + current.offset.y }
    const at = event.timeStamp
    const next = moveHandle(current.current, current.handle, target)
    const actual = center(next, current.handle)
    if (distance(actual, current.last) < 0.001) return
    const delta = { x: actual.x - current.last.x, y: actual.y - current.last.y }
    if (bodyFollow && !reduced) tug(engine.current, current.handle, delta, at - current.lastAt)
    current.current = next
    current.last = actual
    current.lastAt = at
    current.moved = true
    if (current.handle === 'prop') {
      current.candidate = snapHand(displayPose(next, engine.current.value), scaleFor(svg.current), current.candidate)
    }
    queueFrame()
  }
  function key(event: KeyboardEvent<SVGCircleElement>, handle: Handle) {
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
    if (handle === 'prop' && event.key.toLowerCase() === 'r') { event.preventDefault(); onPoseChange?.(turnProp(pose)); return }
    const dir = arrows[event.key]
    if (!dir) return
    event.preventDefault()
    const p = center(drawn, handle), n = event.shiftKey ? 12 : 3
    const next = moveHandle(pose, handle, { x: p.x + dir.x * n, y: p.y + dir.y * n })
    if (event.shiftKey && handle !== 'prop' && bodyFollow && !reduced) {
      const actual = center(next, handle)
      tug(engine.current, handle, { x: actual.x - p.x, y: actual.y - p.y }, 16)
      queueFrame()
    }
    onPoseChange?.(next)
  }

  return <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360" className="ba-puppet-stage" data-puppet-stage="" data-grabbed={active ?? undefined}
    data-body-angle={motion.body} data-head-angle={headAngle(rendered, motion)} data-body-lift={motion.lift}
    data-loose-swing={motion.loose} data-settled={settled ? '1' : '0'}
    role={interactive ? 'group' : 'img'} aria-label={interactive ? 'Puppet stage' : 'Actor’s pose'} aria-describedby={interactive ? help : undefined}
    onPointerDown={start} onPointerMove={update} onPointerUp={event => { if (drag.current?.id === event.pointerId) { update(event); finish(false, true) } }}
    onPointerCancel={event => { if (drag.current?.id === event.pointerId) finish() }}
    onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) finish() }}>
    {interactive && <desc id={help}>Drag the head, either hand or a prop. With a control focused, use arrow keys to move, Shift to move farther, and Escape to undo a drag. For a prop, Enter picks up or puts down and R turns it.</desc>}
    <PuppetArt pose={rendered} motion={motion}/>
    {interactive && allHandles.filter(h => h !== 'prop' || rendered.prop).map(handle => {
      const p = center(drawn, handle)
      const radius = Math.max(handle === 'head' ? 39 : 15, feel.hitRadiusPx / scale)
      return <g key={handle} className="ba-handle" data-selected={active === handle || undefined} data-snap={preview === handle || undefined}>
        <circle data-handle={handle} className="ba-hit" cx={p.x} cy={p.y} r={radius} tabIndex={0} role="button"
          aria-label={handle === 'prop' ? 'Move ' + rendered.prop : handleNames[handle]}
          aria-describedby={help} onKeyDown={event => key(event, handle)}/>
        <circle className="ba-handle-ring" aria-hidden="true" cx={p.x} cy={p.y} r={handle === 'head' ? 49 : handle === 'prop' ? 28 : 20}/>
      </g>
    })}
  </svg>
}
