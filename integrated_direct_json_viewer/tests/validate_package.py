#!/usr/bin/env python3
from __future__ import annotations
import base64, io, json, os, subprocess, sys, time, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = []

def check(condition, message):
    checks.append((bool(condition), message))
    if not condition: errors.append(message)

def valid_jpeg(value):
    if not isinstance(value, str) or len(value) < 100 or not value.lstrip().startswith('/9j/'):
        return False
    try:
        with Image.open(io.BytesIO(base64.b64decode(value))) as im:
            im.verify()
        return True
    except Exception:
        return False

config = json.loads((ROOT/'viewer-config.json').read_text(encoding='utf-8'))
check(config.get('schema') == 'v360-direct-json-viewer/1.1', 'configuration schema is v1.1')
html = (ROOT/'report.html').read_text(encoding='utf-8')
check('<iframe' not in html.lower(), 'report contains no iframe')
check('viewer-config.json' in (ROOT/'assets'/'viewer-app.js').read_text(encoding='utf-8'), 'application loads viewer-config.json directly')

for role in ('actual', 'reference'):
    base = ROOT/config[role]['basePath']
    meta = json.loads((base/config['metadataFile']).read_text(encoding='utf-8-sig'))
    check(isinstance(meta, dict), f'{role} 0.json parses as an object')
    check(valid_jpeg(meta.get('image')), f'{role} 0.json image decodes as JPEG')
    sm = json.loads((base/config['thumbnailFile']).read_text(encoding='utf-8-sig'))
    sm_valid = [v for v in sm if valid_jpeg(v)]
    check(len(sm_valid) == 32, f'{role} sm.json provides 32 valid thumbnail frames')
    for quality, definition in config['qualities'].items():
        frames = json.loads((base/definition['file']).read_text(encoding='utf-8-sig'))
        check(len(frames) == definition['expectedFrames'], f'{role} {definition["file"]} has {definition["expectedFrames"]} frames')
        decoded = sum(valid_jpeg(v) for v in frames)
        check(decoded == len(frames), f'{role} {definition["file"]} contains only decodable JPEG frames')

node = subprocess.run(['node', '--check', str(ROOT/'assets'/'viewer-app.js')], capture_output=True, text=True)
check(node.returncode == 0, 'viewer-app.js passes JavaScript syntax validation')
node_core = subprocess.run(['node', str(ROOT/'tests'/'test_core.js')], capture_output=True, text=True)
check(node_core.returncode == 0, 'shared timeline and frame mapping unit tests pass')

# Server smoke test: start the same launcher backend and request the real JSON files.
server = subprocess.Popen([sys.executable, str(ROOT/'server.py'), '--test', '--port', '8197'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8197/viewer-config.json', timeout=1) as response:
                check(response.status == 200, 'offline localhost server returns viewer-config.json')
                check('application/json' in response.headers.get('Content-Type',''), 'JSON files use application/json MIME type')
            with urllib.request.urlopen('http://127.0.0.1:8197/data/actual/5.json', timeout=3) as response:
                check(response.status == 200, 'offline localhost server returns actual 5.json')
            with urllib.request.urlopen('http://127.0.0.1:8197/data/reference/sm.json', timeout=3) as response:
                check(response.status == 200, 'offline localhost server returns reference sm.json')
            break
        except Exception:
            time.sleep(.1)
    else:
        check(False, 'offline localhost server starts successfully')
finally:
    server.terminate()
    try: server.wait(timeout=3)
    except subprocess.TimeoutExpired: server.kill()

passed = sum(ok for ok, _ in checks)
print(f'V360 package validation: {passed}/{len(checks)} checks passed')
for ok, message in checks:
    print(('PASS' if ok else 'FAIL') + ' - ' + message)
if errors:
    sys.exit(1)
