from pathlib import Path
import json, re

root = Path(__file__).resolve().parent
base = (root / 'v360_report_generator_base.html').read_text(encoding='utf-8')
# Remove remote font dependencies so the delivered HTML remains fully offline.
base = re.sub(r'\s*<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>', '', base, flags=re.I)
css = (root / 'generator_extra.css').read_text(encoding='utf-8')
runtime = (root / 'generator_runtime.js').read_text(encoding='utf-8')
report_template = (root / 'v360_machine_health_report_template.html').read_text(encoding='utf-8')

base = base.replace('</style>', css + '\n</style>', 1)
base = base.replace('produces the data that feeds the customer-facing audit report', 'reads real capture folders, computes machine health, and builds a standalone customer report')

panel3 = '''  <section class="panel" id="panel3">
    <div class="review-section">
      <p class="review-title">Customer &amp; report</p>
      <div id="reviewCustomer"></div>
    </div>
    <div class="review-section">
      <p class="review-title">Folders</p>
      <div id="reviewFolders"></div>
    </div>

    <div class="processing-options">
      <p class="review-title" style="margin-bottom:10px;">Processing policy</p>
      <label class="option-row"><input type="checkbox" id="allowPartial"><span><strong>Allow partial machines</strong><br>Score machines from the matched stones that are available and mark the report as partial. When off, any machine missing one or more of the six matched captures is excluded from fleet scoring.</span></label>
      <label class="option-row"><input type="checkbox" id="embedVideos"><span><strong>Embed full videos in the standalone HTML</strong><br>Off by default because base64 video can make the report very large. Still images are always optimized and embedded.</span></label>
      <div class="cal-field" style="max-width:220px;margin:8px 0 0 25px;"><label for="videoBudgetMb">Maximum total embedded video size (MB)</label><input id="videoBudgetMb" type="number" min="0" max="2000" value="250"></div>
      <p class="file-size-note">Videos beyond this combined limit remain listed by filename but are not embedded.</p>

      <details class="advanced-settings">
        <summary>Advanced normalization profile (provisional, transparent, editable)</summary>
        <div class="cal-grid">
          <div class="cal-field"><label for="colorPenalty">Color penalty per ΔRGB unit</label><input id="colorPenalty" type="number" min="0" step="0.1" value="2.5"></div>
          <div class="cal-field"><label for="sharpnessPenalty">Sharpness mismatch penalty per step</label><input id="sharpnessPenalty" type="number" min="0" step="1" value="12"></div>
          <div class="cal-field"><label for="contrastPenalty">Contrast mismatch penalty per step</label><input id="contrastPenalty" type="number" min="0" step="1" value="8"></div>
          <div class="cal-field"><label for="consistencyMeanPenalty">Background mean-drift penalty</label><input id="consistencyMeanPenalty" type="number" min="0" step="0.1" value="2.5"></div>
          <div class="cal-field"><label for="consistencyVarPenalty">Background variability penalty</label><input id="consistencyVarPenalty" type="number" min="0" step="0.1" value="2.0"></div>
          <div class="cal-field"><label for="correctionPenalty">Correction excess penalty</label><input id="correctionPenalty" type="number" min="0" step="0.1" value="2.5"></div>
          <div class="cal-field"><label for="correctionVarPenalty">Correction variability penalty</label><input id="correctionVarPenalty" type="number" min="0" step="0.1" value="1.0"></div>
        </div>
      </details>
    </div>

    <button class="btn-primary" id="generateBtn">Process captures &amp; build report</button>
    <div class="progress-box" id="progressBox" hidden aria-live="polite">
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <p class="progress-message" id="progressMessage">Starting…</p>
    </div>
    <div class="process-error" id="processError" hidden></div>

    <div id="resultBox" hidden>
      <div class="result-grid">
        <div class="result-card"><p class="result-num mono" id="resultMachines">0</p><div class="result-label">Machines scored</div></div>
        <div class="result-card"><p class="result-num mono" id="resultExcluded">0</p><div class="result-label">Machines excluded</div></div>
        <div class="result-card"><p class="result-num mono" id="resultWarnings">0</p><div class="result-label">Data warnings</div></div>
      </div>
      <p class="field-note" id="reportSize" style="margin:0;"></p>
      <div class="output-actions">
        <button class="btn-success" id="openReportBtn">Open live report</button>
        <button class="btn-warning" id="downloadReportBtn">Download standalone report</button>
        <button class="btn-inline" id="downloadAuditBtn">Download audit data JSON</button>
        <button class="btn-inline" id="downloadManifestBtn">Download manifest.json</button>
      </div>
      <div class="log-box" id="logBox"></div>
    </div>

    <p class="note-callout"><strong>Measurement basis:</strong> diamond color uses the real <span class="mono">R/G/B</span> fields; background stability uses raw <span class="mono">OldRGB</span>; correction load uses the direct <span class="mono">OldRGB → NewRGB</span> distance; picture quality uses declared sharpness/contrast settings; speed uses <span class="mono">TotalTime</span>. The generated report retains raw measurements and labels the normalization profile as provisional until validated against a larger known-healthy / known-faulty fleet.</p>
    <div class="step-actions"><button class="btn-secondary" id="toStep2Back">&larr; back</button><span></span></div>
  </section>'''

base, n = re.subn(r'  <section class="panel" id="panel3">.*?  </section>', panel3, base, count=1, flags=re.S)
if n != 1:
    raise RuntimeError(f'Panel 3 replacement count was {n}')

# Encode the whole report template as one safe JavaScript string literal. Prevent a literal
# </script> sequence from appearing inside the generator's script element.
encoded = json.dumps(report_template, ensure_ascii=False)
encoded = encoded.replace('</script>', '<\\/script>').replace('</SCRIPT>', '<\\/SCRIPT>')
encoded = encoded.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
runtime = runtime.replace('__REPORT_TEMPLATE__', encoded)

# Replace the original demo-only script.
base, n = re.subn(r'<script>.*?</script>\s*</body>', lambda _m: '<script>\n' + runtime + '\n</script>\n</body>', base, count=1, flags=re.S)
if n != 1:
    raise RuntimeError(f'Script replacement count was {n}')

out = root.parent / 'V360_Machine_Health_Audit_Generator.html'
out.write_text(base, encoding='utf-8')
print(out)
