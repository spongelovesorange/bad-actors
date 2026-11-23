# Bad Actors verification

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

[Watch the foot pull](leg-recoil.gif) · [Geometry and rendering benchmark](verification/puppet-physics-2026-11-23.md)

The local Chrome check exercised all 14 body targets and both held and loose prop drags on the single stage. It delivered pointer events to the page and tracked the actual painted shoulder and cheek after release. All 16 gestures acquired the intended target and settled. The largest measured grip error across the set was 0.582 stage units. On this desktop, a quick pull on the left and right shoulders respectively moved a painted landmark by 24.9 and 22.4 CSS pixels. The corresponding displacements were 33.9 and 35.5 pixels for the elbows and 18.4 and 15.6 for the knees. Separate native mouse drags confirmed pointer capture and release on a foot, wrist and elbow. [Per-target browser measurements](verification/all-joint-recoil-2026-11-23.json)

At the same left-knee travel of approximately 15 stage units, deliberate placement moved the tracked landmarks by 0.00 CSS pixels after release. A flick moved one by 18.4 pixels. Selecting **Direct only** in Help also produced 0.00 pixels of secondary movement on a full foot drag. In the 3.20-second foot-pull clip the right boot rose across the body, the torso tilted 16°, the hips moved 22.82 stage units and the other boot stayed planted. The GIF contains 80 frames at 740 × 404.

In a fresh local Chrome page, a page-level `matchMedia` override supplied `prefers-reduced-motion: reduce`. The foot drag again produced 0.00 pixels of secondary shoulder or cheek movement. This exercises the preference branch in the app. The operating system preference itself was not toggled.

TypeScript, ESLint, all 69 unit tests and the practice build passed. The resulting `index-DlIzX99K.js` has SHA-256 `bf85455e67c5259263c6b8c5acb8eef46b39bb156cff70bf9ff9a769ea170fa7`. Playwright discovered 34 cases. Its bundled Chromium could not start in the local macOS sandbox, so this run has no Playwright pass count. The browser measurements above used a separate local Chrome session. Physical-phone handling is still unverified.

## Sandbag playtest revision · November 23, 2026 (7264d7b)

The player reported that the original torso stood still when they flicked an empty hand and that the mug covered the actor’s face. We repeated their gesture in the local rehearsal. During visual review the sandbag’s resting arms still looked like hands on hips, so we lowered the untouched wrists and let each sleeve sag. The final take starts with an empty sleeve hanging beside the bag.

[Five-second take](sandbag-take.gif) · [Four poses made on stage](poses.jpg) · [Rehearsal screen](rehearsal.jpg)

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
