# Viewer Integration Handoff Note

## Purpose
This note explains how the tested direct-JSON viewer in this package can be used for future integration work.

## Current viewer module location
`integrated_direct_json_viewer/`

## Core files
- `report.html` - tested UI for the synchronized viewer
- `viewer-config.json` - configuration for actual and reference datasets
- `assets/viewer-app.js` - interaction layer and synchronization logic
- `assets/v360-core.js` - frame/JSON loading helpers
- `data/actual/` - actual dataset sample
- `data/reference/` - reference dataset sample

## Suggested full merge path into machine health generator
1. Extend input indexing in the generator to detect:
   - `sm.json`
   - `4.json`
   - `5.json`
   - `6.json`
2. Extend the report data schema to embed or link those assets for every stone.
3. Replace the still/video-only compare area in the report template with the direct-JSON viewer component.
4. Add lazy loading so only the active stone viewer decodes its frames first.
5. Keep still-image fallback only when JSON assets are missing.

## Why this package is enough for later continuation
The original handoff, executed source, tested viewer module, validation output, and launch files are all preserved together here.
