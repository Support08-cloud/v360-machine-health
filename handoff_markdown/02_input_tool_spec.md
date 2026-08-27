# Input Tool Spec — Report Generator

Reference implementation: `reference_implementation/v360_report_generator.html`.
Standalone HTML, no build step, no server. Runs in any Chromium-based browser (folder
selection depends on the non-standard but widely-supported `webkitdirectory` input
attribute — see "Browser support" below).

## Flow: three steps, gated

```
[1. Customer info] ──▶ [2. Select folders] ──▶ [3. Review & generate]
```

The stepper at the top is clickable in both directions once a step has been visited, but
step 3 is not reachable until step 2's two required folders both detect at least one stone
(`updateNextButton()` enables/disables `#toStep3` based on this).

## Step 1 — Customer & report info

| Field | Required | Notes |
|---|---|---|
| Customer / company name | No (not enforced, but expected) | e.g. "Harikrishna Export" |
| Prepared by | No | defaults to `"V360"` |
| Report date | No | defaults to today (`toISOString().slice(0,10)`) |
| Contact person | Optional | explicitly labeled optional in the UI |
| Location | Optional | explicitly labeled optional in the UI |

**The rule that matters:** a field left blank is *omitted*, not shown empty. This is
enforced in `buildReview()` — each field is only added to the review HTML if
`f[1] && f[1].trim() !== ''` — and carried through into `manifest.json`, where
`buildReview`'s sibling logic in the generate handler only writes a key into
`manifest.customer` if the field has a non-empty value. There is no `null` or `"N/A"`
anywhere in the output; a skipped field simply isn't a key.

## Step 2 — Select folders

Four folder rows, each an independent `<input type="file" webkitdirectory directory
multiple>` wired to its own `change` handler:

| Row | Required | Element IDs |
|---|---|---|
| Ideal reference (same generation) | Yes | `#idealInput` / `#idealPath` / `#idealDetection` |
| Customer machines | Yes | `#custInput` / `#custPath` / `#custDetection` |
| Upgrade comparison — 5.0 | No | `#v50Input` / `#v50Path` / `#v50Detection` |
| Upgrade comparison — 5.0 EDF | No | `#v50edfInput` / `#v50edfPath` / `#v50edfDetection` |

### Detection logic

Two functions, both pure (take a list of relative path strings, return structured results —
no DOM access, easy to unit test in isolation):

**`detectStonesFromPaths(paths)`** — used for the single-folder rows (ideal, 5.0, 5.0 EDF).
Regex: `/D-([1-6])(?:[\/\-]|$)/` matches a `D-` followed by a digit 1–6, followed by either
a path separator, a hyphen, or end-of-string — this is what lets it match both `D-3/still.jpg`
(nested) and `D-3-01/still.jpg` (flat) with the same pattern. Also collects the first
`still.jpg`/`.jpeg`/`.png` found per stone number as a thumbnail candidate.

Returns `{ stones: ['1','2','3'...], thumbPaths: {'1': 'path/to/still.jpg', ...} }` — sorted
numerically, and **only** the stones actually found. A folder with 4 of 6 stones reports
exactly 4, never rounds up.

**`detectMachinesFromPaths(paths)`** — used for the customer-machines row, which must handle
multiple machines. It decides which naming convention applies *before* grouping, rather than
trying one and falling back — this matters because trying "nested" first against flat-style
input silently misgroups it (see the note below on a real bug this caused during development).

The decision: collect every distinct first-level folder name across all paths, and check with
`/^D-\d+-/` whether *all* of them look like flat-style stone folders. If so, group by the
machine ID captured from `/D-([1-6])-(\w+)/` (group 2). If not, group by the first-level
folder name directly, explicitly skipping any top-level name that itself matches `/^D-\d/`
(a defensive check against mixed/unexpected input).

Returns `{ machines: [{name, stones, thumbPaths}, ...], pattern: 'flat'|'nested'|'none' }`.

> **A real bug found and fixed during testing:** the first version of this function tried
> the nested-grouping logic unconditionally and used its result if non-empty. Against a flat
> folder (`D-1-01`, `D-2-01`, ... `D-6-14`), every stone-folder name got treated as its own
> one-stone "machine," producing 84 fake machines instead of 14 real ones. Fixed by
> determining the convention up front (as described above) rather than trying one and hoping.
> Confirmed correct afterward against both conventions, including a pixel-level check that
> multiple machines sharing identical `D-1`..`D-6` folder names never cross-contaminate
> thumbnails (each machine's files are always addressed by full path, never by the bare
> stone number alone).

### Thumbnails are real files, not placeholders

`renderMachineDetection()` matches each detected `thumbPaths[stone]` entry back to its actual
`File` object (`Array.prototype.filter` on `f.webkitRelativePath === relPath`), then calls
`URL.createObjectURL(fileObj)` to get a real, browser-native blob URL — the `<img>` tags in
the machine grid show the customer's actual `still.jpg` files, decoded and rendered by the
browser, not a mockup graphic.

### Detection panel states

Three states, each with distinct styling (`.detection-ok` / `.detection-warn` /
`.detection-bad`):
- **6 of 6 found** — green, "✓ 6 of 6 master stones detected (D-1 – D-6)"
- **1–5 of 6 found** — amber, names the specific missing stones (e.g. "missing D-5, D-6")
- **0 found** — red, "No recognizable D-1..D-6 stone folders found in this selection"

For the customer-machines row specifically, an additional per-machine grid shows each
detected machine's own completeness (`X/6 stones`) and its own thumbnail strip, so a
salesperson can see at a glance which specific machines have incomplete captures before
generating anything.

## Step 3 — Review & generate

`buildReview()` renders two summary blocks (customer fields, folder detections — both using
the same "only show what's filled" rule), then `#generateBtn` builds the manifest object and
displays it as formatted JSON in `#manifestPre`, with a working "Download manifest.json"
button (`Blob` + `URL.createObjectURL` + a synthetic `<a download>` click).

## `manifest.json` output shape

See the full schema with field-by-field notes in `04_data_model_and_capture_schema.md`. In
brief: a `customer` object (only the fields actually filled in), a `generatedAt` ISO
timestamp, and a `folders` object keyed `ideal`/`cust`/`v50`/`v50edf`, each holding the
detected root folder name and stone list (and for `cust` specifically, the full per-machine
breakdown and which naming pattern was detected).

## Browser support / known limitation

`webkitdirectory` is supported in Chromium-based browsers (Chrome, Edge, Opera, Brave) and in
current Firefox. It is **not** a native folder-access API — it's a directory-mode file input;
the browser reads the file list once at selection time, there's no live filesystem watching,
and there's no way to write back into the selected folder. For a desktop-installed version of
this tool (rather than a browser tab), the equivalent would be a native folder-picker dialog
(Electron, or a local Python/Flask backend serving the same HTML with a real filesystem API)
— worth flagging since the original ask was "Windows and Mac both compatible."
