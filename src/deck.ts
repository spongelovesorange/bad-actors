import type { FaceShape, HandShape, PropKind } from './puppet/geometry'

/**
 * The cue deck, shared by the stage and the server. A cue's position is the number the
 * server receives (index + 1); the referee sees only the title. Add new cues at the end.
 */
export type LevelId = 1 | 2 | 3 | 4 | 5
export type TwistId = 'fright' | 'catch' | 'feel' | 'blackout' | 'heckler'
export type Cue = {
  title: string; level: LevelId
  /** How to strike the pose, behind the Hint button. */
  note: string
  /** The director's note on the slate when the cue comes up. */
  quip: string
  sketch?: string
  /** On the Catch! night this prop is flung on from the wings at the start of the act. */
  prop?: PropKind
  /** On the Feel it night, wearing this face for the hit earns a bonus star. Elsewhere it only marks the card. */
  mood?: FaceShape
  /** The hand shape the cue turns on, for its card in the deck. */
  hand?: HandShape
}
export type Level = {
  id: LevelId; name: string; blurb: string
  /** Each night goes wrong in its own way. */
  twist: { id: TwistId; name: string; line: string }
  /** Seconds per act in the timed show. */
  seconds: number
  /** What Stubbs says as each act begins. */
  opener: string
}

export const levels: Level[] = [
  { id: 1, name: 'Opening Night', blurb: 'Six classics. Stubbs is on his best behaviour. Ish.', seconds: 45,
    twist: { id: 'fright', name: 'Stage fright', line: 'The understudy shakes like a leaf until you grab it.' },
    opener: 'Break a leg. Not literally.' },
  { id: 2, name: 'The Prop Cupboard', blurb: 'Every act has a prop, and the stagehand throws it.', seconds: 45,
    twist: { id: 'catch', name: 'Catch!', line: 'Each act’s prop is flung on from the wings. Pick it up off the boards.' },
    opener: 'Mind the flying props.' },
  { id: 3, name: 'Big Feelings', blurb: 'No props. Pure melodrama. Stubbs cries easily.', seconds: 45,
    twist: { id: 'feel', name: 'Feel it', line: 'Wear the mood on the cue card for a bonus star.' },
    opener: 'Pass the tissues.' },
  { id: 4, name: 'Blackout Matinee', blurb: 'The electrician is new. Very new.', seconds: 40,
    twist: { id: 'blackout', name: 'Lights out', line: 'The stage keeps going dark. Keep acting.' },
    opener: 'Who turned off the… oh.' },
  { id: 5, name: 'Heckler’s Gala', blurb: 'The finale. Someone in the balcony has opinions.', seconds: 30,
    twist: { id: 'heckler', name: 'Heckler', line: '30-second acts, and a heckler shouting wrong answers.' },
    opener: 'Ignore the gentleman upstairs.' },
]

export const deck: Cue[] = [
  { level: 1, title: 'Drinking water', sketch: 'drink', note: 'Bring the cup rim to the mouth. Leave the eyes peeking over it.',
    quip: 'Sip like a duchess. Hydration is method acting.' },
  { level: 1, title: 'Talking on the phone', sketch: 'call', note: 'Tuck the phone against one ear. Let the elbow hang below it.',
    quip: 'Your agent is calling. Pretend you have an agent.' },
  { level: 1, title: 'Taking a selfie', sketch: 'selfie', note: 'Hold the phone high and out to one side, with daylight between it and the face. Give the free hand a peace sign.',
    quip: 'Find your light. Find your angle. Lose your dignity.' },
  { level: 1, title: 'Covering your eyes', sketch: 'eyes', note: 'Open both palms and bring one over each eye. Keep the mouth showing.',
    quip: 'The reviews are in. Don’t look.' },
  { level: 1, title: 'Surrendering', sketch: 'surrender', note: 'Empty both hands. Bend the elbows out and lift the open palms above the shoulders.',
    quip: 'The critics have you surrounded.' },
  { level: 1, title: 'Carrying a tray', sketch: 'tray', note: 'Hold the tray level in front of the belly. Slide the other hand under its far rim.',
    quip: 'Table six ordered drama. Deliver it.' },
  { level: 2, title: 'Making a toast', prop: 'cup', note: 'Raise the cup high above the head. Forced smile, free hand open.',
    quip: 'To the understudy! May the lead stay poorly.' },
  { level: 2, title: 'Texting a friend', prop: 'phone', note: 'Hold the phone low in front of the belly and tip the head down to stare at it.',
    quip: 'Thumb out “u up?” with your whole face.' },
  { level: 2, title: 'Serving like a waiter', prop: 'plate', note: 'Balance the tray on one open palm at shoulder height. Tuck the other hand behind the back.',
    quip: 'Nose up. Tray up. Tips optional.' },
  { level: 4, title: 'Hiding behind a tray', prop: 'plate', note: 'Lift the tray in front of the face like a shield. Bracing face, knees bent.',
    quip: 'Something moved in the dark. Hide behind the crockery.' },
  { level: 5, title: 'Spilling your drink', prop: 'cup', note: 'Hold the cup out at arm’s length and turn it over. Gulp.',
    quip: 'Gala champagne, meet gala carpet.' },
  { level: 4, title: 'Hunting for phone signal', prop: 'phone', note: 'Stretch the phone as high as it goes and look up at it with side-eye.',
    quip: 'One bar. Half a bar. A rumour of a bar.' },
  { level: 3, title: 'Waving hello', mood: 'smile', note: 'Raise one open palm beside the head and keep the other arm down. Forced smile.',
    quip: 'Wave like you have spotted your ex across the foyer.' },
  { level: 3, title: 'Shrugging', mood: 'side-eye', note: 'Open both palms out at the sides with the elbows bent. Side-eye.',
    quip: 'Who, me? Never. Probably.' },
  { level: 3, title: 'Thinking hard', mood: 'side-eye', note: 'Put a fist under the chin and look up and away with side-eye.',
    quip: 'Ponder the meaning of sandbags.' },
  { level: 3, title: 'Flexing your muscles', mood: 'smile', note: 'Make two fists and bend both arms up beside the head. Forced smile.',
    quip: 'Two fists. No muscles. Full confidence.' },
  { level: 5, title: 'Saluting', hand: 'open', note: 'Bring one open palm flat to the forehead. Deadpan, feet together.',
    quip: 'Salute the gala. The gala does not salute back.' },
  { level: 4, title: 'Yawning', mood: 'sleepy', note: 'Cover the open mouth with one hand and stretch the other arm up. Gulp face.',
    quip: 'The matinee is long and the lights are off.' },
  // Added with the mic, umbrella, book, rose, banana and rubber chicken, the new faces and hands.
  { level: 2, title: 'Singing karaoke', prop: 'mic', note: 'Hold the mic up to the mouth and fling the free arm wide. Gulp face.',
    quip: 'Hit the high note. Any note.' },
  { level: 2, title: 'Sheltering from the rain', prop: 'umbrella', note: 'Raise the umbrella so the canopy sits right above the head. Bracing face.',
    quip: 'The roof leaks. It is in your contract.' },
  { level: 2, title: 'Reading a book', prop: 'book', note: 'Hold the open book in front of the chest and tip the head down towards it.',
    quip: 'It is the script. You were meant to read it last week.' },
  { level: 3, title: 'Falling in love', mood: 'love', note: 'Press both hands to the chest, tilt the head and go Smitten.',
    quip: 'Love at first sight. With the stage manager.' },
  { level: 3, title: 'Throwing a tantrum', mood: 'angry', note: 'Shake two fists high above the head, not beside the ears, and lift one boot to stamp. Fuming.',
    quip: 'Your dressing room has no star on the door.' },
  { level: 4, title: 'Hitchhiking', hand: 'thumb', note: 'Stretch one arm out to the side at waist height and give it a Thumbs up. Forced smile.',
    quip: 'Stranded at the interval. Thumb a lift home.' },
  { level: 4, title: 'Having a bright idea', hand: 'point', note: 'Raise one finger beside the head, as if a light bulb just came on. Gulp face.',
    quip: 'A bright idea in a blackout. Finally, some light.' },
  { level: 4, title: 'Covering your ears', mood: 'braced', note: 'Bring an open palm flat against each side of the head. Bracing face.',
    quip: 'The fuse box just screamed.' },
  { level: 5, title: 'Proposing with a rose', prop: 'rose', note: 'Hold the rose out in front at chest height and bend one knee low. Smitten.',
    quip: 'Will you marry me? Asking for the sandbag.' },
  { level: 5, title: 'Rocking out at a concert', prop: 'mic', note: 'Throw up Rock on with one hand and hold the mic high in the other. Cheeky wink.',
    quip: 'The gala booked a tribute act. It is you.' },
  { level: 5, title: 'Answering a banana phone', prop: 'banana', note: 'Hold the banana to one ear like a phone receiver. Forced smile.',
    quip: 'It is for you. It is always for you.' },
  { level: 5, title: 'Brandishing a rubber chicken', prop: 'chicken', note: 'Hold the rubber chicken up by its feet at arm’s length, well away from the head. Fuming.',
    quip: 'Every gala needs one. Nobody knows why.' },
]

export const cueTitles = deck.map(cue => cue.title)
