from pathlib import Path

root = Path(__file__).resolve().parent
base = (root / 'v360_machine_health_report_template_base.html').read_text(encoding='utf-8')
# Remove remote font dependencies so the delivered HTML remains fully offline.
import re
base = re.sub(r'\s*<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>', '', base, flags=re.I)
css = (root / 'report_extra.css').read_text(encoding='utf-8')
overrides = (root / 'report_overrides.js').read_text(encoding='utf-8')

# Add real-data CSS.
base = base.replace('</style>', css + '\n</style>', 1)

# Dynamic report header and actions.
base = base.replace('<span class="demo-tag" data-i18n="demoTag">sample data · demo</span>', '<span class="demo-tag" id="dataTag">real capture data</span>')
base = base.replace('<p class="sub">Harikrishna export &middot; prepared by V360 &middot; 22 Aug 2026</p>', '<p class="sub" id="reportSubtitle">V360 machine audit</p>')
base = base.replace('<div class="header-actions">\n    <button class="lang-toggle"', '<div class="header-actions">\n    <button class="header-action-secondary" id="printBtn" type="button">Print / PDF</button>\n    <button class="header-action-secondary" id="downloadDataBtn" type="button">Audit JSON</button>\n    <button class="lang-toggle"', 1)
base = base.replace('<p class="hint" data-i18n="fleetHint">6 of 14 machines shown for this demo — the live report scales to however many exist for a given fleet.</p>', '<p class="hint" id="fleetHint">Machines analyzed from the selected folders.</p>')
base = base.replace('<p class="conclusion-label">Summary &amp; recommendation</p>', '<p class="conclusion-label" data-i18n="summaryLabel">Summary &amp; recommendation</p>')
base = base.replace('  <footer>\n', '  <div class="report-disclosure" id="reportDisclosure"></div>\n\n  <footer>\n', 1)

# Report data is injected here by the generator. Keeping the placeholder as a comment
# means the template can still be opened safely on its own.
marker = '<script>\nvar machines = ['
if marker not in base:
    raise RuntimeError('Main report script marker not found')
base = base.replace('<script>\nvar machines = [', '<!--V360_REPORT_DATA-->\n<script>\nvar machines = [', 1)

# Override the simulated seams immediately before initial rendering.
init_marker = 'var savedSettings = loadSettings();'
if init_marker not in base:
    raise RuntimeError('Report init marker not found')
base = base.replace(init_marker, overrides + '\n\n' + init_marker, 1)

out = root / 'v360_machine_health_report_template.html'
out.write_text(base, encoding='utf-8')
print(out)
