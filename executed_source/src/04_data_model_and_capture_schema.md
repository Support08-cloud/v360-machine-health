# Data Model & Capture Schema

Two schemas matter here: the **real V360 capture JSON** (confirmed from actual sample files
reviewed during this project — two real captures inspected directly, field by field), and the
**manifest.json** the Generator produces. The processing pipeline (not yet built, see
`08_current_state_and_next_steps.md`) is what reads both and produces the `machines` array
the Report consumes.

## Real V360 capture JSON (`0.json`, per stone per machine)

Confirmed structure, both top-level and the nested `visionProfile` object:

```json
{
  "image": "<base64 JPEG>",
  "remarks": "...",
  "quality": 4,
  "height": 595, "width": 758,
  "version": 1,
  "softwareVersion": "5.0.0.91",
  "createdDate": "2025-12-09T03:43:00Z",
  "machineKey": "1121M048",
  "MachineName": "Vision360",
  "ImageQuality": 100,
  "OldRGB": "rgb(170,170,170)",
  "NewRGB": "rgb(159,159,159)",
  "MinInputLevel": 0, "MaxInputLevel": 255,
  "MinOutputLevel": 0, "MaxOutputLevel": 255,
  "Gamma": 0,
  "Camera": "Canon EOS 6D Mark II",
  "CameraSerialNo": "...",
  "LensName": "EF100mm f/2.8L Macro IS USM",
  "StartTime": "10:03:15", "StopTime": "10:04:13", "TotalTime": "00:00:58",
  "visionProfile": {
    "currentProfile": {
      "quality": "Ideal", "AV": 9, "TV": "1/60", "ISO": "ISO250", "WB": "Auto", "K": 5200,
      "sharpness": 7, "contrast": 0, "saturation": 0, "colorTone": 0,
      "lightName": "VISION-B", "lightTrackValue": "100,100,105,0,0,0,0,0",
      "stoneType": "V360", "crop": 4, "pictureStyle": "Auto",
      "colorRGB": "1,3,2", "width": 758, "height": 600,
      "R": 175, "G": 174, "B": 179, "tolerance": 0,
      "isFreeze": false, "version": 1,
      "hostName": "VIDEOPC-1", "machineName": "Vision360", "machineNumber": "0",
      "cameraAppVersion": "4.0.0.43",
      "OldRGB": "rgb(170,170,170)", "NewRGB": "rgb(159,159,159)"
    },
    "lockedProfile": { "...": "same shape as currentProfile" }
  }
}
```

**`currentProfile` vs `lockedProfile`:** `lockedProfile` is the saved/expected settings profile
for that machine's session; `currentProfile` is the actual live settings at the moment of this
specific capture. In the two real samples inspected, these were close but not always identical
(e.g. differing `TV`, `crop`, `width`/`height`, `lightTrackValue`) — the gap between them is
itself a signal worth considering for a future metric, not currently scored.

**`OldRGB` → `NewRGB`:** the raw pre-correction reading and the software's own auto-corrected
result. This is the real basis for the `correction` score (see `05_scoring_algorithm_spec.md`)
— in the two real samples, the correction distance was 19.05 and 17.32 respectively, which is
why the demo's simulated ideal-reference correction distance is anchored at `18` rather than
an arbitrary round number.

**`sm.json` and frames `1.json`–`7.json`:** arrays of base64 image strings at progressively
larger counts (4, 4, 8, 16, 32, 64, 128) for the 360° viewer's scrub bar and rotation frames.
No structured metadata in these — only `0.json` carries the fields above. Note: some entries
in `sm.json` were observed to be non-image placeholder strings rather than valid JPEG data in
the samples inspected; a real parser should validate/skip non-image entries defensively rather
than assume every array entry decodes.

## The mapping from real fields to the Report's `IDEAL_META` structure

The Report's technical-metadata comparison (`03_output_report_spec.md`) groups fields exactly
as V360's own real settings PDF groups them, and the field names match the real JSON above
one-to-one:

| Report group | Real JSON fields |
|---|---|
| Capture settings | `AV`, `TV`, `ISO`, `K`, `WB`, `pictureStyle`, `quality`, `sharpness`, `contrast`, `saturation`, `colorTone` |
| Frame / image settings | `width`, `height`, `ImageQuality` |
| Lighting / tone settings | `Gamma`, `MinInputLevel`, `MaxInputLevel`, `MinOutputLevel`, `MaxOutputLevel`, `tolerance` |
| Machine / software | `Camera`, `cameraAppVersion`, `MachineName`, `stoneType`, `isFreeze` |
| Profile | `lightName` (shown in the Report as `VisionProfile`) |

The demo's `IDEAL_META` object hard-codes one representative "healthy" value per field (e.g.
`AV: 9`, `Sharpness: 7`, `Contrast: 0`) drawn from the real samples inspected; a real pipeline
would instead read the actual ideal-reference folder's `0.json` for each stone and use those
real values directly, rather than one hard-coded set shared across all 6 stones.

## `manifest.json` (Generator output)

```json
{
  "customer": {
    "name": "Harikrishna Export",
    "preparedBy": "V360",
    "reportDate": "2026-08-22",
    "contactPerson": "Ramesh Patel"
  },
  "generatedAt": "2026-08-22T16:45:27.149Z",
  "folders": {
    "ideal":   { "rootName": "IdealRef", "stonesDetected": ["1","2","3","4","5","6"] },
    "cust":    {
      "rootName": "CustomerScans",
      "pattern": "flat",
      "machines": [
        { "name": "Machine 01", "stonesDetected": ["1","2","3","4","5","6"] },
        { "name": "Machine 02", "stonesDetected": ["1","2","3","4","5","6"] }
      ]
    },
    "v50":     { "rootName": "...", "stonesDetected": [...] },
    "v50edf":  { "rootName": "...", "stonesDetected": [...] }
  }
}
```

Notes on this shape:
- `customer` only contains keys for fields that were actually filled in — see
  `02_input_tool_spec.md` for the exact rule.
- `folders` only contains keys for folders that were actually selected — `v50`/`v50edf` are
  optional and simply absent if skipped, same principle as `customer`.
- `folders.cust.machines[].stonesDetected` is exactly what was found in-browser, not assumed
  — a machine missing 2 of 6 stones reports `stonesDetected: ["1","2","3","4"]`, and it's the
  processing pipeline's job to decide how to handle an incomplete machine (skip it, flag it,
  partial-score it), a decision not yet made in this spec.
- The manifest carries **paths and detected identifiers only** — no image data, no capture
  JSON contents. It tells a downstream process *where to look and what it should find there*;
  reading the actual files is a separate step the pipeline performs directly against the same
  folders (the manifest doesn't embed the files themselves).
