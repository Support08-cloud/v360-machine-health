import asyncio, mimetypes, json
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]

async def main():
    errors=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
        page=await browser.new_page(viewport={'width':1440,'height':1000}, device_scale_factor=1)
        page.on('console', lambda msg: errors.append(f'console {msg.type}: {msg.text}') if msg.type=='error' else None)
        page.on('pageerror', lambda exc: errors.append('pageerror: '+str(exc)))

        async def handler(route):
            url=urlparse(route.request.url)
            rel=unquote(url.path.lstrip('/')) or 'report.html'
            path=(ROOT/rel).resolve()
            if not str(path).startswith(str(ROOT.resolve())) or not path.exists() or not path.is_file():
                await route.fulfill(status=404, body='not found')
                return
            ctype=mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
            if path.suffix=='.json': ctype='application/json; charset=utf-8'
            elif path.suffix=='.js': ctype='text/javascript; charset=utf-8'
            elif path.suffix=='.css': ctype='text/css; charset=utf-8'
            elif path.suffix=='.html': ctype='text/html; charset=utf-8'
            await route.fulfill(status=200, path=str(path), content_type=ctype)

        await page.route('https://v360.test/**', handler)
        html=(ROOT/'report.html').read_text(encoding='utf-8').replace('<head>','<head><base href="https://v360.test/">',1)
        await page.set_content(html, wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_function('window.__V360_APP__ && window.__V360_APP__.state.ready === true', timeout=60000)
        snap1=await page.evaluate('window.__V360_APP__.getSnapshot()')
        print('READY',json.dumps(snap1))
        assert snap1['ready'] and snap1['count']==32 and snap1['actualThumbs']==32 and snap1['referenceThumbs']==32
        assert snap1['iframeCount']==0
        # Thumbnail interaction
        await page.locator('.thumb-item').nth(7).click()
        await page.wait_for_timeout(100)
        snap2=await page.evaluate('window.__V360_APP__.getSnapshot()')
        print('THUMB',json.dumps(snap2))
        assert snap2['frame'] != snap1['frame']
        # Drag interaction on actual canvas, both sides share the same timeline.
        box=await page.locator('#actualCanvas').bounding_box()
        await page.mouse.move(box['x']+box['width']*.65, box['y']+box['height']*.55)
        await page.mouse.down()
        await page.mouse.move(box['x']+box['width']*.35, box['y']+box['height']*.55, steps=8)
        await page.mouse.up()
        await page.wait_for_timeout(100)
        snap3=await page.evaluate('window.__V360_APP__.getSnapshot()')
        print('DRAG',json.dumps(snap3))
        assert snap3['frame'] != snap2['frame']
        # Playback interaction
        await page.locator('#playBtn').click()
        before=(await page.evaluate('window.__V360_APP__.getSnapshot()'))['frame']
        await page.wait_for_timeout(550)
        await page.locator('#playBtn').click()
        after=(await page.evaluate('window.__V360_APP__.getSnapshot()'))['frame']
        print('PLAY',before,after)
        assert after != before
        # Quality switch must reload both sides as one gate.
        await page.select_option('#qualitySelect','4')
        await page.wait_for_function('window.__V360_APP__.state.quality === 4 && window.__V360_APP__.state.timeline.count === 16 && document.querySelector("#loadingOverlay").hidden', timeout=60000)
        snap4=await page.evaluate('window.__V360_APP__.getSnapshot()')
        print('QUALITY',json.dumps(snap4))
        assert snap4['count']==16 and snap4['quality']==4
        # Verify both canvases contain rendered image pixels.
        lengths=await page.evaluate('[document.querySelector("#actualCanvas").toDataURL().length, document.querySelector("#referenceCanvas").toDataURL().length]')
        print('CANVAS_DATA_LENGTHS',lengths)
        assert min(lengths)>1000
        await page.screenshot(path=str(ROOT/'TESTED_BROWSER_VIEW_RECHECK.png'), full_page=True)
        print('ERRORS',errors)
        assert not errors
        await browser.close()

asyncio.run(main())
