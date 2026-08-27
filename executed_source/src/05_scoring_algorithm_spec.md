# Scoring Algorithm Spec

For each formula below: **Today (simulated)** is the exact code currently running in
`v360_machine_health_demo.html`; **Real-data version (to build)** is what the same function
needs to become once fed by actual capture files instead of hand-picked machine scores.

## Composite (real today, not simulated)

This one is already the real formula — nothing to change here.

```js
function recomputeComposite(){
  var total = weights.color + weights.picture + weights.consistency + weights.speed + weights.correction || 1;
  machines.forEach(function(m){
    m.scores.composite = Math.round(
      (m.scores.color*weights.color + m.scores.picture*weights.picture +
       m.scores.consistency*weights.consistency + m.scores.speed*weights.speed +
       m.scores.correction*weights.correction) / total
    );
  });
}
```
Default weights: `color:30, picture:20, consistency:20, speed:12, correction:18` (adjustable
live via the backend settings sliders; always re-normalized against whatever their current
sum is).

## Color accuracy (`color`)

**Today (simulated) — `stoneColorData(m, stoneIndex)`:** generates a synthetic "ideal" RGB
triplet per stone (seeded off the stone index, deterministic per machine via `strSeed(m.id)`
so results are stable across re-renders, not truly random), then generates a "machine" RGB by
perturbing that ideal by an amount proportional to `(100 - m.scores.color) / 100` — i.e. the
existing hand-picked `color` score drives how far the simulated reading drifts, not the other
way around. Distance is Euclidean RGB (`rgbDist`), converted to L/S/H for display via
`rgbToHsl`.

**Real-data version:** for each stone, read the real captured `R`/`G`/`B` (or the `image`
base64 pixel data directly, sampling a defined diamond-region patch vs. a background-region
patch — see the caution about naive fixed-position cropping below) from the machine's own
`0.json` and from the ideal reference's `0.json` for the *same stone*. Compute the real
Euclidean (or perceptual, e.g. CIE76/CIE94 in Lab space) distance between them. The `color`
score itself is then some normalization of the average distance across all 6 stones onto a
0–100 scale — the exact normalization curve (what distance maps to what score) was not fixed
during this project and needs a decision, likely calibrated against a batch of known-healthy
vs. known-faulty real machines rather than guessed.

## Picture quality (`picture`)

**Today (simulated) — `stoneQualityData(m, stoneIndex)`:** ideal sharpness/contrast are fixed
at `7`/`0` (matching real observed values); machine values drift from those based on
`(100 - m.scores.picture) / 100`, same pattern as color.

**Real-data version:** read the real `sharpness`/`contrast` fields directly from
`currentProfile` in each machine's `0.json` and compare to the ideal reference's — this
requires **no image analysis**, since these are declared camera settings, not measured pixel
properties. This is the cheapest of the 5 metrics to make real.

*A caution recorded during this project, worth repeating here:* true pixel-level sharpness
measurement (as opposed to reading the declared setting) was tested directly against a real
image using Laplacian-variance blur detection. A 30-pixel shift in crop position alone swung
the reading 3×; crop size alone swung it 8×. If a future version of this metric wants to
measure *actual* rendered sharpness rather than the declared setting, the sample region must
be locked to the diamond's real facet edges (detected per image), not a fixed pixel offset —
otherwise the metric measures framing noise, not machine health.

## Consistency (`consistency`)

**Today:** folded into `stoneColorData`'s background-patch drift (`bgDrift`), using the same
seeded-perturbation approach as color, driven by the existing `m.scores.consistency` value.

**Real-data version:** measure how stable the *background* patch reading is, machine vs.
ideal, across all 6 stones — a machine whose background reading swings around from stone to
stone (independent of the diamond's own natural variation) indicates a hardware/environment
stability issue rather than a color-accuracy one. This is the basis for the diagnosis logic's
"diamond-side vs. environment-side" call (see below) — real data would compute the diamond
distance and background distance completely independently per stone from the real pixel data,
rather than the demo's approach of deriving both from two different score inputs.

## Correction load (`correction`)

**Today — `stoneCorrectionData(m, stoneIndex)`:** anchored to a real constant,
`IDEAL_CORRECTION_DIST = 18`, averaged from two real captures' actual `OldRGB`→`NewRGB`
distances (19.05 and 17.32). Machine distance drifts upward from that anchor based on
`(100 - m.scores.correction) / 100`.

**Real-data version:** this is the most directly "already real" of the five — just parse
`OldRGB` and `NewRGB` from the real `0.json` (both are simple `"rgb(r,g,b)"` strings), compute
the Euclidean distance, and that *is* the correction-load reading for that stone. No new
measurement technique needed, unlike color/picture/consistency — only real parsing.

## Speed (`speed`)

**Today:** a flat, hand-picked score per machine (no per-stone simulation function — speed
doesn't get its own stone-level comparison row in the current UI).

**Real-data version:** the real `TotalTime` field (already present in the real JSON, and
already reported in the original "Diamond Settings Record" PDF as avg/fastest/slowest capture
time) compared to the ideal reference's `TotalTime` for the same stone.

## Diagnosis generation (`buildMachineDiagnosis`)

Already real logic, just fed by the simulated per-stone functions above. It:
1. Ranks the 5 sub-metrics, names the weakest and strongest, states the point gap
2. Averages the simulated diamond-distance and background-distance across all 6 stones
   (`avgD`, `avgB`)
3. If `avgB > avgD && avgB >= 5`: reports an **environment-side** issue (background drifting
   more than the diamond reading)
4. Otherwise: reports a **diamond-side** issue, naming the single worst stone by diamond
   distance

This logic needs no change once fed real per-stone distances instead of simulated ones — it's
already written against exactly that shape of input (`stoneColorData(m, i)` returning
`{diamond:{dist}, bg:{dist}}` per stone).

## Recommended-fix generation (`buildRecommendedFix`)

Compares `MACHINE_META_OVERRIDES[m.id]` (today: a hand-authored per-machine dict of which
fields are "wrong" and by how much) against `IDEAL_META`, and names every mismatched field
with its actual vs. expected value. Real-data version: replace the hand-authored override
dict with the actual field-by-field diff between the machine's real `0.json` and the ideal
reference's real `0.json` — the comparison and text-generation logic itself doesn't change.

## Status thresholds

```js
var thresholds = { healthy:80, danger:60 };
function statusFor(v){ return v>=thresholds.healthy?'success':(v>=thresholds.danger?'warning':'danger'); }
```
Currently arbitrary round numbers, adjustable live via the backend settings panel. Real-world
calibration (what score genuinely correlates with "needs a service visit") is not yet
established and would need real audit outcomes to validate against.
