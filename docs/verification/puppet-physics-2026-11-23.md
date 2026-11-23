# Puppet physics timing · November 23, 2026

The comparison starts at `775e06b5dbe3ccadaf75be64a13dc2b1145ad395`. That version already had the sandbag, fixed wrists, damped springs and cloth sleeves. The candidate adds delayed hip weight transfer, poseable joints and expressive features. It shares a projected pose and body transform across the painted parts and the grab targets.

| Local measurement | Before | After |
| --- | ---: | ---: |
| Solve motion and project handles, torso, hips, neck, shoulders, elbows, knees and ankles, median µs per simulated step | 1.018 | 0.880 |
| Solve motion, project controls and serialize the actual actor SVG with production React, median µs per simulated step | 25.22 | 31.29 |
| Sine and cosine evaluations across four complete rig traces | 19,436 | 2,846 |

The numerical stage geometry used 13.5% less time. The nine pass means ranged from 1.014 to 1.147 µs before and 0.864 to 0.978 µs after. Serializing the more detailed SVG took 24.1% more time (25.00–27.48 µs before, 30.86–32.01 µs after). A same-commit control measured 1.085 versus 1.036 µs for geometry and 26.72 versus 26.97 µs for serialization. The timings cover numerical projection and the actor SVG. The interactive hit disks, browser paint, hardware frame rates and heap allocations were outside the timing loop.

On Apple M4, macOS arm64, Node 22.22.0, the same script ran four gestures. One lifted a free hand with a mug at the lips. The others reversed direction with a plate, dragged the head and waved a free hand while holding a phone. Each trace used 110 timestamps at 1/60 s and included its quiet tail. The two solvers reported active motion on 351 and 347 out of the 440 timestamps respectively. Each measurement used three warm-up batches and nine timed batches in alternating order, with 220,000 steps per geometry batch and 3,520 per SVG batch. A separate untimed pass counted sine and cosine evaluations.

An independent regression placed the waist, chest, head, both shoulders, elbows, knees and ankles at combinations of their limits and turned both boots. Across 64 poses and 7,040 subsequent simulated frames, all joint coordinates stayed finite. Both ankles, both boot angles, the parked wrist and the cup retained their exact positions or angles. [Articulated leg tests](../../src/puppet/legs.test.ts)

Run from the repository root with dependencies installed. In a shallow checkout, retrieve the baseline first with `git fetch origin 775e06b5dbe3ccadaf75be64a13dc2b1145ad395`.

```sh
node scripts/bench-puppet.mjs
```

The harness prints every pass result and the SHA-256 digest of each source set. It defaults to the Git baseline above and the current working tree. Two Git revisions or source directories may also be passed explicitly. For this run the baseline source digest was `c9b94e886c648c14423f6cbd5d2dc1d89283fe35ec4301f56ce5a81f6c3e3fe4` and the candidate digest was `2bb4ee2d88fd3a8f7fdc84f8d571666ce1c74f05a327cae7fd4dac5d42e13dcf`.
