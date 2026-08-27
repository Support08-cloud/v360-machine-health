# Vision 360 Direct JSON Synchronized Viewer - Tested v1.1

## What changed

- The report does not use an iframe.
- The report does not open another viewer HTML file.
- It reads `viewer-config.json`, each stone's `sm.json`, and matched quality JSON files directly.
- Both datasets must finish loading and decoding before controls become active.
- Dragging either main viewer, clicking a thumbnail, using Play, changing frame, changing zoom, and reversing direction update both stones from one shared timeline.

## Start it

### Windows
Double-click `START_VIEWER_WINDOWS.bat`.

### macOS
Double-click `START_VIEWER_MAC.command`.

The launcher opens the report automatically using an offline localhost address. Do not double-click `report.html`, because browsers block direct JSON fetches under `file://`.

## Included JSON tiers

- `sm.json`: 32 interactive thumbnail angles
- `4.json`: 16 main frames
- `5.json`: 32 main frames, default
- `6.json`: 64 main frames
- `0.json`: metadata and first image

## Validation

Run:

```bash
python3 tests/validate_package.py
```

See `TEST_RESULTS.md` for the completed validation report.

## Browser-tested behavior

The included automated browser validation confirmed thumbnail clicking, drag rotation, playback, synchronized frame indices, quality switching, image rendering, and zero browser console errors. See `TEST_RESULTS.md` and `TESTED_BROWSER_VIEW.png`.

The sample reference is a lightly tone-adjusted copy of the supplied D-1-11 sequence so both sides have identical angular indexing for synchronization testing. It is demonstration data, not a calibrated ideal reference.
