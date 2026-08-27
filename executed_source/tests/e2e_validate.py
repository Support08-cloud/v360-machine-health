from __future__ import annotations

from pathlib import Path
import json
import re
import sys
import traceback
import os
import shutil
from playwright.sync_api import sync_playwright, Page, Browser

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / 'V360_Machine_Health_Audit_Generator.html'
DATA = ROOT / 'sample_capture_data'
OUT = ROOT / 'demo_outputs'
OUT.mkdir(exist_ok=True)

IDEAL = DATA / 'flat' / 'Ideal_Reference'
CUSTOMER = DATA / 'flat' / 'Customer_Captures'
V50 = DATA / 'flat' / 'V50_Reference'
V50EDF = DATA / 'flat' / 'V50_EDF_Reference'
NESTED = DATA / 'nested' / 'Customer_Nested'

results: dict[str, object] = {'checks': [], 'errors': []}

def check(condition: bool, message: str, detail: object | None = None) -> None:
    entry = {'check': message, 'passed': bool(condition)}
    if detail is not None:
        entry['detail'] = detail
    results['checks'].append(entry)
    if not condition:
        raise AssertionError(f'{message}: {detail!r}')


def attach_error_handlers(page: Page, bucket: list[str]) -> None:
    page.on('pageerror', lambda exc: bucket.append(f'pageerror: {exc}'))
    page.on('console', lambda msg: bucket.append(f'console {msg.type}: {msg.text}') if msg.type == 'error' else None)


def configure_generator(page: Page, *, customer_dir: Path, include_upgrades: bool, partial: bool) -> None:
    page.set_content(GENERATOR.read_text(encoding='utf-8'), wait_until='load')
    page.fill('#custName', 'V360 Validation Customer')
    page.fill('#preparedBy', 'Vision 360 Engineering')
    page.fill('#contactPerson', 'QA Validation')
    page.fill('#location', 'Surat, India')
    page.click('#toStep2')
    page.locator('#idealInput').set_input_files(str(IDEAL))
    page.locator('#custInput').set_input_files(str(customer_dir))
    if include_upgrades:
        page.locator('#v50Input').set_input_files(str(V50))
        page.locator('#v50edfInput').set_input_files(str(V50EDF))
    page.wait_for_function("!document.querySelector('#toStep3').disabled")
    if customer_dir == CUSTOMER:
        check('flat layout' in page.locator('#custDetection').inner_text(), 'Flat customer folder pattern detected', page.locator('#custDetection').inner_text())
        check('4 machine(s) detected' in page.locator('#custDetection').inner_text(), 'Four flat machines detected', page.locator('#custDetection').inner_text())
    else:
        check('nested layout' in page.locator('#custDetection').inner_text(), 'Nested customer folder pattern detected', page.locator('#custDetection').inner_text())
        check('2 machine(s) detected' in page.locator('#custDetection').inner_text(), 'Two nested machines detected', page.locator('#custDetection').inner_text())
    page.click('#toStep3')
    if partial:
        page.check('#allowPartial')


def process_generator(page: Page, screenshot_name: str) -> dict:
    page.click('#generateBtn')
    page.locator('#resultBox').wait_for(state='visible', timeout=90_000)
    err = page.locator('#processError')
    check(err.is_hidden(), 'No processing error displayed', None if err.is_hidden() else err.inner_text())
    page.screenshot(path=str(OUT / screenshot_name), full_page=True)
    return page.evaluate('state.lastResult.data')


def has_data_url(value: object) -> bool:
    if isinstance(value, dict):
        return any(k == 'dataUrl' and isinstance(v, str) and v.startswith('data:') or has_data_url(v) for k, v in value.items())
    if isinstance(value, list):
        return any(has_data_url(v) for v in value)
    return False


def validate_report(browser: Browser, report_path: Path) -> None:
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    report_errors: list[str] = []
    attach_error_handlers(page, report_errors)
    page.set_content(report_path.read_text(encoding='utf-8'), wait_until='load')
    page.wait_for_selector('#fleetGrid .m-card')

    cards = page.locator('#fleetGrid .m-card')
    check(cards.count() == 3, 'Standalone report renders three strictly scored machines', cards.count())
    check('V360 Validation Customer' in page.locator('#reportSubtitle').inner_text(), 'Customer name appears in report header', page.locator('#reportSubtitle').inner_text())
    check('real capture data' in page.locator('#dataTag').inner_text().lower(), 'Report is labeled as real capture data', page.locator('#dataTag').inner_text())
    check('provisional' in page.locator('#reportDisclosure').inner_text().lower(), 'Provisional normalization disclosure is visible', page.locator('#reportDisclosure').inner_text())

    card = page.locator('#fleetGrid .m-card', has_text='Machine 02')
    check(card.count() == 1, 'Machine 02 card is present', card.count())
    card.click()
    page.wait_for_function("document.querySelector('#detailTitle').textContent.includes('Machine 02')")
    check(page.locator('#stoneList .stone-row').count() == 6, 'Machine detail renders six matched stones', page.locator('#stoneList .stone-row').count())

    first_row = page.locator('#stoneList .stone-row').first
    check(first_row.locator('.real-media img').count() == 2, 'Machine and ideal still images render from embedded real assets', first_row.locator('.real-media img').count())
    check(first_row.locator('.real-upgrades .upgrade-preview').count() == 2, '5.0 and 5.0 EDF previews render from reference folders', first_row.locator('.real-upgrades .upgrade-preview').count())

    toggle = first_row.locator('.stone-metadata-toggle')
    check(toggle.count() == 1, 'Technical metadata control is available', toggle.count())
    toggle.click()
    check(first_row.locator('.metadata-panel .meta-mismatch').count() > 0, 'Machine 02 metadata mismatches are highlighted', first_row.locator('.metadata-panel .meta-mismatch').count())

    page.screenshot(path=str(OUT / 'sample_report_machine_02.png'), full_page=True)

    page.click('#langToggle')
    check(page.locator('#langToggle').inner_text().strip().lower() == 'english', 'Gujarati localization toggle applies', page.locator('#langToggle').inner_text())
    page.click('#themeToggle')
    check(page.locator('html').get_attribute('data-theme') == 'dark', 'Dark theme toggle applies', page.locator('html').get_attribute('data-theme'))
    page.click('#changeStyleBtn')
    page.locator('.picker-btn[data-theme="instrument"]').click()
    check(page.locator('html').get_attribute('data-report-theme') == 'instrument', 'Instrument report style applies', page.locator('html').get_attribute('data-report-theme'))

    audit_path = OUT / 'report_exported_audit_data.json'
    with page.expect_download() as dlinfo:
        page.click('#downloadDataBtn')
    dl = dlinfo.value
    dl.save_as(str(audit_path))
    exported = json.loads(audit_path.read_text(encoding='utf-8'))
    check(not has_data_url(exported), 'Report Audit JSON strips embedded media payloads')
    check(len(exported.get('references', {}).get('ideal', {})) == 6, 'Audit JSON retains six ideal-reference measurement records')
    check(not report_errors, 'Standalone report has no browser runtime errors', report_errors)
    results['report_runtime_errors'] = report_errors
    page.close()


def main() -> None:
    generator_errors: list[str] = []
    with sync_playwright() as p:
        browser_path = os.environ.get('V360_CHROMIUM') or shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome') or shutil.which('msedge')
        launch_args = {'headless': True, 'args': ['--no-sandbox']}
        if browser_path:
            launch_args['executable_path'] = browser_path
        browser = p.chromium.launch(**launch_args)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
        attach_error_handlers(page, generator_errors)

        configure_generator(page, customer_dir=CUSTOMER, include_upgrades=True, partial=False)
        data = process_generator(page, 'generator_strict_completed.png')
        machines = {m['id']: m for m in data['machines']}
        excluded = data['excludedMachines']

        check(page.locator('#resultMachines').inner_text() == '3', 'Strict policy scores three complete machines', page.locator('#resultMachines').inner_text())
        check(page.locator('#resultExcluded').inner_text() == '1', 'Strict policy excludes one incomplete machine', page.locator('#resultExcluded').inner_text())
        check(len(machines) == 3 and len(excluded) == 1, 'Generated data contains three machines and one exclusion', {'machines': list(machines), 'excluded': excluded})
        check(excluded[0]['id'] == 'Machine 04' and excluded[0]['missing'] == ['D-6'], 'Incomplete Machine 04 is excluded for missing D-6', excluded[0])

        scores = {k: v['scores']['composite'] for k, v in machines.items()}
        check(scores['Machine 01'] >= 80, 'Healthy sample remains in healthy score band', scores)
        check(60 <= scores['Machine 02'] < 80, 'Attention sample lands in attention score band', scores)
        check(scores['Machine 03'] < 60, 'Critical sample lands in service score band', scores)
        check(data['sourceSummary']['customerPattern'] == 'flat', 'Generated report records flat source layout', data['sourceSummary'])
        check(data['sourceSummary']['hasV50'] and data['sourceSummary']['hasV50Edf'], 'Optional upgrade references are included', data['sourceSummary'])
        check(len(data['references']['ideal']) == 6, 'All six ideal reference captures are exported')
        check(data['machines'][2]['stonesData'][5]['assets']['machineStill']['name'] == '0.json embedded image', 'Embedded image fallback works when still.jpg is absent', data['machines'][2]['stonesData'][5]['assets']['machineStill'])

        report_path = OUT / 'V360_Sample_Machine_Health_Report.html'
        with page.expect_download() as dlinfo:
            page.click('#downloadReportBtn')
        dlinfo.value.save_as(str(report_path))
        with page.expect_download() as dlinfo:
            page.click('#downloadAuditBtn')
        dlinfo.value.save_as(str(OUT / 'generator_audit_data.json'))
        with page.expect_download() as dlinfo:
            page.click('#downloadManifestBtn')
        dlinfo.value.save_as(str(OUT / 'manifest.json'))
        check(report_path.exists() and report_path.stat().st_size > 100_000, 'Standalone sample report downloaded', report_path.stat().st_size if report_path.exists() else None)
        check(not generator_errors, 'Generator has no browser runtime errors', generator_errors)
        page.close()

        validate_report(browser, report_path)

        # Partial policy validation.
        partial_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        partial_errors: list[str] = []
        attach_error_handlers(partial_page, partial_errors)
        configure_generator(partial_page, customer_dir=CUSTOMER, include_upgrades=False, partial=True)
        partial_data = process_generator(partial_page, 'generator_partial_completed.png')
        check(partial_page.locator('#resultMachines').inner_text() == '4', 'Partial policy scores all four machines', partial_page.locator('#resultMachines').inner_text())
        check(partial_page.locator('#resultExcluded').inner_text() == '0', 'Partial policy excludes no machines', partial_page.locator('#resultExcluded').inner_text())
        m4 = next(m for m in partial_data['machines'] if m['id'] == 'Machine 04')
        check(m4['coverage']['partial'] and m4['coverage']['matched'] == 5, 'Partial Machine 04 is explicitly flagged 5/6', m4['coverage'])
        check(not partial_errors, 'Partial-policy run has no browser runtime errors', partial_errors)
        partial_page.close()

        # Nested folder detection validation.
        nested_page = browser.new_page(viewport={'width': 1280, 'height': 900})
        nested_errors: list[str] = []
        attach_error_handlers(nested_page, nested_errors)
        configure_generator(nested_page, customer_dir=NESTED, include_upgrades=False, partial=False)
        check(nested_page.evaluate('state.folders.cust.index.pattern') == 'nested', 'Nested index state is correct', nested_page.evaluate('state.folders.cust.index.pattern'))
        check(len(nested_page.evaluate('state.folders.cust.index.machines')) == 2, 'Nested index contains two machines')
        check(not nested_errors, 'Nested-detection run has no browser runtime errors', nested_errors)
        nested_page.close()

        browser.close()

    results['generator_runtime_errors'] = generator_errors
    results['summary'] = {
        'passed': sum(1 for x in results['checks'] if x['passed']),
        'failed': sum(1 for x in results['checks'] if not x['passed']),
        'machine_scores': scores,
        'sample_report_bytes': report_path.stat().st_size,
    }
    (OUT / 'validation_results.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(results['summary'], indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        results['errors'].append({'error': str(exc), 'traceback': traceback.format_exc()})
        (OUT / 'validation_results.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
        traceback.print_exc()
        sys.exit(1)
