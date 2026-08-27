# Validation Report

**Build:** V360 Machine Health Audit Generator 1.0.0  
**Validation date:** 22 August 2026  
**Result:** 44 passed, 0 failed

## Test dataset

The included synthetic fixtures model the real folder and field structure without representing production calibration data.

- Machine 01: healthy reference-near capture set
- Machine 02: moderate color, setting, correction, and speed drift
- Machine 03: substantial color, background, picture, correction, and speed drift
- Machine 04: intentionally incomplete, with D-6 missing
- Ideal reference: complete D-1 to D-6 set
- Optional reference tiers: complete 5.0 and 5.0 EDF sets
- Nested dataset: two machines for layout-index validation

The fixtures also exercise wrapped JSON, stringified profiles, case-insensitive keys, RGB text parsing, numeric and formatted durations, and a base64 image fallback.

## Observed scores

| Machine | Composite | Expected band | Result |
|---|---:|---|---|
| Machine 01 | 95 | Healthy | Passed |
| Machine 02 | 79 | Attention | Passed |
| Machine 03 | 46 | Service needed | Passed |
| Machine 04 | Excluded in strict mode | Missing D-6 | Passed |
| Machine 04 | Scored in partial mode | 5/6 and explicitly flagged partial | Passed |

These scores validate software behavior only. They do not establish production acceptance thresholds.

## Validated behavior

- Six-stone ideal folder detection and field readiness
- Four-machine flat folder detection
- Two-machine nested folder detection
- Strict exclusion of incomplete machines
- Partial scoring and explicit coverage labeling
- Actual score generation from capture values
- Healthy, attention, and service-needed score separation
- Optional 5.0 and 5.0 EDF references
- Still-image optimization and embedding
- Base64 image fallback when `still.jpg` is absent
- Standalone HTML report generation and download
- Real machine and ideal media rendering
- Six per-stone detail rows
- Metadata mismatch highlighting
- English and Gujarati switching
- Light and dark mode switching
- Instrument report style switching
- Media-free JSON export
- No browser console errors or uncaught runtime exceptions
- No remote scripts, stylesheets, fonts, images, media, or API calls

## Evidence files

- `demo_outputs/validation_results.json`: machine-readable result for all 44 checks
- `demo_outputs/V360_Sample_Machine_Health_Report.html`: generated standalone report
- `demo_outputs/generator_strict_completed.png`: strict-policy generator result
- `demo_outputs/generator_partial_completed.png`: partial-policy generator result
- `demo_outputs/sample_report_machine_02.png`: expanded Machine 02 report evidence
- `demo_outputs/generator_audit_data.json`: generator-exported audit data without media payloads
- `demo_outputs/report_exported_audit_data.json`: report-exported audit data without media payloads
- `demo_outputs/manifest.json`: source folder and coverage manifest

## Static checks

- Generator JavaScript passed `node --check`.
- Report-template JavaScript passed `node --check`.
- Generated report contains two valid script elements: one data payload and one report runtime.
- Generator and generated report contain no external JavaScript or CSS resources.

## Calibration qualification

The handoff did not define validated distance-to-score constants. The build therefore exposes a transparent provisional profile and retains every raw measurement. Before the score is used as a contractual service threshold, validate the constants against a labeled production fleet and document repeatability, operator variation, environmental variation, and known-fault detection performance.
