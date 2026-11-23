// Run from any directory. Each argument can be a Git revision or a puppet source directory.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const scratch = join(root, '.local', 'qa')
mkdirSync(scratch, { recursive: true })
const temp = mkdtempSync(join(scratch, 'bench-'))
const require = createRequire(import.meta.url)
process.env.NODE_ENV = 'production'
const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const defaults = ['775e06b5dbe3ccadaf75be64a13dc2b1145ad395', join(root, 'src', 'puppet')]

function sources(input) {
  let files, read
  if (existsSync(input)) {
    const folder = resolve(input)
    files = readdirSync(folder)
    read = name => readFileSync(join(folder, name), 'utf8')
  } else {
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd()
    const sha = git(['rev-parse', '--verify', '--end-of-options', input + '^{commit}'])
    files = git(['ls-tree', '--name-only', sha + ':src/puppet']).split('\n')
    read = name => execFileSync('git', ['show', sha + ':src/puppet/' + name], { cwd: root, encoding: 'utf8' })
  }
  return files.filter(name => /\.tsx?$/.test(name) && name !== 'index.ts' && !name.includes('.test.')).sort()
    .map(name => [name, read(name)])
}

function load(input, label) {
  const output = join(temp, label)
  mkdirSync(output)
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
  const hash = createHash('sha256')
  for (const [name, code] of sources(input)) {
    hash.update(name).update('\0').update(code)
    const out = ts.transpileModule(code, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText
    writeFileSync(join(output, basename(name).replace(/\.tsx?$/, '.js')), out)
  }
  return { source: input, digest: hash.digest('hex'), geometry: require(join(output, 'geometry.js')),
    motion: require(join(output, 'motion.js')), sleeve: require(join(output, 'sleeve.js')),
    art: require(join(output, 'PuppetArt.js')).PuppetArt }
}

// All coordinates are authored in stage space. Identical input is applied to both versions.
const traces = [
  { prop: 'cup', hold: 'right', handle: 'left', moves: [[2, -17], [4, -41], [0, -52], [-3, -35]] },
  { prop: 'plate', handle: 'right', moves: [[18, -13], [29, -26], [10, -38], [-34, 22], [-31, 18]] },
  { prop: null, handle: 'head', moves: [[5, -2], [6, -3], [7, -1], [-4, 2], [-10, 1]] },
  { prop: 'phone', handle: 'left', moves: [[-4, -12], [-9, -18], [19, -18], [28, 11], [-21, 14]] },
]
const dt = 1 / 60
const totalSteps = 110
const hips = { left: { x: 229, y: 246 }, right: { x: 277, y: 246 } }
const ankles = { left: { x: 222, y: 297 }, right: { x: 280, y: 297 } }
const neckBase = { x: 246, y: 153 }

// The baseline computes this landmark inside the React Leg component.
function originalKnee(hip, ankle, left) {
  const dx = ankle.x - hip.x, dy = ankle.y - hip.y
  const length = Math.hypot(dx, dy) || 1
  const bow = Math.sqrt(Math.max(0, 28.5 ** 2 - length ** 2 / 4)) * (left ? 1 : -1)
  return { x: (hip.x + ankle.x) / 2 - dy / length * bow, y: (hip.y + ankle.y) / 2 + dx / length * bow }
}

function play(api, trace, visit) {
  const g = api.geometry, m = api.motion
  const engine = m.createMotion()
  let pose = g.withProp(g.initialPose(), trace.prop)
  if (trace.hold) pose = g.moveHandle(pose, trace.hold, { x: 269, y: 113 })
  let checksum = 0, activeFrames = 0
  for (let i = 0; i < totalSteps; ++i) {
    if (i < trace.moves.length) {
      const start = pose[trace.handle]
      const [dx, dy] = trace.moves[i]
      pose = g.moveHandle(pose, trace.handle, { x: start.x + dx, y: start.y + dy })
      const end = pose[trace.handle]
      m.tug(engine, trace.handle, { x: end.x - start.x, y: end.y - start.y }, dt * 1000)
    }
    const active = m.advanceMotion(engine, dt, trace.handle === 'head' && i < trace.moves.length)
    // Fixed-length traces include the resting tail, so both versions sample the same timestamps.
    checksum += visit(pose, engine.value)
    if (active) ++activeFrames
  }
  return { checksum, activeFrames }
}

function makeVisitor(api, kind) {
  const g = api.geometry, m = api.motion
  const shared = typeof m.computeRig === 'function'
  if (kind === 'serialize') return (pose, motion) => {
    const rig = shared ? m.computeRig(pose, motion) : undefined
    const controls = rig ? rig.pose : m.displayPose(pose, motion)
    const html = renderToStaticMarkup(createElement(api.art, { pose, motion, rig }))
    return controls.head.x + html.length
  }
  // Sample the stage hit areas, the same artwork transforms, and all four elbows and knees.
  return (pose, motion) => {
    const rig = shared ? m.computeRig(pose, motion) : undefined
    const handles = rig ? rig.pose : m.displayPose(pose, motion)
    const drawn = rig ? rig.pose : m.displayPose(pose, motion)
    const matrix = rig ? rig.matrix : m.bodyMatrix(motion)
    const prop = rig ? rig.propCenter : g.propCenter(drawn)
    let sum = handles.left.x + handles.right.y + handles.head.y + drawn.head.x
      + matrix.length + (rig ? rig.headAngle : m.headAngle(pose, motion))
    if (drawn.prop) sum += prop.x + prop.y
    const neck = rig ? rig.point(neckBase) : m.bodyPoint(neckBase, motion)
    sum += neck.x + neck.y
    for (const hand of ['left', 'right']) {
      const hip = rig ? rig.point(hips[hand]) : m.bodyPoint(hips[hand], motion)
      const socket = rig ? rig.point(g.shoulders[hand]) : m.bodyPoint(g.shoulders[hand], motion)
      const left = hand === 'left'
      const joints = rig?.joints
      const ankle = joints ? (left ? joints.leftAnkle : joints.rightAnkle) : ankles[hand]
      const knee = joints ? (left ? joints.leftKnee : joints.rightKnee) : originalKnee(hip, ankle, left)
      const shoulder = joints ? (left ? joints.leftShoulder : joints.rightShoulder) : socket
      const elbow = joints ? (left ? joints.leftElbow : joints.rightElbow) : api.sleeve.sleeveElbow(hand, drawn, shoulder, motion)
      sum += hip.x + hip.y + ankle.x + ankle.y + knee.x + knee.y + socket.x + socket.y
        + shoulder.x + shoulder.y + elbow.x + elbow.y
    }
    return sum
  }
}

function batch(api, visit, loops) {
  const start = performance.now()
  let digest = 0, activeFrames = 0
  for (let n = 0; n < loops; ++n) {
    for (const trace of traces) {
      const result = play(api, trace, visit)
      digest += result.checksum
      activeFrames += result.activeFrames
    }
  }
  if (!Number.isFinite(digest) || !activeFrames) throw new Error('Invalid benchmark state')
  return { us: (performance.now() - start) * 1000 / (loops * traces.length * totalSteps), activeFrames: activeFrames / loops, digest: digest / loops }
}
// Count calls separately so these wrappers never affect timing samples.
function countTrig(api) {
  const visit = makeVisitor(api, 'rig')
  const sin = Math.sin, cos = Math.cos
  let calls = 0
  Math.sin = n => { ++calls; return sin(n) }
  Math.cos = n => { ++calls; return cos(n) }
  try {
    for (const trace of traces) play(api, trace, visit)
    return calls
  } finally {
    Math.sin = sin
    Math.cos = cos
  }
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
function compare(versions, kind, loops) {
  const visitors = versions.map(v => makeVisitor(v, kind))
  for (let i = 0; i < 3; ++i) {
    for (let v = 0; v < 2; ++v) batch(versions[v], visitors[v], loops)
  }
  const samples = [[], []]
  for (let i = 0; i < 9; ++i) {
    for (const v of i % 2 ? [1, 0] : [0, 1]) samples[v].push(batch(versions[v], visitors[v], loops))
  }
  const [before, after] = samples.map(rows => median(rows.map(row => row.us)))
  return { kind, sampledFramesPerPass: loops * traces.length * totalSteps, beforeUs: before, afterUs: after,
    changePercent: (after / before - 1) * 100, activeFramesOutOf440: samples.map(rows => rows[0].activeFrames),
    samplesUs: samples.map(rows => rows.map(row => +row.us.toFixed(3))) }
}

try {
  const versions = defaults.map((fallback, index) => load(process.argv[index + 2] || fallback, 'v' + index))
  console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model,
    sources: versions.map(v => ({ source: v.source, digest: v.digest })),
    traces: traces.length, stepsPerTrace: totalSteps, warmupBatches: 3, measuredBatches: 9,
    measurements: [compare(versions, 'rig', 500), compare(versions, 'serialize', 8)],
    sinAndCosCallsPer440RigSteps: versions.map(countTrig) }, null, 2))
} finally {
  rmSync(temp, { recursive: true, force: true })
}
