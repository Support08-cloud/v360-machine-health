# Tested Browser Result - v1.1

Validation date: 2026-08-23

## Package and JSON validation

Result: **27 / 27 passed**

The validation decoded every JPEG in both datasets across:

- `0.json`
- `sm.json` with 32 valid interactive thumbnails per side
- `4.json` with 16 frames per side
- `5.json` with 32 frames per side
- `6.json` with 64 frames per side

It also verified JavaScript syntax, shared timeline mapping, localhost JSON MIME types, and availability of the actual and reference JSON endpoints.

## Real browser interaction validation

Browser engine: Chromium 144

Result: **passed with zero console or runtime errors**

| Test | Observed result |
|---|---|
| Initial synchronized load | Both sides ready at frame 0 of 32 |
| iframe count | 0 |
| Actual thumbnail frames | 32 |
| Reference thumbnail frames | 32 |
| Click thumbnail 08 | Both viewers moved to frame index 7 |
| Drag actual canvas | Both viewers moved together to frame index 1 |
| Play control | Shared timeline advanced from frame 1 to frame 6 |
| Quality change | Both sides changed together from 32-frame JSON to 16-frame JSON |
| Canvas render check | Both canvases produced non-empty rendered image data |
| Browser errors | 0 |

`TESTED_BROWSER_VIEW.png` is the screenshot captured by the automated browser test.

## Demonstration reference notice

For exact angular synchronization confirmation, the right-side reference is a lightly tone-adjusted copy of the same supplied D-1-11 frame sequence. It is synthetic test data and is not presented as a production ideal reference.
