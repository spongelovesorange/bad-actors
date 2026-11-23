import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from 'react'
import { PuppetArt, stillMotion, type PuppetMotion } from './PuppetArt'
import { clamp, distance, feel, moveHandle, propCenter, putDown, snapHand, turnProp, type Hand, type Handle, type Point, type PuppetPose } from './geometry'
import './puppet.css'

export type PuppetSnapshot = { pose: PuppetPose; motion: PuppetMotion }
export type PuppetStageApi = { freeze: () => PuppetSnapshot }
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
  startClient: Point; last: Point; lastAt: number; candidate: Hand | null
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
function stepSpring(value: number, speed: number, target: number, frequency: number, dt: number) {
  const acceleration = frequency * frequency * (target - value) - 2 * feel.damping * frequency * speed
  const velocity = speed + acceleration * dt
  return [value + velocity * dt, velocity] as const
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
  const engine = useRef({ body: 0, head: 0, bodySpeed: 0, headSpeed: 0, drive: 0, at: 0 })
  const rendered = draft ?? pose
  const visible = useRef<PuppetSnapshot>({ pose: rendered, motion })
  const handlers = useRef({ onPoseChange, onPosePreview, onGrabChange, reduced, bodyFollow })
  useLayoutEffect(() => {
    visible.current = { pose: rendered, motion }
    handlers.current = { onPoseChange, onPosePreview, onGrabChange, reduced, bodyFollow }
  })
  useImperativeHandle(stageRef, () => ({ freeze: () => structuredClone(visible.current) }), [])
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
    const dt = Math.min(0.032, Math.max(0.001, (now - (lastFrame.current || now - 16)) / 1000))
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
    if (direct) {
      Object.assign(e, { body: 0, head: 0, bodySpeed: 0, headSpeed: 0, drive: 0 })
      setMotion(stillMotion)
      lastFrame.current = 0
      return
    }
    const goal = current ? e.drive * Math.exp(-Math.max(0, now - e.at) / 58) : 0
    // Short substeps keep the same damped response across display refresh rates.
    const steps = Math.ceil(dt / 0.009)
    for (let i = 0; i < steps; i++) {
      ;[e.body, e.bodySpeed] = stepSpring(e.body, e.bodySpeed, goal, feel.bodyFrequency, dt / steps)
      if (current?.handle !== 'head') {
        ;[e.head, e.headSpeed] = stepSpring(e.head, e.headSpeed, e.body * 1.32, feel.headFrequency, dt / steps)
      }
    }
    e.body = clamp(e.body, -feel.bodyLean, feel.bodyLean)
    e.head = clamp(e.head, -feel.headSway, feel.headSway)
    const movingHead = current?.handle === 'head' ? 0 : Math.abs(e.head) + Math.abs(e.headSpeed) / 12
    if (Math.abs(goal) + Math.abs(e.body) + Math.abs(e.bodySpeed) / 12 + movingHead < 0.018) {
      e.body = e.bodySpeed = e.headSpeed = 0
      if (current?.handle !== 'head') e.head = 0
      setMotion(e.head ? { body: 0, head: e.head } : stillMotion)
      lastFrame.current = 0
      return
    }
    setMotion({ body: e.body, head: e.head })
    frame.current = requestAnimationFrame(step)
  }
  function queueFrame() {
    if (!frame.current) frame.current = requestAnimationFrame(step)
  }
  function finish(revert = false, snap = false) {
    const current = drag.current
    if (!current) return
    drag.current = null
    let finalPose = revert ? current.before : current.current
    if (!revert && snap && current.handle === 'prop' && !finalPose.holder && svg.current) {
      const holder = snapHand(finalPose, scaleFor(svg.current), current.candidate, true)
      if (holder) finalPose = { ...finalPose, holder }
    }
    if (finalPose !== current.before || revert) handlers.current.onPoseChange?.(finalPose)
    const node = svg.current
    if (node?.hasPointerCapture(current.id)) node.releasePointerCapture(current.id)
    setDraft(null); setActive(null); setPreview(null)
    handlers.current.onGrabChange?.(false)
    engine.current.drive = 0
    queueFrame()
  }
  const finishRef = useRef(finish)
  useLayoutEffect(() => { finishRef.current = finish })
  useEffect(() => {
    const stop = () => finishRef.current()
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
    const handle = allowed.reduce((best, id) => distance(point, center(pose, id)) < distance(point, center(pose, best)) ? id : best)
    const anchor = center(pose, handle)
    event.preventDefault()
    svg.current.setPointerCapture(event.pointerId)
    svg.current.querySelector<SVGCircleElement>('[data-handle="' + handle + '"]')?.focus({ preventScroll: true })
    if (handle === 'head') engine.current.headSpeed = 0
    drag.current = {
      handle, id: event.pointerId, before: pose, current: pose, offset: { x: anchor.x - point.x, y: anchor.y - point.y },
      startClient: client, last: anchor, lastAt: performance.now(), candidate: null,
    }
    setActive(handle); handlers.current.onGrabChange?.(true)
  }
  function update(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId || !svg.current) return
    const client = { x: event.clientX, y: event.clientY }
    const point = toStage(svg.current, client)
    if (!point) return
    if (current.handle === 'prop' && current.current.holder && distance(client, current.startClient) <= feel.detachPx) return
    const target = { x: point.x + current.offset.x, y: point.y + current.offset.y }
    const at = performance.now()
    const next = moveHandle(current.current, current.handle, target)
    const actual = center(next, current.handle)
    if (distance(actual, current.last) < 0.001) return
    const dt = Math.max(8, at - current.lastAt)
    const dy = (actual.y - current.last.y) * (current.handle === 'left' ? 0.35 : -0.35)
    const drive = ((actual.x - current.last.x) + dy) / dt * 9
    engine.current.drive = current.handle === 'prop' ? 0 : clamp(drive, -feel.bodyLean, feel.bodyLean)
    engine.current.at = at
    current.current = next; current.last = actual; current.lastAt = at
    if (current.handle === 'prop') current.candidate = snapHand(next, scaleFor(svg.current), current.candidate)
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
    const p = center(pose, handle), n = event.shiftKey ? 12 : 3
    onPoseChange?.(moveHandle(pose, handle, { x: p.x + dir.x * n, y: p.y + dir.y * n }))
  }

  return <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360" className="ba-puppet-stage" data-puppet-stage="" data-grabbed={active ?? undefined}
    role={interactive ? 'group' : 'img'} aria-label={interactive ? 'Puppet stage' : 'Actor’s pose'} aria-describedby={interactive ? help : undefined}
    onPointerDown={start} onPointerMove={update} onPointerUp={event => { if (drag.current?.id === event.pointerId) { update(event); finish(false, true) } }}
    onPointerCancel={event => { if (drag.current?.id === event.pointerId) finish() }}
    onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) finish() }}>
    {interactive && <desc id={help}>Drag the head, either hand or a prop. With a control focused, use arrow keys to move, Shift to move farther, and Escape to undo a drag. For a prop, Enter picks up or puts down and R turns it.</desc>}
    <PuppetArt pose={rendered} motion={motion}/>
    {interactive && allHandles.filter(h => h !== 'prop' || rendered.prop).map(handle => {
      const p = center(rendered, handle)
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
