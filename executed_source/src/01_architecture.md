# Architecture

## The audit scenario

Six **master diamonds** are the constant of the whole system — the same six physical stones
travel through every capture tier below. Each master stone is identified as `D-1` through `D-6`.

Four capture tiers exist for a given audit:

1. **Customer fleet** — the customer's own machines (Harikrishna Export's is 14 units), all on
   the current-generation hardware (B2B mini 4.0), each scanning the same 6 master stones. This
   is the "as-is" state — one dataset per machine.
2. **V360 ideal reference** — a freshly calibrated B2B mini 4.0 at V360's own office, scanning
   the same 6 stones. This is the yardstick a healthy 4.0 unit should hit. Tier 1 vs. tier 2,
   stone by stone, is a health/drift diagnosis — not a sales pitch.
3. **V360 5.0 reference** — next-generation hardware, same 6 stones. The "what upgrading gets
   you" preview.
4. **V360 5.0 EDF reference** — 5.0 hardware with Enhanced (Depth-of-)Focus, same 6 stones — a
   genuinely different *capture process* (multiple focus levels captured and merged into one
   sharp video), not just a calibration difference. This matters for scoring: an EDF comparison
   answers "what capability does upgrading unlock," not "is this machine mis-calibrated," and
   the Report keeps that distinction explicit (see `03_output_report_spec.md`, "upgrade band").

## End-to-end data flow

```
Salesperson
    │
    ▼
Report Generator  (input_tool_template.html)
  • customer & report info (name, prepared-by, date, optional contact/location)
  • 4 folder selections: ideal (required), customer machines (required),
    5.0 (optional), 5.0 EDF (optional)
  • real in-browser folder read (File API, webkitdirectory) — detects which
    master stones and which machines are actually present
    │
    ▼
manifest.json  (schema in 04_data_model_and_capture_schema.md)
    │
    ▼
[NOT YET BUILT] — Capture Processing Pipeline
  • for every (machine, stone) pair found in the manifest, read the real
    capture JSON (schema in 04) and the real still.jpg / video.mp4
  • compute the 6 scores per machine using the formulas in
    05_scoring_algorithm_spec.md, instead of the demo's simulated values
  • emit a `machines` array in the exact shape the Report already consumes
    │
    ▼
Machine Health Report  (v360_machine_health_demo.html)
  • fleet summary, ranking, per-machine drill-down, per-stone comparison,
    diagnosis, recommended fixes — all already built against this exact
    data shape, just currently fed by hand-picked sample data instead of
    the pipeline above
```

The Report's own `machines` array (see `03_output_report_spec.md`) is the contract the
pipeline needs to produce. Nothing about the Report's rendering, scoring-weight system,
diagnosis generation, or bilingual layer needs to change to accept real data — it already
consumes a plain array of `{id, scores: {composite, color, picture, consistency, correction,
speed}}` objects, plus per-stone functions (`stoneColorData`, `stoneQualityData`,
`stoneCorrectionData`) that currently generate their numbers from a seeded pseudo-random
function and would instead read real values.

## Folder naming conventions

Two conventions were confirmed to matter, and the Generator's detection logic (tested against
both, see `02_input_tool_spec.md`) handles either one without configuration:

**Flat** — matches the real sample file provided during this project (`D-1-11.zip`, i.e.
stone `D-1`, machine `11`):
```
<selected folder>/D-1-01/still.jpg, 0.json, ...
<selected folder>/D-2-01/...
...
<selected folder>/D-6-14/...
```
Stone number and machine number are both encoded in one folder name: `D-<stone>-<machine>`.

**Nested** — a per-machine parent folder, each containing its own D-1..D-6 subfolders:
```
<selected folder>/Machine 01/D-1/still.jpg, 0.json, ...
<selected folder>/Machine 01/D-2/...
...
<selected folder>/Machine 14/D-6/...
```

The real Google Drive folder structure the customer described (`Scan b2b mini 4.0 by Client`,
`scan b2b mini 4.0 by v360`, `Scan b2b mini 5.0 by v360`) was never fetched during this project
by explicit instruction (customer data wasn't yet available), so which convention it actually
uses is not confirmed — hence detecting both rather than assuming one.

## Per-capture file set

Every individual (stone, machine) capture — confirmed from real sample files — contains:

- `still.jpg` — a representative static photo
- `video.mp4` — the full rotation video
- `0.json` through `7.json` — numbered files where `0.json` holds one full capture record
  (see schema in `04_data_model_and_capture_schema.md`) and `1.json`–`7.json` hold
  progressively larger frame arrays (4, 4, 8, 16, 32, 64, 128 frames) for the 360° viewer
- `sm.json` — a thumbnail-strip array for the viewer's scrub bar

Only `0.json` (and its counterpart in the numbered sequence) carries the structured metadata
the scoring pipeline needs — camera settings, RGB values, the correction pair. The Generator's
current detection only looks for `still.jpg` (for thumbnails) and the `D-<n>` folder pattern;
the processing pipeline is what will need to actually parse `0.json`.
