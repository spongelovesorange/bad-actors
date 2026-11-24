import { deck, levels, type LevelId } from '../deck'

/** One evening at the hall: five acts drawn from a level, each with that night's clock. */
export const actsPerShow = 5
/** `feeling` marks a hit made wearing the cue's mood on the Feel it night. */
export type ActResult = { cue: number; guessed: boolean; looks: number; line?: string; image?: string; feeling?: boolean }
export type Show = { level: LevelId; queue: number[]; results: ActResult[] }
export type Best = Partial<Record<LevelId, { score: number; stars: number }>>

export const levelOf = (id: LevelId) => levels.find(level => level.id === id)!

export function cuesInLevel(level: LevelId) {
  return deck.flatMap((cue, index) => cue.level === level ? [index] : [])
}

/** Five different cues from the level, in a fresh order each show. */
export function drawShow(level: LevelId, random = Math.random): Show {
  const pool = cuesInLevel(level)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return { level, queue: pool.slice(0, actsPerShow), results: [] }
}

/** Fewer looks earn more stars, like a pose landed on the first try. Method acting earns one more. */
export function starsFor(result: Pick<ActResult, 'guessed' | 'looks' | 'feeling'>) {
  if (!result.guessed) return 0
  return (result.looks <= 1 ? 3 : result.looks <= 3 ? 2 : 1) + (result.feeling ? 1 : 0)
}

export function scoreOf(results: ActResult[]) {
  return { score: results.filter(result => result.guessed).length, stars: results.reduce((sum, result) => sum + starsFor(result), 0) }
}

/** Stubbs's notice for each night, by acts guessed. Written in advance, so it costs nothing. */
const reviews: Record<LevelId, string[]> = {
  1: [
    'Nothing. I came for theatre and got a bag of sand.',
    'One. I clapped once, out of politeness.',
    'Two. I have seen better acting from the fire extinguisher.',
    'Three. A solid evening. The sandbag may keep its job.',
    'Four! The fifth one I am blaming on the lighting.',
    'Five for five. I had to sit down, and I was already sitting.',
  ],
  2: [
    'Nothing. The props gave a better performance on their own.',
    'One. The rest are going back in the cupboard, with a stern note.',
    'Two. The umbrella has asked for a new agent.',
    'Three. You handled the props, and the props handled you back.',
    'Four! I would trust you with the good teacups.',
    'Five for five. The rubber chicken wants your autograph.',
  ],
  3: [
    'Nothing. I felt nothing, which I suppose is a feeling.',
    'One. A single tear, but that was the dust.',
    'Two. My handkerchief is damp. Only slightly.',
    'Three. I wept twice, and once was at the acting.',
    'Four! I have not sobbed like this since the pantomime cow retired.',
    'Five for five. I am a puddle. Somebody fetch a mop.',
  ],
  4: [
    'Nothing. Mind you, I could not see a thing.',
    'One. I think it was you. It was very dark.',
    'Two. The electrician has been sacked. You may stay.',
    'Three. You glowed in the dark, in a professional way.',
    'Four! Who needs lights with talent like that?',
    'Five for five in the dark. Next time try it with your eyes shut.',
  ],
  5: [
    'Nothing. Even the heckler went home early.',
    'One. The heckler and I agree, and that frightens me.',
    'Two. I have seen better galas at a bus stop.',
    'Three. The tuxedo was worth renting.',
    'Four! The heckler is weeping. So am I, quietly.',
    'Five for five. The balcony is on its feet. The heckler is on a chair.',
  ],
}
export function reviewFor(score: number, level: LevelId = 1) {
  const notices = reviews[level]
  return notices[Math.max(0, Math.min(notices.length - 1, score))]
}

/** A level opens once the one before it has had a show with three acts guessed. */
export const unlockScore = 3
export function unlocked(level: LevelId, best: Best) {
  return level === 1 || (best[(level - 1) as LevelId]?.score ?? 0) >= unlockScore
}
export const nextLevel = (level: LevelId) => levels.find(entry => entry.id === level + 1)?.id

const bestKey = 'bad-actors:show-best:1'
export function readBest(): Best {
  try {
    const saved = JSON.parse(localStorage.getItem(bestKey) ?? '{}') as Best
    const best: Best = {}
    for (const { id } of levels) {
      const entry = saved?.[id]
      if (entry && Number.isInteger(entry.score) && Number.isInteger(entry.stars)) best[id] = { score: entry.score, stars: entry.stars }
    }
    return best
  } catch { return {} }
}

type Evening = { score: number; stars: number }
/** More acts guessed wins; the same number of acts goes to more stars. */
const beats = (now: Evening, old?: Evening) => !old || now.score > old.score || (now.score === old.score && now.stars > old.stars)

/** The better evening of two records for every night, such as this browser's and the account's. */
export function mergeBest(a: Best, b: Best): Best {
  const merged: Best = { ...a }
  for (const [key, entry] of Object.entries(b) as [string, Evening | undefined][]) {
    const level = Number(key) as LevelId
    if (entry && beats(entry, merged[level])) merged[level] = entry
  }
  return merged
}

/** Keeps the better of the old and new evening for this level. */
export function recordBest(best: Best, level: LevelId, results: ActResult[]): Best {
  const now = scoreOf(results)
  const next = beats(now, best[level]) ? { ...best, [level]: now } : best
  try { localStorage.setItem(bestKey, JSON.stringify(next)) } catch { /* Scores still show for this visit. */ }
  return next
}
