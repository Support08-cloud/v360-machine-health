# Implementation Changelog

## Release 1.0.0, executed 22 August 2026

### Real capture ingestion

- Replaced simulated fleet values with real `0.json` capture parsing.
- Added flat `D-<stone>-<machine>` and nested `Machine/D-<stone>` indexing.
- Added mixed-layout detection and natural machine sorting.
- Added case-insensitive JSON field lookup.
- Added support for capture objects wrapped in `payload`, `data`, `capture`, `record`, or `result`.
- Added support for profile objects stored directly or as JSON strings.
- Added RGB parsing from arrays and formatted text.
- Added duration parsing from numeric seconds, `MM:SS`, and `HH:MM:SS`.
- Added strict ideal-reference readiness validation for all six core capture records.

### Measurement and scoring

- Diamond color now uses actual profile `R/G/B` values.
- Background stability uses raw `OldRGB` rather than corrected output.
- Correction load uses direct `OldRGB → NewRGB` Euclidean distance.
- Picture quality uses actual sharpness and contrast setting differences.
- Speed uses matched `TotalTime` values.
- Added configurable normalization penalties, health thresholds, and weighted composite scoring.
- Added machine-level consistency variability and correction-excess variability.
- Retained raw distances, times, coverage, and component scores for calibration and traceability.
- Added strict exclusion and explicit partial-scoring policies.

### Media processing

- Added actual still-image detection and browser-side optimization.
- Added base64 image fallback from `0.json`.
- Added optional full `video.mp4` embedding with a configurable aggregate budget.
- Added media omission warnings rather than silent loss.
- Added real machine-versus-ideal comparisons to each stone row.
- Added 5.0 and 5.0 EDF reference preview bands from their selected folders.

### Customer report

- Replaced demo header text with real customer, preparer, date, contact, and location details.
- Added real machine cards, score bands, diagnoses, and recommended corrections.
- Added raw per-stone color, background, picture, correction, and speed values.
- Added real metadata comparison tables and repeated mismatch aggregation.
- Added coverage notices, excluded-machine disclosure, warning disclosure, and calibration disclosure.
- Preserved English and Gujarati localization.
- Preserved modern, instrument, cut-and-facet, and spec-sheet styles.
- Preserved dark mode, audience presets, report visibility settings, and print/PDF output.
- Added media-free Audit JSON export from both generator and report.

### Standalone delivery

- Removed remote Google Font dependencies.
- Confirmed no remote script, stylesheet, image, media, or API dependency.
- Embedded report template, JavaScript, CSS, logos, data, and optimized images.
- Corrected standalone report script injection so the generated data block and report runtime remain separate executable script elements.
- Corrected ideal and upgrade reference asset resolution in the report.
- Corrected exported JSON stripping for centrally stored reference media.

### Validation

- Added synthetic but structurally realistic flat and nested capture fixtures.
- Added healthy, attention, critical, incomplete, wrapped JSON, profile-string, mixed-case, RGB-string, and embedded-image cases.
- Added automated Chromium validation covering generator and report behavior.
- Final validation result: 44 passed, 0 failed, and 0 browser runtime errors.
