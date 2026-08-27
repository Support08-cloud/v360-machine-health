# File Manifest

```
V360_Machine_Health_Handoff/
├── 00_README.md                          Overview, business context, reading order
├── 01_architecture.md                    Audit scenario, end-to-end data flow, folder conventions
├── 02_input_tool_spec.md                 Generator: every screen, field, and the detection logic
├── 03_output_report_spec.md              Report: every section, the theme + audience systems
├── 04_data_model_and_capture_schema.md   Real V360 capture JSON schema + manifest.json schema
├── 05_scoring_algorithm_spec.md          Every formula: current (simulated) vs. real-data version
├── 06_brand_guideline_reference.md       Colors, type, logo — condensed from V360's own package
├── 07_localization_spec.md               EN/GU system, how to add a language, a real mistake to avoid
├── 08_current_state_and_next_steps.md    Honest real-vs-simulated status, the next build scoped
├── 09_file_manifest.md                   This file
└── reference_implementation/
    ├── v360_report_generator.html        Working Generator — open directly in a browser
    └── v360_machine_health_demo.html     Working Report — open directly in a browser
```

Both HTML files are complete and standalone — no build step, no server, no dependencies
beyond a Google Fonts CDN link (Inter, JetBrains Mono) that gracefully falls back to system
fonts if unavailable. Open either directly in a Chromium-based browser to see current behavior
before reading further, if that's a faster way in than the prose specs.

**Suggested reading order for someone picking this up cold:** `00_README.md` →
`01_architecture.md` → open both reference HTML files and click through them → the remaining
specs in whichever order matches what you're building first (input-side detection logic vs.
output-side scoring pipeline are independent enough to read in either order).
