# Bad Actors

**Puppet charades in a paper toy theatre where everything goes wrong.** You pose a sandbag understudy. Mr. Stubbs, an AI heckler in the front row, guesses what it is doing from a frozen picture. The look comes from [Pollock’s paper toy theatres](https://www.pollockstoymuseum.co.uk/post/toy-theatre-and-puppetry/) and the posters of *The Play That Goes Wrong*. The second also gave the game its running joke: every night, something on stage fails.

**[Play it live](https://bad-actors-shi.app.space)** · [How it was verified](docs/VERIFICATION.md)

## Three minutes for reviewers

1. **Open the site.** A ten-second silent demo shows the whole loop, from the curtain opening on the cue to Stubbs’s guess. Choose **Let’s play! Sound on**.
2. **Free play → sign in → Talking on the phone.** Drag the actor’s hand to its ear, pick **Phone** from the prop tray and press **Ready! Guess, Stubbs**. Claude Haiku 5.5 guesses from the picture alone. Claude Haiku 4.5 rules on whether the guess means the cue, and ElevenLabs reads Stubbs’s heckle aloud.
3. **Timed show → Opening Night.** You get five 45-second acts and a curtain call. Guess three acts to open the next night, where props are flung from the wings, then come mood bonuses, blackouts and a heckler.
4. **Race a friend.** On the signed-in stage, open a race and send the four-letter code or link to a second account. Both stages get the same cue at the same moment; whoever makes Stubbs say it first wins, timed by the server.

| | |
| --- | --- |
| **Integrations** | Anthropic through DeepSpace handles the picture-only guess and the text-only referee. ElevenLabs gives Stubbs his voice. Speech-to-text was left out on purpose, because this is silent charades. |
| **Main tradeoff** | Each look costs two model calls: a blind guess, then a referee. That way Stubbs never sees the answer, and paraphrases are judged the same way every time. |
| **On DeepSpace** | Auth; the integration proxy; collections with per-row rules and live queries for race rooms, rosters, results and each player's best shows; a presence room per race; server actions as the race referee; a Durable Object as the ledger for paid looks. [Racing a friend](#racing-a-friend) |
| **Built with** | I chose the project (dropping my first one), wrote the first plan, designed the game, chose every reference, tested every screen and button by hand and approved every commit and deploy. Coding agents (Codex, then Claude Code) wrote most of the code and the automated tests under my direction. [How it was built](#how-it-was-built) |
| **Checked** | 227 unit tests, 44 Chromium stage tests, 12 DeepSpace tests on the local Worker (three with two real test accounts) and paid real-model checks. The latest covered the 12 new cues for $0.012. |
| **Not built** | Spectators, chat and a party mode where friends guess each other's poses. [What I’d do next](#not-built-and-what-id-do-next) |

## The feel I was going for

I play a lot of games, and I wanted Bad Actors to feel like one: something you want to poke, not a tidy app you put up with. That taste decided most of what you see.

- **Everything answers back.** A prop pops into the hand, a face boings, and a joint squeaks and wobbles when you tug it. The clock ticks only while you act. A hit brings streamers, a shower of used tickets and six spectators who clap out of time. A miss gets one half-hearted party horn.
- **Show, don't explain.** Like the hand demos before a party game, a silent glove plays a whole round before you read a word, then taps the way in.
- **Characters, not widgets.** The AI has a face and a voice I picked by ear. Stubbs breathes, yawns, hops on a hit and sweats on a miss. Judge Monitor beams, glitches red or fills with static.
- **Failure is part of the show.** Every night something goes wrong on purpose: stage fright, flying props, blackouts, a heckler, a curtain that sticks.
- **Handmade, not a dashboard.** Paper flats, hand-lettered type, ink and spray stand in for cards and grey buttons. Two big tickets replace a menu, and the cue arrives on a board of chasing bulbs after a drum roll.

## Where the ideas come from

The idea, the design and every reference below are mine. The agents built from them.

**Theatre**
- *The Play That Goes Wrong* gave the game its running joke: every night something on stage fails. The crooked fly board, the curtain that sticks, the blackout electrician and the flung props all come from it.
- [Pollock's paper toy theatres](https://www.pollockstoymuseum.co.uk/post/toy-theatre-and-puppetry/) set the look: cut-out flats, a paper proscenium and a printed programme.
- The understudy is a canvas stage weight, the thing that keeps a stage steady and can barely stay upright itself. The National Theatre's puppetry lesson on weight shaped how it moves: the shoulders react first and the head lands a beat late.

**Games**
- Draw-and-guess party games and Jackbox's *Drawful* gave the core loop: one player makes a picture, someone else guesses. Here the pencil is a puppet.
- *Paper Mario: The Thousand-Year Door* gave the front row: the audience sits in view, and the actor's hands and feet are never hidden behind the seats.
- *Papers, Please* put the verdict in a machine. Judge Monitor prints its ruling on a slip, as Lucas Pope's stamp desk does.
- *Octodad* showed how funny a body struggling at an everyday task can be.
- *红蓝大作战*, a two-player iPad party game, gave the silent how-to-play demo: a hand shows you where to touch before you read a word.
- Jackbox and Kahoot rooms, TypeRacer, Mario Kart and chess sites shaped the race: a room code to read out, a roster that fills in live, the same prompt for everyone, a countdown (here, the curtain) and one button for a rematch.

**Comics and lettering**
- Comic speech balloons give Stubbs his voice on the page: a balloon whose tail leads back to him, hand-lettered type and a line printed one letter at a time. [Blambot's lettering guide](https://blambot.com/pages/comic-book-grammar-tradition) set the rules.
- The *Wild Style* mural and New York wall pieces gave the hand-cut BAD ACTORS wordmark its colours and its spray mark.

**Film and animation**
- *Spider-Man: Into the Spider-Verse* and *Across the Spider-Verse* gave the layered print marks in the title, the two ink strokes a sharp drag leaves behind and the stage light.
- Pixar's colour scripts, after Lou Romano's work on *The Incredibles*, made the cue card's colour say whose turn it is. *Luxo Jr.* showed a machine body can act.
- *WALL·E*, and Andrew Stanton's account of finding its face in a pair of binoculars, let Judge Monitor act with its own parts.
- Disney's pose drawings for Mirabel and its guide to follow-through shaped the pose sheet and the actor's weight.
- Jacques Tati's postman in *Jour de fête* set the timing: finish the sip before the other hand flies up.
- *Mystery Science Theater 3000* kept the front-row silhouettes small enough to leave the show in view.
- The *Hawkeye* title sequence showed how separating arms and props makes a silhouette readable.

## The game

Every visit opens with a silent demo, like the hand animations before a phone party game. The curtain opens on the cue, as it does in the game, then a white glove plays one round on the real puppet: it drags a hand up to the ear, taps the phone into it and presses **Ready**, and Mr. Stubbs guesses. Choose **Let’s play! Sound on** or **Play quietly**. The glove then taps the **Free play** ticket, shows a newcomer which hand to drag in the first game and taps **Ready** once the pose has changed. **How to play** replays the demo.

The community hall is one actor short. A canvas stage weight is covering the part. Pose the understudy so someone can guess what it is doing.

[Open the live AI booth](https://bad-actors-shi.app.space/room?play=draw). Sign in and pick a night for tonight’s show: five acts, each on that night’s clock. Each act opens behind the house curtain with its cue in big letters. Once the curtain parts, the cue hangs over the stage on a plank tied to an old boot. Mr. Stubbs, a ticket punch in the front row, gets five looks per act. Strike the pose, then press **Ready! Guess, Stubbs**. He never looks at a half-made pose. The clock pauses while he thinks. He raises a glove and gives his guess. Judge Monitor prints the ruling from a window in the right wing. **What Stubbs saw** keeps the pictures and the exact guesses for the current round.

A hit brings streamers, a shower of used tickets and a front row of six spectators who clap out of time. A miss gets one half-hearted party horn and a heckle from the cheap seats. Turn on **Stage sound** to hear the judge’s bell or buzzer and the puppet’s squeaking joints. In the signed-in game Stubbs reads his line aloud in an ElevenLabs voice; without a recording he mutters in tinny syllables. **Pit band** plays an original music-hall tune, arranged differently for each night, and dips whenever Stubbs speaks. **Room tone** controls the backstage fan separately. Props pop into the hand, faces boing, the curtain swishes open on a snare roll and a “ta-da”, and each night's trouble has its own noises. The clock ticks only during acting time, doubles up at ten seconds and rings at zero. [Listen to the 11-second sound check](public/stage-soundcheck.mp3) You can try both reactions for free in the opening phone puzzle. Enter `phone call` for applause, or reload the opening and enter `baking bread` to meet the heckler.

The deck has 30 cues over five nights, and every night goes wrong in its own way. The curtain's board carries each act's director's note, and on a night's first act it warns what will go wrong. Stubbs's lines take on the night's mood.

| Night | What goes wrong |
| --- | --- |
| **Opening Night** · the six classics | **Stage fright.** The understudy trembles and sweats until you grab it. |
| **The Prop Cupboard** · a toast, karaoke, an umbrella, a book… | **Catch!** Each act's prop is flung on from the wings and lands on the boards. Pick it up. |
| **Big Feelings** · waving, shrugging, falling in love, a tantrum… | **Feel it.** The card names a mood. Wear that face for the hit and earn a bonus star. |
| **Blackout Matinee** · hitchhiking, a bright idea, covering your ears… | **Lights out.** The hall keeps going dark. Only the actor's eyes glow while the electrician apologises. |
| **Heckler’s Gala** · a rose proposal, a banana phone, a rubber chicken… | **Heckler.** 30-second acts and a man in the balcony shouting wrong answers. |

A night opens once the night before it has had a show with three acts guessed. After the last act, the **curtain call** shows each frozen pose, what Stubbs said, stars for quick hits, your best score and his review of that night. During a game, **Hint** shows how to strike the pose and **Change cue** reopens the deck in free play.

The prop tray, expressions, hand shapes and foot turns share one dressing room beside the stage, so the actor stays in view while you dress it. On a phone the dressing room docks to the bottom of the screen as four tabs: Prop, Face, Hands and Feet.

Try the two phone cues back to back. For a call, tuck the phone against an ear. For a selfie, drag the phone itself high and to one side. The wrist follows, the screen turns toward the actor and its eyes follow the phone. Give the empty hand a peace sign. Nine props (phone, cup, tray, microphone, umbrella, book, rose, banana and a rubber chicken) can all be picked up, carried and passed to the other hand. Ten faces run from Deadpan to Smitten, and each hand has seven shapes, including Point, Thumbs up and Rock on.

![The hanging cue above the actor, with Mr. Stubbs watching from the left front row and Judge Monitor in the right stage wing.](docs/verification/stubbs-delivery/stage-1440.jpg)

[Watch Stubbs guess and the judge print a ruling in a local browser test](docs/verification/stubbs-delivery/stubbs-speaks.gif) · [Six poses made on the stage](docs/verification/six-poses-2026-11-23/six-poses.png) · [Five-second cup and hand take](docs/sandbag-take.gif) · [Watch a foot pull the actor off balance](docs/leg-recoil.gif)

## How the AI booth works

Anyone can pose the actor and guess the opening puzzle. In the signed-in AI game, Mr. Stubbs sends a frozen picture of the actor and prop to DeepSpace’s managed Claude Haiku 5.5. His brief gives him a character, describes the puppet’s anatomy and asks for two lines: a plain guess and one remark in character. It names no cue. After a miss, the next look reminds him which guesses that round were ruled out, as a performer would shake their head. Judge Monitor makes a separate text-only request to Claude Haiku 4.5 at temperature 0 with the cue and the plain guess to check their meaning. With **Stage sound** on, ElevenLabs reads his remark aloud. Each look gets at most one clip, which the server keeps for repeat requests. The server allows five looks per round. This checkout budgets 60 daily looks per signed-in visitor and 240 shared across visitors. Setting STAGE_OWNER_OPEN_REHEARSAL to true removes the daily cap for the verified owner alone. The owner’s observations are accounted separately. A deployment applies this setting to the hosted game. Replay reads the saved guess.

Every model and voice call goes through DeepSpace’s integration proxy: `apiWorkerFetch` to `anthropic/chat-completion` and `elevenlabs/generate-speech` in [stage-provider.ts](src/server/stage-provider.ts). The app holds no provider keys, and the owner’s DeepSpace credits pay. The booth’s routes check the DeepSpace session and turn signed-out visitors away, as the docs ask of anything that triggers a paid call. A SQLite-backed Durable Object ([stage-game.ts](src/server/stage-game.ts)) keeps each player’s round, the daily look counts and the cached voice clips, so replaying a look reads the saved guess and its clip instead of paying again.

The booth keeps its own Durable Object rather than a collection because it decides spending. Every look checks three counters (the round's five, the player's 60 and the house's 240) and writes its receipt in one SQLite transaction before any paid call is made, and it keeps the voice clip. Everything players share lives in DeepSpace collections, described below.

Two integrations, on purpose. Speech-to-text would turn silent charades into a word game, so it stays out. Web search, image generation and email have nothing to add to a guess: the game is a frozen pose, a guesser and a judge. Splitting the guess from the ruling already costs two model calls a look, plus at most one voice clip.

In six independent blind calls on hand-posed frames, Claude Haiku 4.5 recognized the selfie and mistook the phone call for another selfie. It also read the covered eyes as a heavy load. [Six images and original model answers](docs/verification/managed-vision-2026-11-23.json) On the same frames, the shipped brief on Haiku 5.5 named the phone call, the covered eyes (as peekaboo), the surrender and the tray (as a baking dish), and the referee accepted all four. Across the prompt drafts, Haiku 5.5 read the surrender as stretching in 2 of 8 calls. [Every call, answer and cost](docs/verification/stubbs-haiku55-2026-11-23.json) · [Local Worker verification](docs/verification/hosted-stage-local.json)

[Verification and receipts](docs/VERIFICATION.md) · [Implementation guide](docs/Bad_Actors_Codex_Plan.md)

## Racing a friend

Charades is a party game, so the signed-in stage has a third ticket: **Race a friend**. It opens a room with a four-letter code, the way Jackbox and Kahoot rooms work. The code uses consonants only, so it can't spell a word. Two to six signed-in players join by link or code and watch the roster fill in. The host deals, and every stage gets the same cue at the same moment; the curtain is the countdown. While you act, the board shows each rival's progress live, as TypeRacer does ("Stubbs is looking · look 2"). The first player to make Stubbs say the cue wins, with ties going to fewer looks. After the results, the host deals the next round.

The race is built from DeepSpace's own parts:

- **Collections with per-row rules.** `races`, `race_players` and `race_results` ([race-schema.ts](src/schemas/race-schema.ts)) can be read by every signed-in player and written by no browser. Each board is three live `useQuery` subscriptions, so a join, a deal or a finish shows on every stage as soon as the server accepts it.
- **Server actions as the referee.** `raceCreate`, `raceJoin`, `raceStart` and `raceFinish` ([race.ts](src/actions/race.ts)) run with the caller's verified identity. The deal time is the server's clock. A finish counts only when the AI booth's own ledger shows this player's round on this cue, opened after the deal and closed by a correct ruling. The time runs from the deal to the Ready press of the winning look, so a slow model reply costs nobody. A finish claimed from the browser before Stubbs has guessed, or carried over from an earlier game, is refused, and asking twice returns the first time.
- **A presence room per race.** `usePresenceRoom` carries who is online and what each stage is doing. None of it is stored.
- **Best shows that follow the account.** Each signed-in player's best timed show per night lives in `show_bests`, which only its owner can read or write (`read: 'own'`, a server-bound user column and one row per night). Unlocked nights now follow the player to another device.

## How it was built

I built Bad Actors by directing coding agents, and every change went through me. I wrote the first plan, made every product decision, tested every screen and button by hand, and approved every commit and all 16 deploys. Every commit is in my name, and 17 of them also credit Claude as co-author. The agents wrote most of the code and the automated tests.

**Choosing the project.** My first build for this task was a meetup app I called Plan B. I built it, but it was a familiar forms-and-lists app that would have been hard to show: nothing in it a reviewer would remember. On November 23 I set it aside and started Bad Actors. I'd rather change course early than polish an idea that can't show what I can do.

**What I did**
- Wrote the first plan ([the implementation guide](docs/Bad_Actors_Codex_Plan.md)). Codex turned it into the first version of the code, adjusting details along the way.
- Designed the game and its world: a sandbag understudy in a community hall, Mr. Stubbs in the front row and Judge Monitor in the wings. I chose every reference above.
- Grew the game a request at a time. I asked for:
  - nine props, ten faces and seven hand shapes;
  - five nights that each go wrong in their own way;
  - the pit band and the sound effects;
  - characters that breathe and react between lines;
  - the silent demo, the opening curtain and the race.
- Tested every screen, button and flow by hand, on desktop and phone, before approving each deploy, and played the signed-in game on the live site. That is how I found:
  - returning players getting no sound;
  - a silent Safari tab;
  - a cue that was easy to miss;
  - the tutorial glove hidden behind the race ticket.
- Made the calls an agent can't: I picked Stubbs's voice by ear from five ElevenLabs voices and judged the music and sound by ear.
- Compared the build with DeepSpace's example apps. Every one keeps its data in collections and tests with two users, so I proposed racing the same cue, run the way established party games run their rooms.
- Approved every paid model check and kept them small.
- Caught the agents' mistakes. Their first Safari "fix" blamed `connect()`; a sound check I ran in my own Safari disproved that, and the shipped notes were corrected.

**What the agents did**
- Codex wrote the first version of the code from my plan.
- Claude Code wrote most of the later code under my direction, including the hosted AI booth, the race, the art and animation, and the synthesized music and sound. It also wrote the automated tests (227 unit, 44 browser and 12 DeepSpace) and kept [the verification log](docs/VERIFICATION.md).

## Not built, and what I’d do next

- **Races are small and live.** Two to six players, no spectators and no chat, and nothing kept beyond the room. Next I'd add a spectator seat and a weekly table of the fastest time per cue.
- **A party mode.** In charades, friends usually guess each other. The next step is a room where one player poses, the others race Stubbs to guess the frozen pose on their phones, and Judge Monitor rules on every answer.
- **A player who leaves mid-round.** The round waits for everyone's result. If a player closes the tab, the host can deal the next round anyway.
- **Stubbs isn't always right.** In the last real-model check he named 9 of 12 new cues on the first look, and the three misses needed new poses or names. I’d measure all 30 cues the same way.
- **Safari.** A long-open Safari tab once stayed silent with sound on. Two fixes shipped and sound came back, but the root cause is unconfirmed. [The notes](docs/VERIFICATION.md)
- **One pair of ears.** The music and effects are synthesized in code and only I have judged them.

## Run it locally

Use a supported Node 22.15+, 24 or 26 release with npm 11.6+.

```sh
npm ci
npm run practice
```

Open the local URL printed by Vite for the how-to-play demo, the posing controls and the opening puzzle. Without an AI profile the booth stays closed, so the two game tickets don’t appear. The local link http://127.0.0.1:5173/?cue=3 opens the selfie exercise directly. Keyboard players can tab to a handle and use the arrow keys. Hold Shift for larger steps.

For an AI audience on a developer machine, `npm run practice:ai` reads a private profile named by `BAD_ACTORS_AI_PROFILE`: an OpenAI-compatible base URL and key kept outside the repository. It is only a local rehearsal aid. The deployed game talks to DeepSpace’s integrations and nothing else.

Grab any part of the actor on the same stage. Pull a boot sharply upward and let go. The knee folds, the hips shift and the neck catches up. Try the same pull at the shoulder to feel how the weight travels differently. Slow drags let you place a joint precisely. Each hand has its own illustrated row of four shapes. If it is holding a prop, select the shape you want it to take when you put the prop down. Choose **Side-eye** or **Bracing** to see how the same pose reads with a different expression.

To compare the controls, open **How to play → Keyboard & movement → Compare the feel**. Try lifting one hand, bringing the cup to the mouth, and stopping a quick wave in each mode. **Body follow** lets the torso and head settle after the hand stops. **Direct only** keeps the torso still.

```sh
npm run validate
npm run lint
npm run build:practice
npm run test:stage
```

`npm run test:stage` plays the stage in Chromium against the loopback practice server, with every model reply scripted, so it bills nothing.

`npx deepspace test run e2e` runs the smoke, API and two-player specs against the local Worker. The two-player specs need two test accounts (`npx deepspace test accounts list`) and spend no model calls.

Deploy with `npx deepspace deploy`. `STAGE_AI_PROVIDER = "anthropic"` in `wrangler.toml` turns on the hosted booth.

## Design notes

### Where the actor came from

Canvas weights steady lighting stands and scenery. That gave the understudy its job, its lopsided shape and its predicament. The one thing employed to keep a stage steady can barely stay upright. The taped flats and single work light belong to the same community hall. [PRG’s stage weights](https://www.prg.com/-/media/Files/Australia/Stage-Fabrics/Shotbags_and_Sandbags.pdf) · [Theatre Calgary’s guide to *The Play That Goes Wrong*](https://www.theatrecalgary.com/assets/downloads/Play-Guides/The-Play-That-Goes-Wrong_TCPlay-Guide.pdf)

The five-second take gives the actor one ordinary job. Let it finish taking a sip before the other hand flies up. The still cup is how the audience can see the rest of the body struggling. That timing owes something to Jacques Tati’s determined postman and *Octodad*’s attempts at everyday tasks. [Criterion on *Jour de fête*](https://www.criterion.com/films/28114-jour-de-fete) · [Young Horses on *Octodad*](https://blog.playstation.com/?p=130022)

The shoulders react first, the weight lands on a boot and the head finishes a beat late. The eyes and mouth remain quiet enough that the audience can read the effort in the silhouette. [National Theatre’s puppet lesson on weight](https://www.youtube.com/watch?v=vXT3gPef8zo) · [Disney’s guide to follow-through](https://a.dolimg.com/media/en-US/disneyeducationalproductions/noma/pdf/DE1775_NOMA_TG.pdf)

### The printed programme

The title keeps its hand-cut letters. Coral and carmine ink fill BAD, turquoise and petrol blue fill ACTORS, and one amber spray mark catches the falling S. The lettering references New York wall pieces and the layered print marks in the Spider-Verse titles. Sony Pictures Imageworks’ breakdown of the hand-drawn lines in *Into the Spider-Verse* shaped the two short ink strokes a sharp pull leaves behind the moving grip. The lighting keys for Miles’s scenes in *Across the Spider-Verse* informed the stage light. The curtain and cardboard flats share an original image-generated backdrop. The articulated actor and its prop are separate from the scenery for dragging and for clean visual observations. [The Wild Style mural](https://www.mcny.org/event/new-york-film-wild-style) · [Spider-Verse title design](https://www.seojinbang.com/Spider-Man-Into-the-Spider-Verse) · [Pollock’s toy theatres](https://www.pollockstoymuseum.co.uk/post/toy-theatre-and-puppetry/)

Stubbs prints the model's own words in his speech balloon, one letter at a time. The lever on his brass jaw opens with the line and closes on a comma. After the last letter, he punches his ticket or hides behind his programme. The performance works silently. With Stage sound on in the signed-in game, his glove stays up for up to four seconds while his recording arrives, then the letters keep pace with his voice. [A real ElevenLabs line](docs/verification/stubbs-voice-sample.mp3) With reduced motion enabled, the full line appears immediately. [Pixar’s Luxo Jr.](https://www.pixar.com/luxo-jr) · [Jackbox’s Drawful](https://www.jackboxgames.com/games/the-jackbox-party-pack-1/drawful)

Patrick Hand sets the body copy, controls and stage clock. Kalam Bold supplies the programme headings, fly cue, acting notes and Stubbs’s dialogue. Both handwritten fonts and their licenses ship with the game. [Kalam from the Indian Type Foundry](https://github.com/itfoundry/kalam)

### On stage

Bad Actors plays like a draw-and-guess party game with a puppet instead of a pencil. The battle stage of *Paper Mario: The Thousand-Year Door* gave it the front row: you can see who is watching, and the actor’s hands and feet are never hidden behind the seats. *Mystery Science Theater 3000* creator Joel Hodgson describes keeping his front-row silhouettes small enough to leave the movie visible, which set the height of ours. [Nintendo's stage](https://www.nintendo.com/us/whatsnew/join-mario-and-a-cast-of-oddballs-in-one-of-his-strangest-and-epic-est-rpg-adventures/) · [Hodgson on the seats](https://gizmodo.com/creator-joel-hodgson-on-the-return-of-mystery-science-t-1793682355)

*Papers, Please* pointed the referee another way: let the verdict come out of a machine. Judge Monitor, the hall’s old computer, prints its ruling on a little slip. When Stubbs guesses wrong he hides behind his programme, so each of them gets its own laugh. Lucas Pope's account of fitting a physical stamp desk into *Papers, Please* helped shape the slip. Andrew Stanton's account of finding WALL·E's expression in a pair of working binoculars suggested letting the machine's own parts do the acting. [Lucas Pope's illustrated development log](https://dukope.com/devlogs/papers-please/mobile/) · [Stanton's interview](https://freshairarchive.org/segments/animator-director-and-writer-andrew-stanton) · [A compact CRT in the Science Museum collection](https://collection.sciencemuseumgroup.org.uk/objects/co64022/apple-macintosh-personal-computer)

Neither of them sits still between lines. Stubbs breathes, blinks behind brass lids, glances about and, left alone too long, yawns. He sweeps his opera glasses while he looks. A hit makes him hop with happy eyes; a miss leaves him shivering behind the programme with a bead of sweat. On the Big Feelings night a tear runs while he guesses, and at the Gala his eyes keep flicking up to the balcony. Judge Monitor's green face glows behind scanlines and a slow sweep. It blinks and glances, and shows typing dots and an amber light while it weighs a guess. A match makes it beam and sparkle, a miss glitches the screen red, a close call gets a question mark, and a ruling it can't make fills the screen with static. With reduced motion turned on, both keep their expressions but stay still.

Every act starts behind a red house curtain, so the cue fills the whole stage before anyone poses. The stagehands lower it on a board of chasing bulbs as the house lights dim, the follow spot finds the board a beat late and overshoots, and a snare rolls. A notice pasted across the corner reads *Sold out · 1 seat* (the whole house is Stubbs), *Understudy on tonight* or *No refunds*. The curtain then swishes open to a “ta-da” and the board flies back up. Every so often the curtain sticks halfway and a stagehand shouts from the wings until it gives, one more failure in the spirit of *The Play That Goes Wrong*. A click on the curtain, or the player's first move, opens it at once. Stubbs keeps his seat in front of it all, and the act's clock and his first look wait until the curtain is up. With reduced motion the board simply appears and the curtain clears.

The fly loft delivers the cue on a crooked board. One end catches up with the other, then the writing stays still while the player poses. A mismatched bit of rigging gives the gag a physical cause, like the failing scenery in *The Play That Goes Wrong*. Stubbs sits downstage left with a clear view of the performer. His raised glove claims the next line and the balloon tail leads back to him. [Playbill's prop close-ups](https://playbill.com/article/get-up-close-with-the-props-behind-the-mayhem-of-the-play-that-goes-wrong) · [Blambot's illustrated lettering guide](https://blambot.com/pages/comic-book-grammar-tradition)

The cue card takes the idea behind Pixar’s color scripts: its color tells you whose turn it is. It reads warm yellow while the actor has the cue and turns pale green when the opening answer is revealed. The six exercise pictures double as a pose sheet: check the distance from a prop to the face, the line from shoulder to wrist and the actor’s balance. These decisions drew on Pixar’s use of color across story beats, Disney’s Mirabel pose drawings and the way the Hawkeye title artists separated arms and props to make a silhouette legible. [Lou Romano on the Incredibles color script](https://www.moma.org/audio/playlist/192/2575) · [Disney visual development](https://www.disneyanimation.com/process/visual-development/) · [Hawkeye title design interview](https://beforesandafters.com/2022/01/21/how-the-main-titles-of-hawkeye-helped-tell-the-story-of-kate-and-clint/)
