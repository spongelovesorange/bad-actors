# Bad Actors verification

## First rehearsal · November 23, 2026

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

In Chrome at 1280 × 724 CSS pixels, pressing near a palm's edge preserved its position, and moving 20 pixels right and 22 up moved the palm by exactly that amount. With the cup equipped, its rim stayed at the chosen mouth position after release and 350 ms of settling. The page fit horizontally. The [opening stage](../rehearsal.jpg) shows the revised pose. Visual inspection prompted two adjustments: moving the phone outward and down to leave both eyes visible and unfolding the free arm so its sleeve remains visible.

In a 390 × 844 CSS-pixel frame in desktop Chrome, the hand hit areas measured 48 CSS pixels. A mouse drag of 11 pixels right and 19 up moved the palm by those amounts to within 0.01 pixels, with no change in page scroll or horizontal overflow. **Hide cue** removed “Drinking water” from the cue card. **Next cue** kept “Talking on the phone” hidden until **Show cue** was clicked. This check used a mouse at a phone-sized viewport. The isolated Playwright Chromium launcher stopped at macOS process startup, so its automated touch case was not run here.
