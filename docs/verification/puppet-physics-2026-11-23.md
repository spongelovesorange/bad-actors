# Puppet physics timing · November 23, 2026

The comparison starts at `775e06b5dbe3ccadaf75be64a13dc2b1145ad395`. That version already had the sandbag, fixed wrists, damped springs and cloth sleeves. The candidate adds delayed hip weight transfer, poseable joints and expressive features. It shares a projected pose and body transform across the painted parts and the grab targets.

| Local measurement | Before | After |
| --- | ---: | ---: |
| Solve motion and project handles, torso, hips, neck, shoulders, elbows, knees and ankles, median µs per simulated step | 1.041 | 0.924 |
| Solve motion, project controls and serialize the actual actor SVG with production React, median µs per simulated step | 26.30 | 32.42 |
| Sine and cosine evaluations across four complete rig traces | 19,436 | 2,854 |

The numerical stage geometry used 11.2% less time. The nine pass means ranged from 1.035 to 1.099 µs before and 0.916 to 0.953 µs after. Serializing the more detailed SVG took 23.2% more time (24.95–31.45 µs before, 31.94–37.41 µs after). A same-commit control measured 1.085 versus 1.036 µs for geometry and 26.72 versus 26.97 µs for serialization. The timings cover numerical projection and the actor SVG. The timing loop excludes the optional held-contact constraint, interactive hit disks, browser paint, hardware frame rates and heap allocations.

On Apple M4, macOS arm64, Node 22.22.0, the same script ran four gestures. One lifted a free hand with a mug at the lips. The others reversed direction with a plate, dragged the head and waved a free hand while holding a phone. Each trace used 110 timestamps at 1/60 s and included its quiet tail. The two solvers reported active motion on 351 and 351 out of the 440 timestamps respectively. Each measurement used three warm-up batches and nine timed batches in alternating order, with 220,000 steps per geometry batch and 3,520 per SVG batch. A separate untimed pass counted sine and cosine evaluations.

An independent regression placed the waist, chest, head, both shoulders, elbows, knees and ankles at combinations of their limits and turned both boots. Across 64 poses and 7,040 subsequent simulated frames, all joint coordinates stayed finite. Both ankles, both boot angles, the parked wrist and the cup retained their exact positions or angles. [Articulated leg tests](../../src/puppet/legs.test.ts)

A separate contact regression held each of the 11 joint targets through 100 integration steps after a pull. The grabbed shoulder, elbow, waist, chest, neck-tilt, knee or ankle stayed within 0.01 stage units of its accepted position. Other body landmarks displaced by 2.98–29.64 stage units across these gestures. A ten-unit diagonal pull per axis over 44 ms tilted the torso 7.50° from either shoulder, 6.14° from either elbow and 6.82° from either knee. The held wrist and mug remained in place. Zero input at each of the 15 controls left the resting solver asleep. [Contact regressions](../../src/puppet/joint-follow.test.ts)

Run from the repository root with dependencies installed. In a shallow checkout, retrieve the baseline first with `git fetch origin 775e06b5dbe3ccadaf75be64a13dc2b1145ad395`.

```sh
node scripts/bench-puppet.mjs
```

The harness prints every pass result and the SHA-256 digest of each source set. It defaults to the Git baseline above and the current working tree. Two Git revisions or source directories may also be passed explicitly. For this run the baseline source digest was `c9b94e886c648c14423f6cbd5d2dc1d89283fe35ec4301f56ce5a81f6c3e3fe4` and the candidate digest was `b990af364a31f213d39fd90b07ae2270638b137eaf9786eafeca8f9e826ba93a`.
