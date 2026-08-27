# V360 Machine Health Audit Generator

**Executed engineering build:** 1.0.0  
**Build date:** 22 August 2026

This package completes the unfinished processing layer described in the handoff. The supplied user interface no longer generates simulated machine values. It reads the selected V360 capture folders locally in the browser, parses each matched `0.json`, computes transparent health metrics, embeds available still images, and creates a standalone customer report.

## Quick start

1. Extract the package to a normal local folder.
2. Open `V360_Machine_Health_Audit_Generator.html` in a current Chrome or Edge browser.
3. Enter the customer and report details.
4. Select the ideal reference folder and customer capture folder.
5. Optionally select V360 5.0 and V360 5.0 EDF reference folders.
6. Review the processing policy, then select **Process captures & build report**.
7. Open or download the generated standalone report, audit JSON, and manifest.

Everything is processed inside the browser. The delivered HTML contains no remote JavaScript, stylesheet, font, image, or API dependency.

## Accepted folder layouts

### Ideal and optional reference folders

```text
Ideal_Reference/
  D-1/
    0.json
    still.jpg       optional
    video.mp4       optional
  D-2/
  ...
  D-6/
```

The ideal reference must contain all six matched captures and every core scoring field:

- `visionProfile.currentProfile.R/G/B`
- `OldRGB`
- `NewRGB`
- `sharpness`
- `contrast`
- `TotalTime`

### Customer layout A: flat

```text
Customer_Captures/
  D-1-01/0.json
  D-2-01/0.json
  ...
  D-6-01/0.json
  D-1-02/0.json
  ...
```

The suffix becomes the machine name, such as `Machine 01`.

### Customer layout B: nested

```text
Customer_Captures/
  Machine 01/
    D-1/0.json
    ...
    D-6/0.json
  Machine 02/
    D-1/0.json
    ...
```

Mixed-case keys, common wrapper objects such as `payload`, `data`, or `capture`, profile JSON stored as a string, RGB arrays, and RGB text values are handled.

## Measurement model

The report retains the raw measurements alongside every normalized score.

| Metric | Real capture basis | Default normalization |
|---|---|---|
| Color accuracy | Euclidean distance between machine and ideal diamond `R/G/B` | `100 - distance × 2.5` |
| Picture quality | Absolute sharpness and contrast setting differences | `100 - sharpness difference × 12 - contrast difference × 8` |
| Consistency | Mean raw `OldRGB` background distance plus across-stone residual variability | `100 - mean distance × 2.5 - variability × 2` |
| Correction load | Positive excess of machine `OldRGB → NewRGB` distance over ideal, plus variability | `100 - mean excess × 2.5 - standard deviation × 1` |
| Speed | Machine `TotalTime` compared with the matched ideal stone | `min(100, 100 × ideal seconds / machine seconds)` |

The default composite weights are:

- Color accuracy: 30%
- Picture quality: 20%
- Consistency: 20%
- Correction load: 18%
- Speed: 12%

Health bands are healthy at 80 or above, attention from 60 to 79, and service needed below 60. All penalties, weights, and thresholds remain visible and editable. The profile is deliberately labeled **provisional-v1.0** because production normalization should be calibrated using a larger fleet with known healthy and known faulty machines.

## Incomplete data policy

**Strict mode**, the default, excludes a machine from fleet scoring when one or more matched D-1 to D-6 captures are missing.

**Partial mode** scores the available matched stones, includes the machine, and marks its coverage clearly, for example `5/6 partial`.

A parsed capture with an individual missing metric remains visible and reports that metric as unavailable rather than inventing a value.

## Media behavior

- `still.jpg`, `still.jpeg`, `still.png`, and `still.webp` are detected.
- Still images are resized to a maximum dimension of 720 pixels and embedded as JPEG.
- A base64 `image` field in `0.json` is used when no still file exists.
- `video.mp4` is indexed and named in the report.
- Full video embedding is off by default because it can make one HTML file extremely large.
- The default total video budget is 250 MB and is editable.
- The total still-image embed budget is 80 MB. Files beyond the budget are listed but omitted from the HTML payload.

## Outputs

- Standalone machine-health customer report HTML
- Audit data JSON without embedded media payloads
- Folder and coverage `manifest.json`
- Per-machine and per-stone raw measurements
- Metadata mismatch tables and repeated-setting recommendations
- English and Gujarati report modes
- Four report styles, dark mode, print/PDF layout, audience presets, and scoring controls

## Package map

```text
V360_Machine_Health_Audit_Generator.html   final executable
README_EXECUTED.md                         operating guide
IMPLEMENTATION_CHANGELOG.md                engineering changes
VALIDATION_REPORT.md                       validation evidence
src/                                       editable source and original handoff documents
sample_capture_data/                       synthetic validation fixtures
  flat/                                    flat folder layout
  nested/                                  nested folder layout
demo_outputs/                              generated sample report and test evidence
tests/e2e_validate.py                      automated browser validation
SHA256SUMS.txt                             file integrity checks
```

## Rebuild and validate

From the package root:

```bash
cd src
python3 build_report_template.py
python3 build_generator.py
cd ..
python3 tests/e2e_validate.py
```

The automated test requires Python Playwright and a Chromium-family browser. Set `V360_CHROMIUM` to the browser executable when automatic discovery does not find it.

## Production calibration note

The processing and report pipeline is complete and validated. The remaining field-engineering task is not a software gap: it is calibration of normalization constants against production evidence. Keep the raw metrics in every audit, assemble labeled healthy and faulty machine samples, then tune penalties and health thresholds without changing the underlying measurements.
