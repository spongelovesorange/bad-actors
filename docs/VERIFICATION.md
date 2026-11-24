# Bad Actors verification

## Skipping a cue that has everyone stuck · November 24, 2026

- **What the player found.** In a live race on release #19, nothing the player tried got Stubbs to say "Hiding behind a tray". A stuck round could only end when every player had spent all five looks, at about 4¢ each with the voice, or once the host had finished.
- **What changed.**
  - While a round is on and the host hasn't finished it, the race board gives the host **Skip this cue**. It deals the next round with a new cue for every stage, as a quiz host skips a question.
  - The other players see "Stuck? (the host) can skip it."
  - A skipped round counts only for a player who had already guessed it, so a skip can't take a win away.
  - The server is unchanged: the deal action already let the host deal at any time, and a finish for the skipped cue is refused because the cue has changed.
- **How it was checked.**
  - Board tests cover three cases:
    - the host sees Skip mid-round;
    - another player sees who can skip;
    - once the host has finished, the usual "Next round now" replaces it.
  - The two-player DeepSpace race test now ends with the host skipping round 1. Both stages move to round 2 with a cue other than round 1's, and the friend never sees the button.
  - Screenshots show the host's board at 1280 pixels and the friend's line at 390.
- 236 unit tests, the typecheck, lint, both builds, all 44 stage tests and 13 DeepSpace tests pass.

## The race ticket's error, as a toast · November 24, 2026

- **What changed.** When the race desk couldn't open a room, the stage showed a browser alert, the last one in the game. It now shows a toast, the same way the app reports a refused write: "Couldn’t open a race", followed by the desk's reason.
- **How it was checked.**
  - A new DeepSpace test signs a player in and makes the race desk refuse. The toast appears with the desk's reason, no browser dialog opens, and the player stays on the stage.
  - Screenshots at 1280 and 390 pixels show the toast at the bottom right on a computer and along the bottom on a phone.
- 233 unit tests, the typecheck, lint, both builds, all 44 stage tests and 13 DeepSpace tests pass.

## A real race on the live site, and a finish line · November 24, 2026

- **The race.** On release #18 the player raced two of their own accounts in room TTXM for six rounds, with real model calls on every look.
  - The player reported that the two stages played well together. In the two rounds the player screenshotted, 3 and 6, both accounts were ruled correct.
  - Round 6, "Carrying a tray": the host won in 0:20.0 and the second account came second in 0:24.5, one look each. Stubbs said "Carrying a serving tray, is it?" and Judge Monitor showed "Guessed it!".
  - Round 3, "Falling in love", seen from the second account: the host won in 0:50.6 with two looks, the second account took 1:40.8 with three, and the heart-eyed face earned the "Method acting! +1" badge.
  - This is the first round won by a correct ruling in a real game. Until now the winning time was covered by the referee's unit tests only. [The round 6 screenshot](images/race-win.jpg)
- **What the player found.** Six rounds in, there was still no overall winner, and nothing said how many rounds to play.
- **What changed.** Rounds now add up to a match: the first player to win three rounds takes it, as in a best-of-five.
  - Each round goes to its fastest correct guess once it is over; a round nobody guessed counts for no one.
  - Every stage works the score out from the same stored finishes, so no new writes or server code were needed.
  - The board shows each player's round wins as stars and the score after each round. When someone reaches three, it reads "You win the match, 3–1!", and the host's button becomes **New match**, which starts again at 0–0.
- **How it was checked.**
  - Unit tests for the scoring:
    - a round goes to the fastest guess;
    - a round nobody guessed counts for no one;
    - the round being played counts only once it is over;
    - the match ends at three wins, and the next deal starts a new one.
  - Board tests render a 1–1 score and a 3–1 match win with the New match button.
  - Screenshots of the lobby and round 1 at 1280 and 390 pixels show the empty stars and the rule, "First to win 3 rounds takes the match."
  - A won match has not yet been played on the live site. It needs real correct rulings, which cost model calls.
- 233 unit tests, the typecheck, lint, both builds, all 44 stage tests and 12 DeepSpace tests pass.

## Joining by code, and a hint in view · November 24, 2026

- **What the player found.** Trying a race with two accounts on the live site (release #18), the player had a code on screen and nowhere to type it: the board said "Send the code to a friend", but only the invite link let a friend in. Pressing Hint also seemed to do nothing.
- **What changed.**
  - A code box sits under **Race a friend** on the signed-in stage, and on the race page when a link has no code or an unknown one. Case and spaces don't matter. A word with vowels is refused on the spot: "A race code is four consonants, like KXTP."
  - The hint did open, but in the dark bar at the foot of the stage. In a race that bar is below the race board, and on a phone the dressing room covered it. The hint now opens as a card right under the Hint button, which turns yellow while it is open.
- **How it was checked.**
  - In the two-player DeepSpace test, the friend now types the code on their own stage instead of following the link. "kate" is refused and the page stays put. The real code, typed in lower case with spaces, opens the race and seats them.
  - The stage test for the hint now checks that the card opens in view, just under its button, and closes again.
  - Screenshots at 1280 and 390 pixels covered:
    - the code box and its error;
    - the race page without a code, and with an unknown one;
    - a newcomer's glove, still clear of the race ticket and the code box;
    - the hint in free play and in a race.
  - No model calls were made.
- 227 unit tests, the typecheck, lint, both builds, all 44 stage tests and 12 DeepSpace tests pass.

## Racing a friend, and DeepSpace collections underneath · November 24, 2026

- **Why.** Before submitting, the build was checked against the brief and against DeepSpace's three example apps (StoryNest, ThreadHunt, RunningMap). All three keep their data in collections with per-row rules and live queries, and all three test with two real users. Bad Actors used DeepSpace's auth and integration proxy but no collections, and had no two-user test. The player proposed racing the same cue and asked for it to follow how established party games run their rooms.
- **What changed.**
  - A race room per four-letter code: `races`, `race_players` and `race_results` collections, readable by signed-in players and written only by four server actions (create, join, deal, finish). A finish is accepted only when the AI booth's ledger shows the caller's round on this cue, opened after the deal and closed by a correct ruling (or five looks spent). The time runs from the deal to the winning look's Ready press, both on the server's clock.
  - A presence room per race for who is online and what each stage is doing.
  - Best timed shows per night move into a `show_bests` collection that only its owner can read or write, merged with any record already in the browser.
  - The `/settings` and `/api-status` pages and their tests, left from the scaffold, are gone. `api.spec.ts` now checks that the booth turns signed-out visitors away. The hosted Playwright config no longer picks up the practice-server specs.
- **How it was checked.**
  - Unit tests for the referee with an in-memory record room: codes, joins, the six-player cap, host-only deals, a fresh cue each round, and every finish the referee must refuse (stranger, no round, a cue guessed before the deal, a different cue, not yet guessed, booth unreachable), the first time kept on a repeat, and "out" after five looks. The booth's standing report is tested on SQLite.
  - `npx deepspace test run` against the local Worker, with two real test accounts in separate browsers:
    - Each player gets their own booth round.
    - The host opens a room from the ticket and the friend joins through the link. Both rosters fill in live, only the host can deal, both curtains show the same cue for round 1, and the friend's "Posing…" reaches the host's board. Using the friend's own session token, a finish claimed before Stubbs had guessed came back `not_finished` from the booth, and a deal came back `not_host`.
    - A timed show whose five acts ran out of time without a look (no model calls) saved a best evening to the account. It came back after the browser's copy was deleted, and the other account still showed "Not played yet".
  - Screenshots of the ticket, the lobby, the curtain, a race in progress, the results and round 2, at 1280 and 390 pixels. They led to two fixes: the race ticket's styles had been in a stylesheet that `/room` never loads, and during a round the Ready button now sits above the board on a phone.
  - **A real round, with the player's approval.** Two test accounts raced on the local Worker with real model calls, in room ZZZB on the cue "Saluting".
    - Each player changed the pose before every look and pressed Ready five times. Stubbs guessed neither, so both ran out of looks.
    - The Worker log shows each action once: create, two joins, the deal, and two finishes, both accepted.
    - Both boards showed both players "Out of looks" and the line "Nobody got it. Stubbs blames the lighting." The friend had no deal button.
    - Both players then reopened the room, which made no new looks, and the host dealt round 2. Both stages got "Taking a selfie".
    - The ten looks made 20 model calls, about $0.008 at the rate measured on November 24. The exact bill wasn't recorded. The check script waited for a Ready button that, correctly, never returns after a fifth look, so it stopped before writing its receipt.
    - The results board highlighted the first row as the winner even when nobody had guessed. That is fixed.
  - **Not yet seen in a real game at this point:** a round won by a correct ruling. The winning time (from the deal to the winning Ready press) was covered by the referee's unit tests only. The player's race on the live site later the same day showed it; see the first entry.
  - **On the deployed app (release #15).** Two test accounts opened, joined and dealt a race in room BPHW ("Carrying a tray").
    - Both stages got the same cue, and the host's board showed the friend's progress live.
    - The referee refused the friend's unearned finish (`not_finished`) and their deal (`not_host`).
    - No model calls were made. The room stays in the live data, but nobody can reach it without its code.
    - The live entry, stage, race page, race client and room files matched the local build byte for byte.
    - After release #15 the player found the tutorial glove half hidden: it hangs below the Free play ticket, and the new race ticket underneath painted over it. Release #16 raises the beckoning ticket above its neighbours. Screenshots at 1280 and 390 pixels show the whole glove, and all 44 stage tests still pass. The same screenshot showed Free play promising "Any of 18 cues"; it now reads the deck's size, 30.
    - Release #14 shipped while two scratch test files sat in `tests/`. They weren't in the bundle, but the release was marked as built from uncommitted changes, so #15 redeployed the same commit from a clean tree.
- 227 unit tests, the typecheck, lint, both builds, all 44 stage tests and 12 DeepSpace tests pass.

## The house curtain · November 24, 2026

- **What the player asked for.** The cue still didn't stand out. The player suggested a curtain that starts closed, shows the cue in big letters and then opens, done with some humour, and the same opening at the front of the how-to-play demo.
- **What changed.**
  - Each act now opens behind a red curtain that covers the boards down to the stage lip. A board of chasing bulbs comes down on two ropes with the act, the cue in big letters and the director's note. On a night's first act it also warns what will go wrong. The house lights dim and a follow spot finds the board a beat late.
  - A notice pasted across the board's corner rotates through gags such as *Sold out · 1 seat* and *Understudy on tonight*. On the third act of a visit, and every fifth act after it, the curtain sticks halfway while a stagehand shouts from the wings, then flies open.
  - A click on the curtain, or the player's first move (a joint, a prop, a face), opens it at once. The act's clock and Stubbs's first look wait until it is open. Stubbs stays in front of it. On a stage narrower than 620 px his balloon waits for the curtain, because there it covered the board's text.
  - The demo now opens the same way: the curtain and a board reading "Your cue: Talking on the phone", then the glove's round. **Read the cue** is the new first of four steps. The loop is 10 seconds and ends with the curtain closing rather than a fade.
  - Three new synthesized sounds: the curtain's swish with its rings ticking over the rod, a snare roll timed to end as the curtain opens, and a "ta-da". The board lands with the old clapperboard clack. The slate that used to open each act is gone.
- **How it was checked.**
  - Muted headless Chromium screenshots of the whole sequence: closing, the board dropping, reading and opening at 1280 px; reading at 1024, 768, 390 and 320 px; the stuck curtain on the third act; reduced motion, where the board appears without movement and the curtain fades away; the demo's opening at 1280 and 390 px.
  - The screenshots caught two overlaps, both fixed before release: Stubbs's balloon over the board on phones, and the "Click the curtain to start" hint under a tall board at 768 px. The hint now hangs below the board.
  - A new stage test: the curtain shows the cue in big letters with the night's warning; a Ready pressed behind it sends no look until the curtain opens by itself; the same night's next cue has no warning; and picking a prop opens the curtain at once. The timed-show test now checks that the clock is paused behind the curtain. The demo test checks the four steps and the cue on the demo's curtain.
  - Unit tests: the demo's curtain opens before the glove comes on, moves without a jump all round the loop and closes at the end; the new sounds render at their set levels; the "ta-da" cuts off the drum roll and nothing else.
  - **Not checked by ear.** The assistant can't hear the new sounds; the player judges them.
- 216 unit tests, the typecheck, lint, both builds and all 44 stage tests pass.

## Sound in Safari and a livelier front row · November 24, 2026

- **Silence in Safari.** In Safari on a Mac the live game made no sound, even with the Stage sound button reading On.
  - **First guess, wrong.** The guess was that Safari's `AudioNode.connect()` returns nothing, which would break the chained `source.connect(gain).connect(destination)`. Making `connect()` return nothing in Chromium did silence the game, so release #10 split every chain into separate calls. The player still heard nothing in Safari.
  - **Measured in Safari.** A temporary sound check ran in the player's Safari 26.6 against the practice server and recorded every Web Audio call:
    - All 36 `connect()` calls returned the node.
    - The context started on the click and was running.
    - 17 sounds started and the level at the speakers peaked at 0.227.
    - The player heard every sound and a plain test beep.

    The game's audio code works in a fresh Safari page.
  - **On the live site.** After release #11 the player's long-open live tab was still silent. A brand-new Safari tab opened on the live site played sound. A stage test then recreated the player's exact symptom: the page was marked hidden and then shown again without a `visibilitychange` event, and after that Stage sound read On while no sound started at all.
  - **What changed.**
    - The split calls stay, since they cost nothing.
    - Release #11: if the browser pauses the audio while Stage sound is on, the next click or key press resumes it, and the room tone and band come back once it runs.
    - Any click or key press now also tells the sound desk the page is in front. The stage test failed before this change and passes after it.
    - Unit tests cover the unchained `connect()` and both ways of waking.

    It is still not confirmed whether the old tab missed that event, had been muted with Safari's speaker button, or held an audio context that Safari had paused. Later that day the player reported sound in their Safari tab again; which change, if any, fixed that tab is unknown.
- **Stubbs and Judge Monitor act between lines.** The player asked for richer faces that move. The README describes what each of them does in each mood. Every mood was drawn close up in Chromium, and the animations running on each part were read back from the page:
  - Stubbs: breathing, blinking and glancing at rest, plus a yawn when idle with his jaw shut; the opera-glass sweep while looking; three hops on a hit; a shiver and a falling bead of sweat on a miss; a wobble and circling eyes on an error; a falling tear on the Big Feelings night; glances at the balcony on the Gala night.
  - Judge Monitor: a flicker and a slow scan bar in every mood; blinking and glancing eyes at rest; typing dots and a blinking amber light while it weighs a guess; a hop, a glow and sparkles for a match; a glitch and a red flash for a miss; one eye pondering beside a question mark for a close call; static snow when it can't rule.
  - A free-play round with scripted replies reached the opera glasses, then the programme and the Miss! slip.
  - Reduced motion turns every one of these animations off and keeps the expressions.
- 214 unit tests, the typecheck, lint, both builds and all 43 stage tests pass.

## The twelve new cues on the real models · November 24, 2026

After release #8 the player approved a small paid check of the 12 new cues. Each pose was built from its cue's note and photographed by the stage's own camera. The requests matched the shipped ones exactly: Stubbs on Claude Haiku 5.5 with the night's mood and a random comic angle, then the referee on Haiku 4.5 at temperature 0. Each frame got one look; in the game Stubbs gets five and hears his earlier misses.

- **First look: 9 of 12 correct.** Karaoke, rain, the book, love, hitchhiking, covering the ears, the rose and the rock concert were all named. The banana held to the ear was read as "talking on the phone", which the referee accepted for the banana phone.
- **Three misses, three fixes:**
  - The tantrum's fists beside the head read as "covering ears". The note now asks for fists high above the head, which read as "shaking fists in anger" (correct).
  - "Pointing at the sky" read as "having a sudden bright idea" (uncertain). The cue is now **Having a bright idea**, a gag that suits the Blackout night, and the same pose was read as "having a sudden brainwave" (correct).
  - The rubber chicken held up beside the head was read as "talking on a banana phone". It now has wings, a bigger comb and a wattle, and the note asks for it at arm's length. It was then read as "lifting a chicken by its neck", which can't show a swing. Renamed **Brandishing a rubber chicken**, the referee accepted that guess.
- **Stubbs's lines carried each night's mood.** On the Blackout night he blamed the electrician; on the Gala he called the player a "cheeky heckler" for ringing him on a banana.
- 32 calls in all cost **$0.01244**. [The record, with every guess, line and cost](verification/new-cues-haiku-2026-11-24.json) · [The twelve poses](verification/new-cues-2026-11-24/twelve-new-cues.png)

## Five nights, a bigger cupboard and a pit band · November 24, 2026

The player asked for more props, faces and hand shapes. They also wanted every level to be its own surprise, with jokes in it, plus richer sounds and background music.

- **Cupboard.** There are six new props: a microphone, an umbrella, a book, a rose, a banana and a rubber chicken held by its feet. They follow the existing rules for dragging, handing off and putting down. The long ones lie on their side when put down and stand up again when picked up.
  - Five new faces: Fuming, Weepy, Snoozing, Smitten and Cheeky wink.
  - Three new hand shapes: Point, Thumbs up and Rock on. The first Point drawing raised the finger from the middle of the fist and read as a rude gesture. The finger now rises from the thumb side.
- **Five nights.** The deck grew from 18 to 30 cues. The first 18 kept their numbers, so a round started before the change still scores. Each night has its own twist, opener, act length and curtain-call reviews; the README lists the twists. Every cue has a director's note on the act slate, and the act clock waits while the slate is up.
  - A full Big Feelings show with scripted replies scored 5/5 and 19 ★. Four acts were played in the card's mood and earned the method bonus; the fifth was not.
  - The other twists were checked one by one at 1280 × 800 and 375 × 812:
    - Stage fright makes the actor tremble.
    - Catch! drops the phone at the actor's feet after the slate, with the stagehand's shout.
    - Lights out turns the hall dark with two glowing eyes and an apology.
    - The heckler shouts from a balcony box.
- **Stubbs's humour by night.** The server adds the night's mood to the text beside each picture, for example "gala night: you wear a borrowed tuxedo and are feuding with a heckler in the balcony". A unit test checks that no mood names an action from the deck. No paid model call was made to try the moods.
- **Pit band and stage cues.** An original eight-bar music-hall tune is arranged six ways and rendered in the browser into seamless loops:
  - Lobby: solo piano.
  - Opening Night: ragtime upright piano.
  - The Prop Cupboard: xylophone and tuba.
  - Big Feelings: a violin waltz in a minor key.
  - Blackout Matinee: an organ in a minor key.
  - Heckler’s Gala: brass.

  The band plays at a gain of 0.15 and drops to about a third while Stubbs or the crowd is heard. **Pit band** turns it off. Twelve new synthesized cues cover the clapperboard, the flung prop, the prop pop, the face boing, the hand click, the blackout's fuse and breaker, the heckler's "Oi!", the method-acting sparkle, the curtain fanfare and knocking knees. The assistant did not listen to any of it. Levels were set by normalising peaks against the existing button sounds, and the player's ear is the real check.
- **Phone fixes found while testing.**
  - A vertical drag on a joint scrolled the page and dropped the grab, because Chrome ignores touch-action on the grip circles inside the SVG. A non-passive touchmove handler now keeps the drag.
  - At 320 px the ink of a hanging cue sat 3.9–4.9 px from the paper edge, and the test wants at least 5. The board's padding grew by 1–2 px.
  - The dressing room now uses tab semantics only when it is docked, so a screen reader reaches all four sections on desktop.
- **Browser tests.** The stage specs were written for the loopback practice server, but the main Playwright config serves the hosted app. Its public page sends a player to `/room` to sign in, so 10 specs could never reach a game. `npm run test:stage` now runs them against the practice server with scripted replies.
  - All 42 now pass. TypeScript, ESLint, 212 unit tests and both builds also passed.

## A silent how-to-play demo and the dressing room · November 24, 2026

The player said the pose controls sat too far below the stage, and a friend's playtest found that a newcomer could not tell where to start. Both changes borrow from phone games. Drawing games keep their tools beside the canvas. Two-player party collections open each game with a silent hand demo, then point at what to tap.

- **Dressing room.** The prop tray, expressions, hand shapes and foot turns now sit in one column beside the stage. On desktop the column stays in view while the page scrolls. At 960 px and narrower it docks to the bottom of the screen with four tabs, Prop, Face, Hands and Feet, and the arrow keys move between them.
  - At 1280 × 800 the stage, the tickets and every control fit on one screen.
  - At 375 × 812 each tab fits the tray without scrolling. Hands is the tallest at 232 px, and the whole stage stays visible above the tray.
- **Silent demo.** The handbook's cartoon is replaced by an 8.4 s loop on the real puppet. A white glove drags the right hand from the hip to the ear, taps the phone into it and presses Ready. Stubbs answers "On the phone!" and the judge's DING follows. Three captions light up in step.
  - The drag uses the stage's own drag code, so the elbow turns outward as it does when a player drags. A unit test caps elbow travel at under 8 units per frame. The first path made it jump 98.
  - The demo can be paused. With reduced motion it shows the finished scene and nothing moves.
- **The glove after the demo.** It taps the Free play ticket, scrolled into view and above the tray on a phone. In the first game it shows which hand to grab. Once the pose changes it moves to Ready, and it disappears after the first look.
  - It sits outside the photographed puppet, so Stubbs never sees it.
  - A player arriving from a ticket link (`/room?play=…`) goes straight to the cue deck instead of seeing the demo a second time.
- **Local Chrome checks, scripted responses, muted audio.** At 1024 × 768 and 375 × 812 the demo fit without scrolling. The whole chain ran: demo, ticket, deck, drag hint, Ready hint and one look, after which the hint was gone.

## Levels, a five-act show and Ready-only looks · November 24, 2026

The player asked for more cues and levels, a reason to keep playing, and for Stubbs to wait until a pose was finished. The ideas came from Google's *Quick, Draw!*, which ends a short run with a recap of the AI's guesses, and *Heads Up!*'s themed decks.

- **Deck.** The deck has 18 cues, six per level, defined once in `src/deck.ts`. Both the stage and the server read it, so the referee's titles cannot drift from the buttons. The original six keep their pose sheets; the twelve new cues have text hints. Their recognition by the vision model has not been measured, and the later levels are meant to be harder.
- **Timed show.** It deals five different cues from a level, gives each act 45 seconds and moves to the next act 3.2 s after each act's applause or heckle. The curtain call shows each frozen pose, Stubbs's line, stars for the number of looks used, the score and a review written in advance, which costs nothing. The best score per level is kept in the browser. Three acts guessed opens the next level.
- **Ready-only looks.** Looks now happen only when the player presses **Ready! Guess, Stubbs**; moving the actor sends nothing. In local Chrome with scripted responses, moving a hand and waiting 6 s sent no look, and pressing Ready sent exactly one.
- **Cue controls panel removed.** The opening guess moved to the box office. Hint and Change cue appear during a game, and pass-the-screen hiding was removed.
- **Browser tests.** The browser test configuration now skips the handbook with a test-only key, because the handbook otherwise opens on every visit.

**Local Chrome checks, scripted responses, muted audio:**
- The 18-card deck sheet, the level sheet with Levels 2 and 3 locked, Free play on cue 12 and the hint strip.
- A full Level 1 show: four acts guessed, one timed out. The curtain call read 4/5 with 12 ★, saved the best score, unlocked Level 2, and **Next level** dealt a Level 2 cue.
- Because the preview pane ran in the background, those runs overrode page visibility and reduced motion to keep throttled timers moving.

TypeScript, ESLint and 204 unit tests passed. The Playwright specs were updated to the new flow but, as before, cannot launch Chromium in this environment.

## A cheekier Stubbs, his new voice and the box office · November 24, 2026

The player found the first voice too ordinary. The `list-voices` endpoint returned 1,452 voices, and we picked five comic ones. Each read the same line on `eleven_v3`, which acts out bracketed cues such as `[snorts]` and `[laughs]`. Each clip took about 3 s through the CLI. The player listened and chose “Georg”, a gruff, quavering ninety-year-old. [His sample](verification/stubbs-voice-sample.mp3)

- Stubbs's brief now makes him smug, petty and absurd. He teases the sandbag, never the player. Each look draws one comic angle from eight, such as a fake one-star review or a conspiracy theory about the props, so the jokes vary.
- He may add up to two known cues, placed before the words they colour. The balloon prints the remark without cues; the voice receives the cues.
- Because v3 is slower, the voice wait grew from 4 s to 6 s.
- On the six stage frames, the new brief still named all six actions. Two rounds of six calls cost $0.005.
- Two large tickets under the stage now start a game.
  - **Free play** moves the opening act to the first cue and waits for a pose before Stubbs looks.
  - **Timed show · 45s** draws a random cue and starts the clock.
- Both tickets were checked with scripted responses and muted audio. They sit side by side at desktop width and stack at 375 px without overflow.
- The footer now reads “Designed by Shi Qiu”.

TypeScript, ESLint, 198 unit tests and both builds passed. Georg's voice in a signed-in round awaits the player's own check.

## Sound, handbook and front row · November 23, 2026

The player reported a silent site after the release. On the live page, Chromium started the room tone, button sounds, applause and Stubbs's syllables once Stage sound was on. The cause was the stored preference. The handbook that offers **Places! Sound on** was remembered in localStorage, but the sound choice lived in sessionStorage. A returning player in a new tab therefore got neither the handbook nor sound.

- The sound choice is now saved in localStorage. In a fresh live tab the first click turned it back on, and the room tone, buttons, applause and syllables all started.
- The persisted choice shipped in release #5. In this local revision the handbook also opens on every visit and refresh, as the player asked. That puts **Places! Sound on** in front of them each time.
- A hit now fills the front stalls with six spectators of varied size and colour, who clap out of time. They were checked frozen at desktop and 375 px widths beside Stubbs, clear of the actor.
- The steady background noise the player heard after closing Safari came from the assistant's own preview browser, which had stage sound on during testing. That preview was closed and later checks ran muted.

## Stubbs reads the hard poses and says his line · November 23, 2026

The player reported that Stubbs called every phone-at-the-ear pose a selfie and every covered-eyes pose a lifted load. We sent the same six stage PNGs from the earlier blind check through the developer CLI. Each request contained the picture and the brief and nothing else: no cue, filename or answer list. With a new brief describing the puppet's anatomy, Claude Haiku 4.5 still answered “Taking a selfie with phone” and “carrying a heavy suitcase overhead.” Claude Haiku 5.5, Sonnet 5.5 and Opus 5.5 each named both actions. Haiku 5.5 cost about $0.0002–0.0005 per look, less than Haiku 4.5's $0.001, so the hosted reader now uses it. The text-only referee stays on Haiku 4.5 at temperature 0.

- The integration forwards neither `thinking` nor `output_config`. Requests with deliberately invalid values for both succeeded. Haiku 5.5 therefore runs at its default reasoning effort. One call spent its whole 1,024-token budget on reasoning and returned `output_budget_exhausted`. The reader now allows 3,000 tokens, and the game reports that code as an output limit.
- Results for the shipped brief, one call per frame:
  - phone at the ear: “talking on a mobile phone”
  - covered eyes: “playing peekaboo”
  - hands raised: “surrendering with hands raised”
  - tray: “carrying a baking dish”

  The shipped referee prompt scored the three paraphrases as correct. Across the prompt drafts, the surrender frame was read as stretching in 2 of 8 calls.
- When the earlier guesses in a round are listed as ruled out, Stubbs changes his reading. For example, after “Taking a selfie” was ruled out he answered “Oh, a phone call, not a selfie, you vain sandbag.” A correct selfie stayed a selfie after an unrelated miss.
- All 68 calls cost $0.0372 in total. [Every request label, answer, timing and cost](verification/stubbs-haiku55-2026-11-23.json)

ElevenLabs `generate-speech` returned `data:audio/mpeg;base64,…` for one real line with the stock “George” voice, `eleven_flash_v2_5` and `mp3_22050_32`: 21,646 bytes, 5.36 seconds, mono 22.05 kHz at 32 kbps, about 1.2 seconds through the CLI. [The clip](verification/stubbs-voice-sample.mp3)

In local Chrome, scripted responses replaced the stage endpoints and a temporary switch enabled the voice path on the practice page. The switch was removed afterwards. With Stage sound on:

- The balloon held at zero letters 64 ms after the guess arrived.
- The first letter appeared once the clip arrived, 1.5 s after the click, including a simulated 1.2 s delay.
- The 80 letters spread over 10.5 s of an 11 s test clip.
- When the clip request failed, the same line typed at the normal pace in 2.0 s with the tin syllables.
- At 1280 × 800 the long-line balloon measured 330 × 99 px beside the actor. At 375 px it measured 213 × 76 px inside the stage.

TypeScript, ESLint, 195 unit tests and both production builds passed.

Still to check: a signed-in round on the deployed site with the real models and voice, on a physical phone and by ear.

## Local preview · November 23, 2026 · Handwritten handbook and stage sound

The loopback AI rehearsal returned HTTP 200 at the drinking-water exercise. Its status reported `gpt-6.2-sol` for both roles. No live model request was sent during this regression. The sample recording uses the same original synthesis functions as the game. [11-second sound check](../public/stage-soundcheck.mp3)

TypeScript, 176 unit tests, ESLint, the practice build and the production build passed. In a separate DOM integration run, the first visit opened the three-panel handbook, quiet entry dismissed it, a revisit kept it closed, and How to play reopened it. A timed round waited for the handbook to close. Choosing the cup and pressing **Guess it, Stubbs!** once submitted exactly the authored actor artwork. The camera and model were controlled for this check. Separate checks observed the room loop, the three UI sounds, mute, the jaw and joint gates, countdown pause and the final bell. A physical speaker audition and rendered desktop/mobile screenshots are pending: the available Mac browser launchers exited before either viewport opened.

On SQLite with a model double, the verified owner completed 65 initial looks and one additional look after four other players had exhausted all 240 shared looks. Each visitor reached 60; the next visitor was denied, and a new UTC day reopened play. The five-look round limit and replay protection remain active. The private loopback ledger accepted 80 consecutive reservations on one day. Hosted quota changes in this checkout await publication.

## Managed AI on the stage · November 23, 2026

The first public release, `rel_01M85PMG8F9Z8GDJ3XB5SY6GVT`, served the home page and room at [Bad Actors](https://bad-actors-shi.app.space/). A fresh Chrome session completed the opening phone puzzle. The guest AI status on that release showed the booth was closed.

Six separate developer-account calls sent Claude Haiku 4.5 one frozen stage PNG apiece, with the same prompt and no answer key. By manual assessment of the depicted action, four guesses fit: carrying a dish, drinking, surrendering and taking a selfie. Claude guessed a selfie for the phone at the ear and a heavy load for covering the eyes. The six calls cost $0.003367 in total. The measure covers these six frames; a game referee did not score them. [Images, exact answers, timings and costs](verification/managed-vision-2026-11-23.json)

Three independent text-only calls used the game referee prompt and the phone-call cue. Claude accepted “make a call” and “call sombody” and rejected “texting a friend.” Their total reported cost was $0.000710. Vision and referee tests together cost $0.004077. [Exact referee outputs and costs](verification/managed-referee-2026-11-23.json)

The vision adapter strips Markdown headings and explanatory paragraphs from replies before Stubbs speaks. If the provider supplies multiple alternatives, Stubbs says “unclear.” For example, a human can read both “Hands up” and “I give up” as surrender, but the live adapter treats two alternatives as undecided.

## Hosted game preparation · November 23, 2026

The owner's DeepSpace CLI listed one active, deployed application, `planb-meet-qs26`, owned by the signed-in account. Bad Actors still had an unregistered placeholder when this checkout was prepared. The Mac launcher checks that exact old app and presents the platform's destructive confirmation if a quota refusal requires freeing its slot. Its release URL comes from the successful deployment receipt.

An isolated copy with a synthetic app identity built the production Worker, client and prerendered homepage. The local Worker served the homepage and room entry with HTTP 200. With no selected provider, its status returned `available:false`, and starting a model round returned 503 with zero outbound requests. In a separate isolated Worker with a test model service, native SQLite persisted round and quota state. A repeated observation replayed the stored result without another model call. Hosted login, a public deployment and the recognition rate of managed Claude on the six game poses still require separate checks. [Worker and model-double receipt](verification/hosted-stage-local.json)

## The fly cue, front row and verdict effects · November 23, 2026

The player captured “Talking on the phone” extending below the plank. The old plank kept a fixed paint height when the title wrapped. The rebuilt paper and frame now grow together. Local Chromium measured the drawn text against the cut paper edge for all six exercises at 11 widths from 320 to 1440 pixels. The smallest clearance across the 66 combinations was 5.18 CSS pixels. The phone title had 5.94 pixels at 320 wide and 6.02 at 390 wide. [All 66 measurements](verification/stubbs-delivery/cue-ink.json)

Stubbs's painted pupil faces the performer at desktop, 390 and 320 pixel widths. The head, hands and ankles remained accessible at the centers of their painted grips. The upper-right clock, suspended cue and speech balloon each cleared the neutral pose. In the browser's timed draw, the flying title matched the drawn exercise. Hiding the cue removed the answer, hint and chooser. [Desktop stage](verification/stubbs-delivery/stage-1440.jpg) · [390-pixel stage](verification/stubbs-delivery/stage-390.jpg) · [320-pixel stage](verification/stubbs-delivery/stage-320.jpg)

The fixed opening pose accepts a typed guess without opening an AI round. Local browser runs submitted “phone call” and “baking bread” at 1440 and 390 pixels. The former triggered paper ribbons, ticket stubs and two clapping spectators. The latter brought out the front-row heckler and a drooping paper horn. Both effects sit outside the photographed puppet. Live game code waits for a definitive ruling and the end of Stubbs's line. An ambiguous answer or a referee outage leaves the front row quiet. [Applause](verification/stubbs-delivery/crowd-correct-1440.jpg) · [Heckler at 390 pixels](verification/stubbs-delivery/crowd-incorrect-390.jpg)

Native Chrome opened no audio context on a muted guess. A trusted click on **Crowd sound** enabled the output. The opening puzzle played the 1.03-second applause and 0.68-second raspberry into the browser audio graph. Muting or unmounting during a reaction stopped the source and closed the context. Both sounds are synthesized locally. Speaker loudness, human listening preference and physical iOS hardware were outside this check. [Output measurements](verification/stubbs-delivery/crowd-sound.json)

With scripted provider responses, Chrome recorded Stubbs raising a hand before the first letter, moving his jaw during the guess and waiting for the ruling. In the slow-referee run the 33-letter guess was visible by 1363 ms and the slip printed at 1921 ms. In the quick-referee miss, the result arrived at 192 ms but the slip waited until 1079 ms. The labeled clip uses a phone posed at the ear and a controlled model reply. [Browser traces](verification/stubbs-delivery/chrome.json) · [See the sequence](verification/stubbs-delivery/stubbs-speaks.gif)

The same sentence was typeset in five hand-lettered faces at 22 pixels in a 265-pixel balloon. The chosen face, Kalam Bold, keeps its pen slant and broad strokes on a small screen. The fly cue, dialogue and acting notes use it. Young Serif sets the printed programme headings. National Park carries the controls and timer. All three fonts and their original licenses travel with the local game. [Five samples of the same line](verification/stubbs-delivery/handwriting.png)

The picture reader and text referee can now be configured independently. Both still default to the gateway's `gpt-6.2-sol`. In the three archived solo image probes it recognized drinking and a phone call, and read covering the eyes as rubbing them. Its two real text-only phone paraphrase checks both passed. The saved gateway model list also included `gpt-6.1-terra`. Its vendor documents visual reasoning as a strength. No new paid calls were made for this revision and this gateway has no comparative result for Terra on our actors. [Sol picture receipts](verification/sol-charades/receipts.json) · [Referee receipts](verification/ai-audience-live/paraphrases.json) · [Terra model specifications](https://developers.openai.com/api/docs/models/gpt-6.1-terra)

The old line “We appear to have lost the booth” covered several failures. On this check the normal local server port initially refused connections. Once started it reported both configured roles available. That status check does not identify which step failed during the earlier game. The local practice game builds independently. Building the hosted app still requires a valid DeepSpace app ID. [App registration status](verification/setup-2026-11-23.md)

TypeScript, 139 Vitest checks across 20 files, ESLint and the practice production build passed. The finalized practice bundles have SHA-256 `1c7931b122197f79e9b892f1f5068f2c01217a1c74f6f2e59dbfaff93db85026` for JavaScript and `c3fff3c8bb7db7ae7d075512d16bd3b63e5ae54d90e166bbe656b61c073183de` for CSS. Playwright discovered 51 browser tests in nine files. The separately launched Playwright Chromium could not start under the Mac's process restrictions. The browser measurements above ran in an attached local Chrome session. Physical-phone play, hosted rooms and live speech integration are still pending.

The project's single-file rehearsal and the Mac's double-click copy of `Bad-Actors.html` have identical SHA-256 `ce94d85903f274098d9bc43ce09f746f5c568b04a671ab0a6016a34ec119109d`. Chrome opened the final offline document, loaded its three embedded fonts and licenses, and displayed all six cue choices without network access.

## Mr. Stubbs's front row · November 23, 2026

**On-the-spot timed performance, independent blind reader.** The player clicked **Play with AI** and drew *Drinking water*. Starting at 45 seconds, the player picked up the cup and dragged it to the actor's mouth. The clock read 33 seconds on the first observation. An isolated local fixture captured this exact PNG before any outbound request. A fresh visual model received only that picture, without the cue, filename hints or a candidate list. Its entire answer was “Sipping from a cup.” This was a separate blind reading of the timed show. The live gateway results are listed below. [Picture the reader saw](verification/ai-audience-live/on-stage.png) · [Stage and countdown](verification/ai-audience-live/on-stage-clock.jpg) · [Timed gestures and blind reading](verification/ai-audience-live/on-stage-receipt.json)

**Real local game, third-party provider.** We selected the phone cue deliberately for a controlled comparison before adding the timed show. A player posed a cup at the mouth in one round and a phone at the ear in a fresh round of the same game. The browser sent one 560 × 560 PNG of the actor and prop for each look. Vision saw neither the cue nor the referee's input. These observations used the operator-approved HTTP gateway, which reported `gpt-6.2-sol-2026-11-17`. [Two observation receipts](verification/ai-audience-live/observations.json) · [Actual second guess on stage](verification/ai-audience-live/look-2-phone.jpg)

| Picture the model saw | Words shown in the balloon | Game ruling | Round trip |
| --- | --- | --- | ---: |
| Cup at the mouth | “Taking a sip from a cup.” | Miss for the assigned phone cue | 15.945 s |
| Phone at the ear | “Holding a phone to their ear.” | Score unavailable. The guess remained on screen. | 19.198 s |

**Real referee, text only.** Two separate calls supplied the phone cue and the candidate wording directly. The gateway returned `correct` for both “make a call” (10.963 s) and “call sombody” (6.460 s), reporting 146 tokens for each. These calls validate semantic scoring of those phrases. They did not photograph the actor. [Machine receipt](verification/ai-audience-live/paraphrases.json)

After the unjudged phone image, the revised referee prompt explicitly accepts the recognizable purpose of a silent pose. It can read simple formatting around a verdict and reports a coarse error category if the provider fails. The exact original error is unknown. Automatic approval review blocked the text-only follow-up for a reported HTTPS/authorized-HTTP mismatch. We recorded no new verdict. [Follow-up receipt](verification/ai-audience-live/phone-referee.json)

**Controlled browser responses.** Eleven scenarios passed in a separate local Chrome session with scripted endpoint responses. They cover the speech balloon and score, ambiguous and unjudged responses, late replies, offline practice, recoverable failures, quota limits and the timed draw. One case started at 45 seconds, advanced to eight, waited 25 simulated seconds for the audience, resumed at eight, and expired at zero. Moving after expiry sent no further picture. The next draw produced a different cue. Pictures contain the actor and prop, with the mechanical clock outside the capture. The layouts fit desktop and 390/320 CSS pixels. The separately launched Playwright Chromium was blocked by macOS. [Chrome receipt](verification/ai-audience-mock/receipts.json) · [Eight seconds on the clock](verification/ai-audience-mock/timer-final-desktop.jpg) · [390-pixel layout](verification/ai-audience-mock/timer-final-390.jpg)

These checks used the local rehearsal. Hosted DeepSpace, multiple simultaneous users, microphone input and speech output were outside their scope.

The final local checks passed TypeScript, ESLint, 115 unit tests across 17 files and the production practice build. The SHA-256 digests are `94d5ec0697454f47ad773e6436b731718d3197da4eadf4ee1f44cc0224a84cc5` for JavaScript and `c6c6ca9c946e231a9b279c2aa32a7aa2e9d8ba6b9e2f3c8ffe9f90063bf8ab00` for CSS.

## Six cues in the local playbill · November 23, 2026

All six exercises were performed from reset on the single stage in local Chrome. The operator dragged the visible targets and used the production controls for objects, hands and expression. Each capture contains the settled actor and prop. No poses were loaded from a template. Two independent AI viewers saw only the numbered contact sheet in fresh contexts, received no answer list and described all six pictures. These were model readings of one sheet. New-player completion time, unaided human recognition, physical phones and the in-game AI remain unmeasured. This check made no paid provider calls. [Numbered contact sheet](verification/six-poses-2026-11-23/six-poses.png) · [Pointer traces, image digests and pictures](verification/six-poses-2026-11-23/receipts.json)

| Frame | Intended action | What the two viewers read |
| --- | --- | --- |
| 1 | Carrying a tray | Both described carrying a tray. One also considered a shallow rectangular box. |
| 2 | Talking on the phone | Both described a call with the phone against one ear. |
| 3 | Covering your eyes | Both described palms covering the eyes. One suggested possible motives. |
| 4 | Drinking water | Both described sipping from a small cup. The liquid itself has no identifying visual cue. |
| 5 | Surrendering | Both described hands raised in surrender. One was more confident in the gesture than its intent. |
| 6 | Taking a selfie | Both described a phone selfie and a V sign. |

The previous revision, `7e85eba`, dropped the phone when the player dragged the device itself. Repeating the same gesture now moves the right wrist from (326, 262) to (372, 104). The phone ends at (377, 80), visibly attached with its back camera facing the audience. Lowering it to the ear produces the opposite reading. A separate native mouse drag verified attachment; a put-down and left-palm drop verified handoff. The wider enamel tray now has a handle at each end and a supporting-grip silhouette. The settled pictures above supply the optional acting hints in this build.

Strong flicks produced two visible ink strokes in the local browser. A gentle one-unit adjustment, a 180 ms hold and a release each left zero strokes. Neither stroke was part of the actor-only snapshot.

The local browser completed the opening guess and reveal, chose the selfie directly, opened its illustrated hint, hid the card and advanced with the new cue still covered. Hiding the cue removed the hint image, stage direction and chooser from the card. Keyboard input moved a hand and reset restored it; closing Help returned focus to its opener. At widths 1440, 390 and 320 CSS pixels the document fit the viewport. The last two widths are desktop Chrome layouts. [Desktop](verification/playbill-2026-11-23/desktop.jpg) · [Selfie with the actor’s hint](verification/playbill-2026-11-23/selfie.jpg) · [390px layout](verification/playbill-2026-11-23/mobile.jpg) · [Browser receipt](verification/playbill-2026-11-23/checks.json)

TypeScript, 78 Vitest tests, ESLint and the standalone practice production build passed. The output bundles have SHA-256 `ed84e71f682fcbffede756a393da6b61cf7b08625999b34fde93571cae8039b2` (JavaScript) and `81f8bad6eefd3364dc143605cc91cd58cac2a475eef68148154c81a4aa11c53f` (CSS). Playwright discovered 36 cases. Standalone Chromium could not start in this environment. The interactive results above come from the separate local Chrome session. The hosted game and live integrations were outside this rehearsal check.

## Recoil from every grab point · November 23, 2026

On revision `7264d7b` the player could pose all the joints, but a browser trace confirmed that pulling a foot, elbow, waist or loose prop left every measured motion channel at zero. The revised stage applies a speed-sensitive impulse for each point. An arm pull loads the shoulder. A foot or knee pull loads the hips. Head and chest rotation, held and loose props, and the foot turn controls each have a response. The stage holds the actual grab point under the pointer and lets the remaining mass follow. Slow placement stays quiet.

[Watch the foot pull](images/leg-recoil.gif) · [Geometry and rendering benchmark](verification/puppet-physics-2026-11-23.md)

The local Chrome check exercised all 14 body targets and both held and loose prop drags on the single stage. It delivered pointer events to the page and tracked the actual painted shoulder and cheek after release. All 16 gestures acquired the intended target and settled. The largest measured grip error across the set was 0.582 stage units. On this desktop, a quick pull on the left and right shoulders respectively moved a painted landmark by 24.9 and 22.4 CSS pixels. The corresponding displacements were 33.9 and 35.5 pixels for the elbows and 18.4 and 15.6 for the knees. Separate native mouse drags confirmed pointer capture and release on a foot, wrist and elbow. [Per-target browser measurements](verification/all-joint-recoil-2026-11-23.json)

At the same left-knee travel of approximately 15 stage units, deliberate placement moved the tracked landmarks by 0.00 CSS pixels after release. A flick moved one by 18.4 pixels. Selecting **Direct only** in Help also produced 0.00 pixels of secondary movement on a full foot drag. In the 3.20-second foot-pull clip the right boot rose across the body, the torso tilted 16°, the hips moved 22.82 stage units and the other boot stayed planted. The GIF contains 80 frames at 740 × 404.

In a fresh local Chrome page, a page-level `matchMedia` override supplied `prefers-reduced-motion: reduce`. The foot drag again produced 0.00 pixels of secondary shoulder or cheek movement. This exercises the preference branch in the app. The operating system preference itself was not toggled.

TypeScript, ESLint, all 69 unit tests and the practice build passed. The resulting `index-DlIzX99K.js` has SHA-256 `bf85455e67c5259263c6b8c5acb8eef46b39bb156cff70bf9ff9a769ea170fa7`. Playwright discovered 34 cases. Its bundled Chromium could not start in the local macOS sandbox, so this run has no Playwright pass count. The browser measurements above used a separate local Chrome session. Physical-phone handling is still unverified.

## Sandbag playtest revision · November 23, 2026 (7264d7b)

The player reported that the original torso stood still when they flicked an empty hand and that the mug covered the actor’s face. We repeated their gesture in the local rehearsal. During visual review the sandbag’s resting arms still looked like hands on hips, so we lowered the untouched wrists and let each sleeve sag. The final take starts with an empty sleeve hanging beside the bag.

[Five-second take](images/sandbag-take.gif) · [Four poses made on stage](images/poses.jpg) · [Rehearsal screen](images/rehearsal.jpg)

Chrome delivered the gestures to the local practice page. We sampled its live actor artwork and composited it with the production stage background, with the controls outside the image. The GIF contains 125 frames at 25 fps, 740 × 404 pixels, exactly 5.00 seconds (SHA-256 `dc68b25b19301979a883602c45af6529aab0a695a9bdd41a85477518030e6025`). During the throw the torso reached +15.98°, then swung back to −7.23°, +4.71° and −2.05°. The planted cup rim stayed at the mouth. The original five-second desktop recording had 599 animation frame intervals with a median of 8.30 ms, a 95th percentile of 9.20 ms and none over 33 ms. This measures animation callback spacing on this one desktop.

### Pose editing and expression

The same stage accepts a drag on either wrist, either shoulder or elbow, the waist, the chest turn point, the head or neck tilt, either knee and either foot. The player can plant one boot, bend the other leg and turn the chest without first choosing a body region. Each shoe can turn and each hand can open or make a fist independently. The five expressions are Deadpan, Side-eye, Bracing, Forced smile and Gulp. A hard pull briefly shifts the eyes as the neck recoils. A deliberately raised shin passes in front of the sack so the actor can stand on one visible foot and lift the other.

On the unified desktop page, Chrome reported all 14 body controls simultaneously in the reset pose. Five native mouse drags acquired the intended targets (left wrist, right foot, waist, head and left elbow). Every trial recorded trusted pointer movement, capture and release, and changed the corresponding visible position. The phone in the opening pose adds a fifteenth target. Repeating a tap can select the next control when multiple landmarks coincide.

The motion regressions exercise the same throw at 30, 60 and 120 simulated updates per second, an interrupted frame, fixed planted wrists, high and low elbow bends, parked feet and a saved pose without joint overrides. [Benchmark, scope and reproduction at this revision](https://github.com/spongelovesorange/bad-actors/blob/7264d7bba1f4160889f494111fd041b37f122a54/docs/verification/puppet-physics-2026-11-23.md)

At revision `7264d7b`, TypeScript, ESLint, the 49-test local unit suite and the standalone practice build passed. The practice JavaScript bundle was `index-DWBoO8_w.js` (SHA-256 `fb7f18a8d3e731106b04e7c784eb5450b48323fd02bdffec39b3fa38618b4819`). The extreme pose test checked 64 combinations over 7,040 simulated frames, including exact retention of the planted boots, hand and cup. A laugh from an unprompted human viewer and physical-phone handling remain unmeasured.

### OpenAI-compatible visual guessing probe

Three live stage poses were frozen as separate 560 × 560 PNGs. Only the character and its prop appear in the images. Each request uses the same open-ended question and embeds one image directly, without its filename, a cue, an answer list or conversation history. The local transport check used a mock to verify the three payloads and that the probe stops on the first error.

A live catalog request authenticated to the operator’s configured third-party MG1 endpoint. It listed `gpt-6.2-sol` along with `gpt-6.2-astra` and `gpt-6-luna`. We selected Sol for all three requests. The operator confirmed that the service uses HTTP. The credential was read from the local profile for this test. These results describe the model as identified by the gateway.

| Frozen input | Intended cue | Provider’s exact guess | Time | Outcome |
| --- | --- | --- | ---: | --- |
| [A.png](verification/sol-charades/A.png) | Drinking water | Sipping from a cup. | 7.07 s | Recognized the action |
| [B.png](verification/sol-charades/B.png) | Talking on the phone | Talking on the phone. | 5.62 s | Recognized the action |
| [C.png](verification/sol-charades/C.png) | Covering your eyes | Rubbing both eyes | 5.30 s | Confused covering with rubbing |

All three responses returned HTTP 200 and identified the served model as `gpt-6.2-sol-2026-11-17`. Two of the three guesses matched the intended action. These were three individual still images, each shown once. A gameplay button, a full AI round and overall accuracy across the six cues still need verification. The receipts report token counts. Currency charges were not returned. [Timestamped receipts and input digests](verification/sol-charades/receipts.json)

After seeing the third guess, we gave each hand its own relaxed, open and fist settings. A held prop supplies its own grip, then the chosen hand shape returns when the player puts it down. We posed the actor with spread palms over both eyes for a follow-up comparison. This image has no model score. [Open-palm version of C](verification/sol-charades/C-open-palms.png)

The following command repeats the test on the same images using a local profile containing `OPENAI_API_KEY` and `OPENAI_BASE_URL`. Set `BAD_ACTORS_PROBE_MODEL` to a model offered by that provider. HTTP credentials require the explicit `--allow-http` option before the profile argument. Each run issues up to three live requests.

```sh
BAD_ACTORS_PROBE_MODEL=gpt-6.2-sol node scripts/check-stage-vision.mjs "$PROFILE" docs/verification/sol-charades/{A,B,C}.png
```

## First rehearsal · November 23, 2026 (9d1e81a)

| Check | Result and scope |
| --- | --- |
| Owner and source | The signed-in developer confirmed their identity. The new project has its own Git repository and uses DeepSpace 0.44.2. The production registration command returned `app_quota_exceeded` before issuing an app ID. The DeepSpace build, login in the hosted game and its HTTPS URL are pending. [Setup receipt](verification/setup-2026-11-23.md) |
| Anthropic | Two real developer-account CLI probes used the same prompt and different PNGs. The model correctly identified the reversed positions of a red circle and blue square in both images. Reported cost was $0.000430 total. Game-stage recognition and the round workflow still need separate tests. [Provider receipt](verification/integrations-2026-11-23.md) |
| Speech and ElevenLabs | Catalog inputs were inspected. The developer deferred both live voice checks. No speech or transcription request was sent. |
| Rehearsal billing | Local Hono route tests sent a request to each of the three generic provider routes. All returned HTTP 404 and made zero upstream calls. |
| Human playtest | Pending the applicant's direct-versus-follow comparison, three successive rounds on a physical phone and a blind guesser for the six actions. |
| Live room and replay | Outside the current rehearsal milestone. No signed-in round, role switch, private audio or replay acceptance is claimed. |

### Local build and browser observations

TypeScript, ESLint and all 12 unit tests passed. Six unit tests cover puppet geometry and prop retention. The standalone client built with `npm run build:practice`. Its JavaScript entry `index-yrI21hbs.js` has SHA-256 `1ce901ff24e09b5c6cdf7917fdaf44367444d34c5eec172021b8eca402d02a8e`.

In Chrome at 1280 × 724 CSS pixels, pressing near a palm's edge preserved its position, and moving 20 pixels right and 22 up moved the palm by exactly that amount. With the cup equipped, its rim stayed at the chosen mouth position after release and 350 ms of settling. The page fit horizontally. The [opening stage in that version](https://github.com/spongelovesorange/bad-actors/blob/9d1e81af410f508ac86ed7d8e13dd84f19182b7c/docs/rehearsal.jpg) shows the revised pose. Visual inspection prompted two adjustments: moving the phone outward and down to leave both eyes visible and unfolding the free arm so its sleeve remains visible.

In a 390 × 844 CSS-pixel frame in desktop Chrome, the hand hit areas measured 48 CSS pixels. A mouse drag of 11 pixels right and 19 up moved the palm by those amounts to within 0.01 pixels, with no change in page scroll or horizontal overflow. **Hide cue** removed “Drinking water” from the cue card. **Next cue** kept “Talking on the phone” hidden until **Show cue** was clicked. This check used a mouse at a phone-sized viewport. The isolated Playwright Chromium launcher stopped at macOS process startup, so its automated touch case was not run here.
