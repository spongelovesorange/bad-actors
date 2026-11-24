/**
 * The pit band. One original eight-bar music-hall tune, arranged differently for each night and
 * rendered once into a seamless loop: notes that ring past the end of the loop wrap round to its
 * start, so the tune never clicks or gaps when it repeats.
 */
export type Track = 'lobby' | 'opening' | 'props' | 'feelings' | 'blackout' | 'gala'

const tau = Math.PI * 2
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
/** A voice is a sound at `t` seconds into a note of frequency `f`, held for `held` seconds. */
type Voice = (t: number, f: number, held: number) => number

// The house tune in C, over I–vi–ii–V7 | I–IV–V7–I. [beat, beats, MIDI note]
const tune: [number, number, number][] = [
  [0, .5, 67], [.5, .5, 72], [1, 1, 76], [2, .5, 74], [2.5, .5, 72], [3, 1, 76],
  [4, .5, 69], [4.5, .5, 72], [5, 1, 76], [6, 1, 74], [7, 1, 72],
  [8, .5, 65], [8.5, .5, 69], [9, 1, 74], [10, .5, 72], [10.5, .5, 69], [11, 1, 77],
  [12, 1, 76], [13, .5, 74], [13.5, .5, 71], [14, 2, 67],
  [16, .5, 67], [16.5, .5, 72], [17, 1, 76], [18, 1, 79], [19, 1, 76],
  [20, 1, 77], [21, .5, 81], [21.5, .5, 77], [22, 1, 72], [23, 1, 69],
  [24, .5, 71], [24.5, .5, 74], [25, 1, 79], [26, .5, 77], [26.5, .5, 74], [27, 1, 71],
  [28, 2, 72], [30, .5, 67], [30.5, .5, 69], [31, 1, 71],
]
// Root, the fifth below or above it, and the chord in the middle of the keyboard, bar by bar.
const changes = [
  { root: 48, fifth: 43, chord: [60, 64, 67], minor: false }, { root: 45, fifth: 40, chord: [57, 60, 64], minor: true },
  { root: 50, fifth: 45, chord: [62, 65, 69], minor: true }, { root: 43, fifth: 50, chord: [59, 62, 65], minor: false },
  { root: 48, fifth: 43, chord: [60, 64, 67], minor: false }, { root: 41, fifth: 48, chord: [57, 60, 65], minor: false },
  { root: 43, fifth: 50, chord: [59, 62, 65], minor: false }, { root: 48, fifth: 43, chord: [60, 64, 67], minor: false },
]
// Big Feelings gets its own melody: a weepy waltz in A minor. Three beats to the bar.
const waltz: [number, number, number][] = [
  [0, 1.5, 76], [1.5, .5, 74], [2, 1, 72], [3, 1, 71], [4, 1, 69], [5, 1, 64],
  [6, 1, 65], [7, 1, 69], [8, 1, 74], [9, 1.5, 72], [10.5, .5, 71], [11, 1, 68],
  [12, 1, 69], [13, 1, 72], [14, 1, 76], [15, 2, 77], [17, 1, 76],
  [18, 1, 74], [19, 1, 72], [20, 1, 71], [21, 3, 69],
]
const waltzChanges = [
  { root: 45, chord: [57, 60, 64] }, { root: 45, chord: [57, 60, 64] }, { root: 50, chord: [62, 65, 69] }, { root: 40, chord: [56, 59, 62] },
  { root: 45, chord: [57, 60, 64] }, { root: 41, chord: [57, 60, 65] }, { root: 40, chord: [56, 59, 62] }, { root: 45, chord: [57, 60, 64] },
]
/** C major to C minor: E, A and B come down a semitone. */
const minor = (midi: number) => [4, 9, 11].includes(midi % 12) ? midi - 1 : midi

const attack = (t: number, seconds: number) => Math.min(1, t / seconds)
const release = (t: number, held: number, rate: number) => t < held ? 1 : Math.exp(-(t - held) * rate)

// The band. Each voice is a few sine partials with its own envelope.
const voices: Record<'piano' | 'xylophone' | 'violin' | 'organ' | 'brass' | 'tuba' | 'upright' | 'stab', Voice> = {
  // An upright with two strings a hair out of tune, as in any village hall.
  piano: (t, f) => attack(t, .004) * Math.exp(-3.4 * t) * (.6 * Math.sin(tau * f * t) + .4 * Math.sin(tau * f * 1.006 * t) +
    .35 * Math.sin(tau * 2 * f * t) * Math.exp(-5 * t) + .15 * Math.sin(tau * 3 * f * t) * Math.exp(-8 * t)),
  xylophone: (t, f) => attack(t, .002) * (Math.sin(tau * f * t) * Math.exp(-6 * t) + .3 * Math.sin(tau * 3.93 * f * t) * Math.exp(-16 * t)),
  violin: (t, f, held) => {
    const wobble = 1 + .006 * Math.sin(tau * 5.6 * t) * Math.min(1, t / .3)
    let sound = 0
    for (let k = 1; k <= 6; k++) sound += Math.sin(tau * k * f * wobble * t) / k * (k === 1 ? 1 : .7)
    return attack(t, .09) * release(t, held, 9) * sound * .5
  },
  organ: (t, f, held) => attack(t, .12) * release(t, held, 6) * (.7 + .3 * Math.sin(tau * 6.2 * t)) *
    (Math.sin(tau * f * t) + .45 * Math.sin(tau * 2 * f * t) + .2 * Math.sin(tau * 4 * f * t)) * .55,
  brass: (t, f, held) => {
    const bright = .35 + .65 * Math.exp(-6 * t)
    let sound = 0
    for (let k = 1; k <= 7; k++) sound += Math.sin(tau * k * f * t) * (k === 1 ? 1 : bright / k)
    return attack(t, .025) * (t < held ? .75 + .25 * Math.exp(-8 * t) : .75 * Math.exp(-(t - held) * 12)) * sound * .45
  },
  tuba: (t, f) => attack(t, .012) * Math.exp(-5 * t) * (Math.sin(tau * f * t) + .45 * Math.sin(tau * 2 * f * t) + .2 * Math.sin(tau * 3 * f * t)) * .8,
  upright: (t, f) => attack(t, .005) * Math.exp(-4.2 * t) * (Math.sin(tau * f * t) + .25 * Math.sin(tau * 2 * f * t)),
  stab: (t, f) => attack(t, .0025) * Math.exp(-11 * t) * (Math.sin(tau * f * t) + .3 * Math.sin(tau * 2 * f * t)) * .45,
}

type Drum = 'brush' | 'snare' | 'hat' | 'block' | 'bonk'
type Part = { beat: number; beats: number; midi?: number; voice?: Voice; drum?: Drum; level: number; ring: number }
type Arrangement = { bpm: number; beats: number; parts: Part[] }

function melody(notes: [number, number, number][], voice: Voice, level: number, ring: number, shift = (m: number) => m): Part[] {
  return notes.map(([beat, beats, midi]) => ({ beat, beats, midi: shift(midi), voice, level, ring }))
}
/** Oom-pah: the root and its fifth on the strong beats, a short chord on the weak ones. */
function oomPah(bass: Voice, chord: Voice | null, level = 1, shift = (m: number) => m): Part[] {
  return changes.flatMap(({ root, fifth, chord: notes }, bar) => [
    { beat: bar * 4, beats: 1, midi: shift(root), voice: bass, level: .8 * level, ring: .8 },
    { beat: bar * 4 + 2, beats: 1, midi: shift(fifth), voice: bass, level: .8 * level, ring: .8 },
    ...(chord ? [1, 3].flatMap(beat => notes.map(midi => ({ beat: bar * 4 + beat, beats: .5, midi: shift(midi), voice: chord, level: .3 * level, ring: .4 }))) : []),
  ])
}
const beatsOf = (beats: number[], drum: Drum, level: number): Part[] => beats.map(beat => ({ beat, beats: .25, drum, level, ring: .3 }))
const every = (count: number, step: number, offset = 0) => Array.from({ length: count }, (_, i) => offset + i * step)

const arrangements: Record<Track, () => Arrangement> = {
  // Before the show: the pit pianist runs through the tune on their own, quietly.
  lobby: () => ({ bpm: 96, beats: 32, parts: [...melody(tune, voices.piano, .75, 1.4), ...oomPah(voices.upright, null, .7)] }),
  // Opening night: the whole tune on the upright, oom-pah bass and brushes on two and four.
  opening: () => ({ bpm: 112, beats: 32, parts: [
    ...melody(tune, voices.piano, 1, 1.4), ...oomPah(voices.upright, voices.stab), ...beatsOf(every(16, 2, 1), 'brush', .35),
  ] }),
  // The prop cupboard: brisk xylophone, a tuba and a woodblock on every off-beat.
  props: () => ({ bpm: 126, beats: 32, parts: [
    ...melody(tune, voices.xylophone, 1, 1), ...oomPah(voices.tuba, voices.stab), ...beatsOf(every(32, 1, .5), 'block', .22),
  ] }),
  // Big feelings: a violin sobbing through a waltz.
  feelings: () => ({ bpm: 88, beats: 24, parts: [
    ...melody(waltz, voices.violin, 1, .35),
    ...waltzChanges.flatMap(({ root, chord }, bar) => [
      { beat: bar * 3, beats: 1, midi: root, voice: voices.upright, level: .75, ring: .9 },
      ...[1, 2].flatMap(beat => chord.map(midi => ({ beat: bar * 3 + beat, beats: .5, midi, voice: voices.stab, level: .22, ring: .4 }))),
    ]),
  ] }),
  // The blackout matinee: the same tune in a minor key on a wobbling organ, slow, low and sparse.
  blackout: () => ({ bpm: 76, beats: 32, parts: [
    ...melody(tune.filter(([beat]) => Number.isInteger(beat)), voices.organ, .9, .5, midi => minor(midi) - 12),
    ...changes.map(({ root }, bar) => ({ beat: bar * 4, beats: 3.6, midi: minor(root) - 12, voice: voices.organ, level: .55, ring: .6 })),
    ...beatsOf(every(4, 8, 3), 'bonk', .4),
  ] }),
  // The gala: up a fourth and twice the speed, brass up front, a walking bass, snare and hi-hat.
  gala: () => ({ bpm: 150, beats: 32, parts: [
    ...melody(tune, voices.brass, 1, .3, midi => midi + 5),
    ...changes.flatMap(({ root, minor: sad }, bar) => [0, sad ? 3 : 4, 7, sad ? 3 : 4].map((step, beat) =>
      ({ beat: bar * 4 + beat, beats: 1, midi: root + 5 + step, voice: voices.upright, level: .7, ring: .5 }))),
    ...changes.flatMap(({ chord }, bar) => [1, 3].flatMap(beat => chord.map(midi =>
      ({ beat: bar * 4 + beat, beats: .3, midi: midi + 5, voice: voices.brass, level: .16, ring: .15 })))),
    ...beatsOf(every(64, .5), 'hat', .16), ...beatsOf(every(16, 2, 1), 'snare', .3),
  ] }),
}

export const trackSeconds = (track: Track) => {
  const { bpm, beats } = arrangements[track]()
  return beats * 60 / bpm
}

/** Renders a night's arrangement to one loop of mono samples, peaking at half scale. */
export function renderMusic(track: Track, rate = 24_000) {
  const { bpm, beats, parts } = arrangements[track]()
  const beat = 60 / bpm
  const pcm = new Float32Array(Math.round(beats * beat * rate))
  let seed = 51871
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x80000000 - 1
  }
  for (const part of parts) {
    const first = Math.round(part.beat * beat * rate)
    const held = part.beats * beat
    const n = Math.round((held + part.ring) * rate)
    const f = part.midi === undefined ? 0 : hz(part.midi)
    let low = 0
    for (let i = 0; i < n; i++) {
      const t = i / rate
      let sample: number
      if (part.voice) sample = part.voice(t, f, held)
      else {
        const hiss = noise()
        low += .2 * (hiss - low)
        sample = part.drum === 'brush' ? (hiss - low) * Math.exp(-18 * t) * .9
          : part.drum === 'snare' ? ((hiss - low) * .8 + .5 * Math.sin(tau * 190 * t)) * Math.exp(-24 * t)
            : part.drum === 'hat' ? (hiss - low) * Math.exp(-45 * t)
              : part.drum === 'block' ? Math.sin(tau * 1250 * t) * Math.exp(-70 * t)
                : Math.sin(tau * 300 * t) * Math.exp(-22 * t)
      }
      // A few samples of fade at each onset keep note starts click-free.
      pcm[(first + i) % pcm.length] += sample * part.level * Math.min(1, i / 12)
    }
  }
  let peak = 0
  for (const value of pcm) peak = Math.max(peak, Math.abs(value))
  const scale = peak ? .5 / peak : 0
  for (let i = 0; i < pcm.length; i++) pcm[i] *= scale
  return pcm
}
