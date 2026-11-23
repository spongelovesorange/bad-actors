# Managed integration preflight

On November 23, 2026 at 17:07 EST, DeepSpace CLI 0.44.2 returned an input schema and billing information for each endpoint below. The discovery commands incurred no provider charges.

| Endpoint | Input prepared or accepted by the catalog | Catalog output and pricing | Provider acceptance |
| --- | --- | --- | --- |
| `anthropic/chat-completion` | Two 240 × 144 PNGs, raw base64 in Anthropic Messages image blocks. Both requests use `claude-haiku-4-5`, temperature 0, a 120-token output ceiling and the same prompt. | Metered, per actual cost. The catalog does not specify a fixed per-image price. | Both genuine calls correctly described the color, shape and reversed position at 17:11 EST. |
| `elevenlabs/generate-speech` | “Drinking water.”, 15 characters. Flash v2.5, 44.1 kHz MP3 at 64 kbps. | The schema returns `audioUrl` as a data URL. Quoted base per character is USD 0.0002 on the free tier or USD 0.000065 on a paid tier, subject to input and actual billing. | Pending an actual generated clip and successful browser playback. |
| `speech/speech-to-text` | Base64 audio with `language: en`. The catalog accepts `whisper-1`; browser container/codec acceptance requires a real recording. | The schema includes text, provider usage when available, and an optional billed cost in USD. | Pending a short, deliberately recorded human answer and a real transcription. |

At 17:08 EST the initial owner check reported `credential_unwritable`. At 17:10 EST the developer identity was verified, but new app registration returned `app_quota_exceeded` and issued no app ID. The CLI's integration command bills the signed-in developer and sends no app ID, so the two approved vision probes could run independently of registration. The developer paused both voice acceptance tests. Zero voice requests were sent.

## Live vision results

On November 23 at 17:11 EST the CLI sent each prepared request once. The provider returned model version `claude-haiku-4-5-20251001`. The elapsed times include CLI startup and the entire round trip. Both requests ended normally with `end_turn`.

| Fixture | Actual response | Elapsed | Input / output tokens | Reported USD |
| --- | --- | ---: | ---: | ---: |
| A | “A red circle is positioned on the left side, while a blue square is positioned on the right side of the image.” | 8.061 s | 80 / 27 | 0.000215 |
| B | “A blue square is positioned on the left side, while a red circle is located on the right side of the image.” | 4.592 s | 80 / 27 | 0.000215 |

**Total reported cost was USD 0.000430.** These results establish image-dependent output through the developer CLI. Recognizing a human player's pose, in-game timing and acceptance through a deployed server action still require independent tests.

## Offline probe evidence

Run `python3 scripts/prepare-vision-probes.py` to recreate the ignored `.local/` fixtures. Both request bodies have identical metadata after removing the image bytes. An independent PNG decode verified their dimensions, different pixel positions, and that each request carries exactly its corresponding file's bytes.

| Fixture | Image SHA-256 | Expected relation for the verifier |
| --- | --- | --- |
| A | `443fcfed3ca4c664513475b1d24380a8200ec4d24659e1c7fd97d67a58bf07da` | Red circle to the left of the blue square |
| B | `ef6f4313fb4a08f4290218a598379d8245a3f36b12c78a4cdebc089db93655d2` | Red circle to the right of the blue square |

The single prompt asks for a short description of visible objects and their relative positions. It omits shape names, colors, filenames and the expected answers. Both descriptions must correctly distinguish the images. The [Evenly reference](https://github.com/deepdotspace/evenly/blob/033d6b875d4a972fa77e37a04c26a7dea21fdf75/src/actions/receipts.ts) uses this Messages image-block format. [DeepSpace integration and billing documentation](https://docs.deep.space/guides/external-apis)
