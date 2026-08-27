# Output Report Spec — Machine Health Report

Reference implementation: `reference_implementation/v360_machine_health_demo.html`.
Standalone HTML, self-contained (fonts via Google Fonts CDN link, everything else inline),
no server, no build step, no external JS dependencies. Persists user choices to
`localStorage` (see "Save & persistence" below); degrades gracefully to session-only if
storage is unavailable.

## Data contract: the `machines` array

Everything downstream renders from one array:

```js
var machines = [
  { id:'Machine 01', scores:{ composite:91, color:94, consistency:90, speed:88, picture:90, correction:88 } },
  // ...
];
```

`composite` is **not** an independent input — it's recomputed live by `recomputeComposite()`
as a weighted average of the other five (weights below), so a real pipeline only needs to
supply `color`, `picture`, `consistency`, `speed`, `correction` per machine; composite follows.

A parallel `stones` array (`[{id:'D-1', shape:'Round'}, ... 'D-6','Radiant']`) is fixed —
six entries, real shape labels for five of them are illustrative (only `D-4` = Princess was
confirmed against a real reference photo shown during this project; the rest are invented for
demo variety, flagged here so they aren't mistaken for confirmed fact).

## The six metrics, and where each comes from

| Key | Label (en) | Real-world basis |
|---|---|---|
| `color` | Color accuracy | RGB/L,S,H distance between this machine's diamond reading and the ideal reference's, for the same stone |
| `picture` | Picture quality | Sharpness + contrast camera-setting match to the ideal reference (real fields: `Sharpness`, `Contrast` in the actual capture JSON) |
| `consistency` | Consistency | How stable this machine's background-patch reading is across the 6 stones, relative to the ideal |
| `correction` | Correction load | Magnitude of the `OldRGB → NewRGB` correction the machine's own software applied at capture time — a real field, anchored to real observed values (~17–19 distance units in two actual sample captures) |
| `speed` | Speed | Capture time vs. the ideal reference's capture time (the original "Diamond Settings Record" PDF already reports avg/fastest/slowest capture time per machine) |
| `composite` | Composite | Weighted average of the five above |

Full formulas — including what's simulated today vs. what a real pipeline computes — are in
`05_scoring_algorithm_spec.md`.

## Composite weighting (backend scoring settings)

```js
var weights = { color:30, picture:20, consistency:20, speed:12, correction:18 };
var thresholds = { healthy:80, danger:60 };
```

Adjustable live via five sliders in a collapsible "Scoring settings" panel (marked with a
`backend` tag in the UI — explicitly not meant for a salesperson to touch mid-demo).
`recomputeComposite()` normalizes whatever the five slider values currently are (they don't
need to sum to 100 — the hint text shows the normalized percentages). Two number inputs set
the health/danger score thresholds that `statusFor(v)` uses everywhere status color and
labels are derived.

## Sections, top to bottom

### Header
Logo (real SVG, swapped between a black and white variant per theme via a data-attribute —
see "brand assets" below), page title, customer/date subtitle, a demo-data tag, and four
header actions: language toggle, "Report settings" (opens the style+audience picker),
backend scoring settings toggle, light/dark theme toggle.

### Report settings picker (`#stylePicker`)
Opened via the "Report settings" header button; hidden by default (Modern Clean shows
immediately on load — no forced choice up front). Contains, top to bottom:
- **Audience** — 3 preset buttons (Manufacturer / Salesperson / Engineer)
- **What's visible** — 5 independent checkboxes the preset fills in but does not lock:
  stone-level tables, technical metadata section, metadata-starts-expanded, upgrade-path
  section, backend settings button visibility
- **Style** — 4 visual-theme swatches, each a live-rendered miniature of a real fleet card
  under that theme (not a screenshot)

See "Audience system" and "Style system" below for what each control actually does.

### Executive summary (`#summarySection`)
Fleet-wide average for whichever metric tab is active, delta-from-ideal, a healthy/warning/danger
count breakdown, a sorted ranking list (best to worst, with a marker line at the fleet average and
a delta-from-fleet-average per row), and an auto-generated conclusion paragraph — all recomputed
live on every metric-tab switch or backend-setting change.

### Fleet grid (`#fleetGrid`)
One card per machine: status badge, big score number with delta, a 6-dot mini stone-status
strip. Click any card to open that machine's detail view. The shared metric-tab row (Composite
/ Color accuracy / Picture quality / Consistency / Speed / Correction load) drives both the
summary and this grid simultaneously.

### Machine detail view (`#detailView`)
- Header: machine id, status badge, delta
- **Diagnosis box** — a paragraph (`buildMachineDiagnosis`) naming the weakest of the 5
  sub-metrics and whether the pattern across the 6 stones points at a diamond-side or an
  environment-side (lighting/backdrop) issue, plus a second line (`buildRecommendedFix`) —
  a concrete instruction naming the exact mismatched setting(s) and what they should be
- Per-stone rows, each with: visual compare (thumbnail/full-video toggle, currently
  placeholder chips pending real image wiring), a combined color-table (diamond RGB/L,S,H,
  background RGB/L,S,H, sharpness, contrast, correction-needed — each with a machine-vs-ideal
  value and a verdict), the "what an upgrade unlocks" band (5.0 / 5.0 EDF preview, visually
  dimmed in Engineer mode since it's the least relevant section there), and a per-stone
  "show technical metadata" toggle

### Technical metadata (per stone)
A full raw-settings comparison, grouped exactly the way V360's own real settings PDF groups
them: Capture settings, Frame/image settings, Lighting/tone settings, Machine/software,
Profile. Only fields that differ from the ideal reference are flagged (a colored dot marker);
matching fields render quietly. Full field/value spec in `04_data_model_and_capture_schema.md`.

## Audience system

Three presets (`AUDIENCE_PRESETS`), each just a set of defaults for the 5 visibility
checkboxes plus a default compare-mode — **nothing is ever hard-hidden by audience alone**;
every checkbox stays independently adjustable after picking a preset, and the choice
(style + audience + all 5 checkboxes) is what gets saved together.

```js
manufacturer: { stoneTables:true, metadata:false, metadataOpen:false, upgradeBand:true, backendSettings:true, compareMode:'thumb' }
salesperson:  { stoneTables:true, metadata:true,  metadataOpen:false, upgradeBand:true, backendSettings:true, compareMode:'thumb' }
engineer:     { stoneTables:true, metadata:true,  metadataOpen:true,  upgradeBand:true, backendSettings:true, compareMode:'full'  }
```

## Style system

Four visual themes, selected via `data-report-theme` on `<html>`: `modern` (default — no
override block needed, falls through to base tokens), `instrument` (dark, monospace,
scan-line background, bracket-corner cards, pulsing status LED), `facet` (cream background,
clipped-polygon card corners, score shown in a rotated diamond badge), `specsheet` (hairline
rules, no card radius/shadow, reference codes, spine-rule left border). Each theme is a CSS
variable override block plus a handful of structural rules targeting shared class names
(`.m-card`, `.badge`, etc.) — **not** a parallel DOM structure, which is what makes adding a
fifth theme cheap: new variable values plus whatever structural touches make it distinctive.

Separately, `[data-theme="light"|"dark"]` controls the light/dark mode toggle — orthogonal to
report style, session-only (not part of the saved settings payload).

## Save & persistence

`localStorage` key `v360_report_settings`, written only on explicit action (the "Save
settings" button, or picking a style via "Use this style" — both call `saveSettings()`), never
silently. `saveSettings()` performs a real round-trip check (write, then read back, compare)
before reporting success — a `try/catch` alone isn't sufficient on every browser, since some
environments no-op silently rather than throwing. On load, `loadSettings()` restores theme,
audience, visibility, and language if present; otherwise the hard-coded defaults apply.

## Localization

Full spec in `07_localization_spec.md`. In brief: a `LANG.en` / `LANG.gu` dictionary, a `t(key)`
lookup with English fallback, `data-i18n="key"` tags on static elements plus explicit `t()`
calls inside every generated-text function (diagnosis, recommended-fix, conclusion, verdict
words) — nothing is translated by guessing at runtime; every string is an explicit key.

## Brand assets

Real V360 logo SVGs (from the brand guideline package's `03_Logo_Library`), one Black variant
for light theme and one White variant for dark theme, both inlined directly into the HTML.
**Important implementation note:** both SVGs originally used the same internal shorthand style
class names (`.fil0`, `.fil1`, etc.) with different colors — sitting both in one document meant
the browser kept only the last-declared definition, so the light-theme logo silently inherited
the dark logo's white fill. Fixed by scoping each logo's internal styles under its own unique
`id` before embedding. Anyone re-generating these HTML files from the raw brand-package SVGs
needs to repeat this scoping step, or the same bug reappears.
