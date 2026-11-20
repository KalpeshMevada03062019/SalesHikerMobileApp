// Updates docs/SalesHiker_Mobile_Test_Cases.xlsx and docs/SalesHiker_Mobile_Defect_Tracker.xlsx from
// automated runs. Called by scripts\_common.ps1 (Invoke-WdioRun) after every run; can also be run by hand.
//
//   node tools/excel/update-workbooks.js <reports\<run> folder> [...]   add run(s), then rebuild both workbooks
//   node tools/excel/update-workbooks.js                                 rebuild from the ledger only
//
// How it works
// - Results are kept in docs/test-execution-ledger.json, keyed by test ID (MLGN-001, MCMP-012, ...), so a
//   run of one spec updates only its tests and earlier results stay. A run folder is ingested once.
// - PASS/FAIL replace a test's result and raise its iteration. SKIPPED / NOT EXECUTED never replace a
//   PASS/FAIL; they are noted in Comments ("last attempt not executed ...").
// - Defects: Status and the manual columns are kept from the existing tracker. A defect with a
//   `guardTest` moves automatically when that test has a new result:
//     guard FAIL and Status Closed / Ready for Retest -> Reopened
//     guard PASS and Status Open / Reopened / In Progress -> Ready for Retest
//   "Needs Decision" and "Won't Fix" are never changed. Closing is always manual.
// - Failed tests without a linked defect go to the "Failures to triage" sheet, where a person sets the
//   classification (test-side / environment / application defect). New defects are never invented.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const modules = require('./modules');

const ROOT = path.resolve(__dirname, '..', '..');
// QA_DOCS_DIR redirects the output (used to try the generator without touching docs/).
const DOCS = process.env.QA_DOCS_DIR ? path.resolve(process.env.QA_DOCS_DIR) : path.join(ROOT, 'docs');
const TC_FILE = path.join(DOCS, 'SalesHiker_Mobile_Test_Cases.xlsx');
const DT_FILE = path.join(DOCS, 'SalesHiker_Mobile_Defect_Tracker.xlsx');
const LEDGER_FILE = path.join(DOCS, 'test-execution-ledger.json');
const SPEC_DIR = path.join(ROOT, 'test', 'specs');
const EXECUTED_BY = 'Automation Suite (Appium + WebdriverIO)';
const BACKEND = 'Beta backend: accountsbeta.saleshiker.com';
const ID_PATTERN = /^([A-Z]+(?:-[A-Z]+)?-\d+)\b/;

// ---------------------------------------------------------------- styles (from the web template)
const FONT = { name: 'Arial', size: 10 };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const HEADER_FONT = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
const BORDER_SIDE = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER = { left: BORDER_SIDE, right: BORDER_SIDE, top: BORDER_SIDE, bottom: BORDER_SIDE };
const LINK_FONT = { name: 'Arial', size: 10, underline: true, color: { argb: 'FF0563C1' } };
const SEVERITY_FILL = { Critical: 'FFC00000', High: 'FFFF6D6D', Medium: 'FFFFC000', Low: 'FF92D050' };

function styleHeader(row, height) {
  row.height = height;
  row.eachCell((c) => { c.font = HEADER_FONT; c.fill = HEADER_FILL; c.border = BORDER; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
}
function styleBody(row, cols) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    if (!cell.font || !cell.font.underline) cell.font = FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: 'top', wrapText: true, ...(cell.alignment && cell.alignment.horizontal ? { horizontal: cell.alignment.horizontal } : {}) };
  }
}
function listValidation(ws, col, fromRow, toRow, values) {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${values.join(',')}"`] };
  }
}
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
// Workbook links are relative to docs/, so they work wherever the project folder is copied.
const link = (projectRelative, text) => ({ text, hyperlink: path.relative(DOCS, path.join(ROOT, projectRelative)).split(path.sep).join('/') });
const firstLine = (msg) => (msg || '').split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';

// ---------------------------------------------------------------- ledger
function loadLedger() {
  if (!fs.existsSync(LEDGER_FILE)) return { runs: [], tests: {}, defects: {} };
  return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
}

/** Results of one run folder: results.json (written by the runner) or, failing that, its junit*.xml files. */
function readRun(runDir) {
  const json = path.join(runDir, 'results.json');
  if (fs.existsSync(json)) {
    const data = JSON.parse(fs.readFileSync(json, 'utf8').replace(/^﻿/, ''));
    return { meta: data.meta || {}, tests: [].concat(data.tests || []) };
  }
  const junits = fs.readdirSync(runDir).filter((f) => /^junit.*\.xml$/.test(f));
  if (!junits.length) return null;
  const xml = junits.map((f) => fs.readFileSync(path.join(runDir, f), 'utf8')).join('\n');
  const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const tests = [];
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const name = decode((m[1].match(/\bname="([^"]*)"/) || [])[1] || '');
    const body = m[3] || '';
    const failure = body.match(/<(?:failure|error)\b[^>]*?message="([^"]*)"/);
    const status = /<(failure|error)\b/.test(body) ? 'FAILED' : /<skipped\b/.test(body) ? 'SKIPPED' : 'PASSED';
    tests.push({ Test: name, Status: status, Detail: failure ? decode(failure[1]) : '' });
  }
  const started = (xml.match(/<testsuite [^>]*timestamp="([^"]+)"/) || [])[1];
  return { meta: { started }, tests };
}

const safeName = (title) => title.replace(/[^\w.-]+/g, '_').slice(0, 80);   // same as src/utils/evidence.ts

function evidenceFor(runDir, id, title, failed) {
  const files = [];
  if (failed) {
    const shot = path.join(runDir, 'failures', safeName(title), 'screenshot.png');
    if (fs.existsSync(shot)) files.push(rel(shot));
  }
  const shots = path.join(runDir, 'screenshots');
  if (fs.existsSync(shots)) {
    for (const f of fs.readdirSync(shots).sort()) if (f.startsWith(`${id}_`)) files.push(rel(path.join(shots, f)));
  }
  return files;
}

function ingest(ledger, runDir) {
  const run = path.basename(runDir);
  if (ledger.runs.includes(run)) { console.log(`Already in the ledger, skipped: ${run}`); return 0; }
  const data = readRun(runDir);
  if (!data) { console.warn(`No results.json or junit*.xml in ${runDir}`); return 0; }
  const date = data.meta.started || fs.statSync(runDir).mtime.toISOString();
  const env = data.meta.device ? `${data.meta.device}; app ${data.meta.app || '?'}` : '';
  let n = 0;
  for (const t of data.tests) {
    const id = (String(t.Test).match(ID_PATTERN) || [])[1];
    if (!id) continue;
    const status = { PASSED: 'PASS', FAILED: 'FAIL' }[t.Status] || t.Status;   // SKIPPED / NOT EXECUTED kept as is
    const entry = ledger.tests[id] || (ledger.tests[id] = { history: [] });
    const result = { status, date, run, env, message: firstLine(t.Detail).slice(0, 500), evidence: evidenceFor(runDir, id, t.Test, status === 'FAIL') };
    if (status === 'PASS' || status === 'FAIL') {
      entry.last = result;
      entry.iterations = (entry.iterations || 0) + 1;
      delete entry.lastAttempt;
    } else {
      entry.lastAttempt = result;
    }
    entry.history.unshift({ status, date, run });
    entry.history = entry.history.slice(0, 20);
    n++;
  }
  ledger.runs.push(run);
  return n;
}

// ---------------------------------------------------------------- spec lookup
function specFiles(dir = SPEC_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? specFiles(path.join(dir, e.name)) : e.name.endsWith('.spec.ts') ? [path.join(dir, e.name)] : []);
}
function specIndex() {
  const index = new Map();
  for (const file of specFiles()) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bit\(\s*['"`]([A-Z]+(?:-[A-Z]+)?-\d+)\b/g)) index.set(m[1], rel(file));
  }
  return index;
}

// ---------------------------------------------------------------- test cases workbook
const TC_HEADERS = ['Req. ID #', 'Feature / Module', 'Applicable Role', 'Test Senarios ID #', 'Test Scenarios', 'Test Case ID', 'Test Cases',
  'Pre-requisites', 'Test Environment', 'Test Steps', 'Inputs Data', 'Test Type (Smoke / Functional / Regression / UAT / API)',
  'Test Design (Positive / Negative / Boundary Value / Equivalence Partitioning / Error Handling / Validation)', 'Expected Result',
  'Actual Result', 'Screenshot / Video', 'Status\n(PASS / FAIL)', 'Test Iteration', 'Test Executed By', 'Date of Execution',
  'Mode\n(Manual / Automation)', 'Comments'];
const TC_WIDTHS = [12, 16, 16, 13, 30, 12, 34, 34, 26, 48, 34, 16, 20, 40, 40, 34, 11, 10, 18, 14, 14, 48];

async function buildTestCases(ledger) {
  const specs = specIndex();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SalesHiker Mobile QA automation';
  wb.calcProperties.fullCalcOnLoad = true;
  const summary = wb.addWorksheet('Summary');
  const tally = [];

  for (const mod of modules) {
    const ws = wb.addWorksheet(mod.sheet, { views: [{ state: 'frozen', xSplit: 7, ySplit: 1, topLeftCell: 'H2' }] });
    ws.columns = TC_WIDTHS.map((w) => ({ width: w }));
    ws.addRow(TC_HEADERS);
    styleHeader(ws.getRow(1), 62);
    const counts = { total: 0, PASS: 0, FAIL: 0, auto: 0 };

    for (const tc of [...mod.cases].sort((a, b) => a.id.localeCompare(b.id))) {
      const entry = ledger.tests[tc.id] || {};
      const last = entry.last;
      const spec = specs.get(tc.id);
      let actual = null, evidence = null, status = null, iteration = null, by = null, date = null;
      if (last) {
        status = last.status;
        actual = last.status === 'PASS' ? tc.observed : (last.message || 'Failed (see run report)') + (tc.defect ? `\nDefect: ${tc.defect}` : '');
        const shot = last.evidence && last.evidence[0];
        evidence = shot ? link(shot, 'Screenshot: ' + path.basename(path.dirname(shot)) + '/' + path.basename(shot))
                        : link(`reports/${last.run}/summary.md`, `Run report: ${last.run}`);
        iteration = entry.iterations; by = EXECUTED_BY; date = new Date(last.date);
        counts[last.status]++;
      }
      const comments = [spec ? `Spec: ${spec}` : 'No automated test yet (manual).'];
      if (last) comments.push(`Last result: ${last.status} on ${fmtDate(last.date)}, run ${last.run}${tc.defect ? `, defect ${tc.defect}` : ''}.`);
      if (entry.lastAttempt) comments.push(`Last attempt ${entry.lastAttempt.status.toLowerCase()} on ${fmtDate(entry.lastAttempt.date)} (run ${entry.lastAttempt.run})${entry.lastAttempt.message ? `: ${entry.lastAttempt.message}` : ''}.`);
      if (!last && !entry.lastAttempt) comments.push('Not executed yet.');
      if (entry.history && entry.history.length > 1) comments.push('History (latest first): ' + entry.history.slice(0, 6).map((h) => `${fmtDate(h.date)} ${h.status}`).join(', '));
      if (spec) counts.auto++;
      counts.total++;

      const env = `${BACKEND}\n${(last && last.env) || 'Android device (see run summary)'}`;
      const row = ws.addRow([tc.req, mod.sheet, mod.role, tc.ts, tc.scenario, tc.id, tc.title, tc.pre, env, tc.steps, tc.input,
        tc.type, tc.design, tc.expected, actual, evidence, status, iteration, by, date, spec ? 'Automation' : 'Manual', comments.join('\n')]);
      if (evidence) row.getCell(16).font = LINK_FONT;
      row.getCell(20).numFmt = 'dd-mmm-yyyy';
      styleBody(row, TC_HEADERS.length);
      row.getCell(17).alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    }

    const dvTo = ws.rowCount + 50;   // room for manual rows, like the web sheets
    listValidation(ws, 'L', 2, dvTo, ['Smoke', 'Functional', 'Regression', 'UAT', 'API']);
    listValidation(ws, 'M', 2, dvTo, ['Positive', 'Negative', 'Boundary Value', 'Equivalence Partitioning', 'Error Handling', 'Validation']);
    listValidation(ws, 'Q', 2, dvTo, ['PASS', 'FAIL']);
    listValidation(ws, 'U', 2, dvTo, ['Manual', 'Automation', 'Removed']);
    ws.autoFilter = `A1:V${ws.rowCount}`;
    ws.addConditionalFormatting({ ref: `Q2:Q${dvTo}`, rules: [
      { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"PASS"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } }, font: { bold: true, color: { argb: 'FF006100' } } } },
      { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"FAIL"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { bold: true, color: { argb: 'FF9C0006' } } } },
    ] });
    tally.push({ mod, counts, dvTo });
  }

  // ---- Summary: one formula row per module, then a total
  summary.columns = [24, 15, 15, 15, 15, 15, 15, 15, 15].map((w) => ({ width: w }));
  summary.getCell('A1').value = 'SalesHiker Mobile Test Execution Summary';
  summary.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  summary.getCell('A2').value = `Updated ${fmtDate(new Date())} from ${ledger.runs.length} automated run(s).`;
  summary.getCell('A2').font = { name: 'Arial', size: 9, italic: true };
  const head = summary.getRow(3);
  ['Module', 'Total Test Cases', 'Automation', 'Manual', 'Executed', 'PASS', 'FAIL', 'Not Executed', 'Pass Rate (of executed)'].forEach((h, i) => { head.getCell(i + 1).value = h; });
  head.eachCell((c) => { c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEADER_FILL; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  head.height = 32;
  tally.forEach(({ mod, counts, dvTo }, i) => {
    const r = 4 + i;
    const rng = (col) => `'${mod.sheet}'!${col}2:${col}${dvTo}`;
    const executed = counts.PASS + counts.FAIL;
    const row = summary.getRow(r);
    row.getCell(1).value = { text: mod.label, hyperlink: `#'${mod.sheet}'!A1` };
    row.getCell(2).value = { formula: `C${r}+D${r}`, result: counts.total };
    row.getCell(3).value = { formula: `COUNTIF(${rng('U')},"Automation")`, result: counts.auto };
    row.getCell(4).value = { formula: `COUNTIF(${rng('U')},"Manual")`, result: counts.total - counts.auto };
    row.getCell(5).value = { formula: `F${r}+G${r}`, result: executed };
    row.getCell(6).value = { formula: `COUNTIF(${rng('Q')},"PASS")`, result: counts.PASS };
    row.getCell(7).value = { formula: `COUNTIF(${rng('Q')},"FAIL")`, result: counts.FAIL };
    row.getCell(8).value = { formula: `B${r}-E${r}`, result: counts.total - executed };
    row.getCell(9).value = { formula: `IF(E${r}=0,0,F${r}/E${r})`, result: executed ? counts.PASS / executed : 0 };
  });
  const totalRow = 4 + tally.length;
  const sum = (k) => tally.reduce((a, t) => a + k(t.counts), 0);
  const totals = { 2: sum((c) => c.total), 3: sum((c) => c.auto), 4: sum((c) => c.total - c.auto), 5: sum((c) => c.PASS + c.FAIL), 6: sum((c) => c.PASS), 7: sum((c) => c.FAIL) };
  totals[8] = totals[2] - totals[5];
  const tr = summary.getRow(totalRow);
  tr.getCell(1).value = 'Total';
  'BCDEFGH'.split('').forEach((col, i) => { tr.getCell(i + 2).value = { formula: `SUM(${col}4:${col}${totalRow - 1})`, result: totals[i + 2] }; });
  tr.getCell(9).value = { formula: `IF(E${totalRow}=0,0,F${totalRow}/E${totalRow})`, result: totals[5] ? totals[6] / totals[5] : 0 };
  for (let r = 4; r <= totalRow; r++) {
    const row = summary.getRow(r);
    for (let c = 1; c <= 9; c++) { const cell = row.getCell(c); cell.font = c === 1 && r < totalRow ? LINK_FONT : { name: 'Arial', bold: r === totalRow }; cell.alignment = { horizontal: c === 1 ? 'left' : 'center' }; }
    row.getCell(9).numFmt = '0.0%;-0.0%;-';
  }
  const notes = [
    'Counts are formulas over the Status and Mode columns of each module sheet.',
    'Not Executed = no PASS/FAIL recorded yet (skipped tests and environment aborts are not results; see Comments).',
    'Tests linked to an open defect (MLGN-012, MCMP-012, MCMP-019) are expected to FAIL until it is fixed: their assertions describe the correct behaviour.',
    'Generated by tools\\excel\\update-workbooks.js after every run (scripts\\run-*.ps1). Edit test-case text in tools\\excel\\modules\\*.cases.js, not here.',
    'Credentials are never written to this file; they come from config\\.env (git-ignored).',
  ];
  notes.forEach((t, i) => { const c = summary.getCell(`A${totalRow + 2 + i}`); c.value = t; c.font = { name: 'Arial', size: 9, italic: true }; });

  await wb.xlsx.writeFile(TC_FILE);
  return tally;
}

// ---------------------------------------------------------------- defect tracker workbook
const DT_HEADERS = ['No#', 'Module/Screen / Extension', 'Section / Category', 'Task / Bugs / Enhacement', 'Steps to Reproduce \n(If required)', 'Expected Result',
  'Actual Result', 'Date', 'Issue Type', 'Severity', 'Priority', 'Status', 'Test Environment', 'Screenshot/Video', 'Reopen SS/Video\n&\nDescription',
  'Assigned To', 'Closed / Resolved by', 'Requested by', 'QA Comment', 'Developer / Designer Comment', 'Closed Date'];
const STATUSES = ['Open', 'In Progress', 'Ready for Retest', 'Reopened', 'Closed', "Won't Fix", 'Needs Decision'];
const TRIAGE = ['To triage', 'Test-side issue', 'Environment issue', 'Application defect'];
const cellText = (v) => (v && typeof v === 'object' ? v.text || v.result || '' : v == null ? '' : String(v));

/** Manual fields from the existing tracker: per defect ID, and the triage sheet per test ID. */
async function readManual() {
  const defects = new Map(), triage = new Map();
  if (!fs.existsSync(DT_FILE)) return { defects, triage };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DT_FILE);
  wb.eachSheet((ws) => {
    if (ws.name === 'Summary') return;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (ws.name === 'Failures to triage') {
        const id = cellText(row.getCell(1).value);
        if (id) triage.set(id, { classification: cellText(row.getCell(7).value), notes: cellText(row.getCell(8).value) });
        continue;
      }
      const id = (cellText(row.getCell(4).value).match(/^([A-Z]+-D\d+)/) || [])[1];
      if (id) defects.set(id, { date: row.getCell(8).value, status: cellText(row.getCell(12).value), o: row.getCell(15).value, p: row.getCell(16).value, q: row.getCell(17).value, r: row.getCell(18).value, t: row.getCell(20).value, u: row.getCell(21).value });
    }
  });
  return { defects, triage };
}

function autoStatus(ledger, d, current, changes) {
  const guard = d.guardTest && ledger.tests[d.guardTest] && ledger.tests[d.guardTest].last;
  if (!guard) return current;
  const seen = ledger.defects[d.id] || {};
  if (seen.checkedRun === guard.run) return current;   // this result was already applied
  ledger.defects[d.id] = { checkedRun: guard.run };
  let next = current;
  if (guard.status === 'FAIL' && ['Closed', 'Ready for Retest'].includes(current)) next = 'Reopened';
  if (guard.status === 'PASS' && ['Open', 'Reopened', 'In Progress'].includes(current)) next = 'Ready for Retest';
  if (next !== current) changes.push(`${d.id}: ${current} -> ${next} (${d.guardTest} ${guard.status} in ${guard.run})`);
  return next;
}

// ---------------------------------------------------------------- defect screenshots
// Each defect gets its own `images` (web / exploration screenshots with captions, kept in docs/defect-evidence), the
// exploration screenshots named in its evidence text and the screenshots of the latest failing run of its tests.
const MAX_RUN_SHOTS = { guard: 2, other: 1 };

function defectImages(ledger, d) {
  const out = [];
  for (const im of d.images || []) out.push({ src: path.resolve(ROOT, im.file), caption: im.caption });
  // Exploration dumps named in the evidence text ("reports/explore-x/12-name.xml"): their screenshot (.png) when kept.
  for (const m of (d.evidence || '').matchAll(/reports\/explore-[\w-]+\/[\w.-]+\.(?:xml|png)/g)) {
    const png = path.join(ROOT, m[0].replace(/\.xml$/, '.png'));
    if (fs.existsSync(png) && !out.some((o) => o.src === png)) out.push({ src: png, caption: `Phone (exploration): ${m[0].split('/').slice(-2).join('/').replace(/\.xml$/, '.png')}` });
  }
  const tests = [...new Set([d.guardTest, ...(d.tests || [])].filter(Boolean))];   // the guard test first
  for (const t of tests) {
    const last = ledger.tests[t] && ledger.tests[t].last;
    if (!last || last.status !== 'FAIL') continue;   // a passing run does not show the defect
    const ev = last.evidence || [];
    const ordered = [...ev.filter((e) => !e.includes('/failures/')), ...ev.filter((e) => e.includes('/failures/'))];
    for (const e of ordered.slice(0, t === d.guardTest ? MAX_RUN_SHOTS.guard : MAX_RUN_SHOTS.other)) {
      const what = e.includes('/failures/') ? 'screen at the failure' : path.basename(e, path.extname(e)).replace(`${t}_`, '').replace(/_/g, ' ');
      out.push({ src: path.join(ROOT, e), caption: `Phone, automated run: ${t} (${what}), run ${last.run}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------- defect evidence on Google Drive
// Only defect evidence is stored: every screenshot of a logged defect (listed in EVIDENCE_INDEX with its SHA-256;
// identical copies once) is uploaded as an image into one Google Drive folder, "SalesHiker Mobile QA/SalesHiker Mobile
// Android Defect" (tools/excel/evidence-drive.mjs lists what to upload and records the links in DRIVE_LINKS). Column N
// (Screenshot/Video) links the defect's screenshots; nothing is embedded and no local path is shown. A screenshot that is
// new or changed since its upload counts as not uploaded.
const EVIDENCE_INDEX = path.join(DOCS, 'defect-evidence', 'evidence-index.json');
const DRIVE_LINKS = path.join(__dirname, 'drive-evidence.json');

const sha256 = (file) => require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function writeEvidenceIndex(shots) {
  const out = [];
  for (const mod of modules) for (const d of mod.defects) {
    const images = (shots.get(d.id) || []).filter((im) => fs.existsSync(im.src));
    out.push({ id: d.id, module: mod.label, title: d.title, severity: d.severity,
      images: images.map((im) => ({ file: rel(im.src), caption: im.caption, sha256: sha256(im.src) })) });
  }
  fs.mkdirSync(path.dirname(EVIDENCE_INDEX), { recursive: true });
  fs.writeFileSync(EVIDENCE_INDEX, JSON.stringify(out, null, 2) + '\n');
  return new Map(out.map((e) => [e.id, e]));
}

const driveLinks = () => (fs.existsSync(DRIVE_LINKS) ? JSON.parse(fs.readFileSync(DRIVE_LINKS, 'utf8')).defects || {} : {});

/** The Drive link of one screenshot, when the uploaded copy is the current file. */
function driveImage(links, id, im) {
  const up = links[id] && links[id].images && links[id].images[im.file];
  return up && up.sha256 === im.sha256 ? up.url : null;
}

/** The defect's screenshots not on Drive yet (new, or changed since their upload); identical copies count once. */
const drivePending = (links, entry) => {
  if (!entry) return [];
  const seen = new Set();
  return entry.images.filter((im) => !driveImage(links, entry.id, im) && !seen.has(im.sha256) && seen.add(im.sha256));
};

/**
 * Column N (Screenshot/Video). All screenshots sit in one Drive folder, named "<DEFECT-ID> - <n> - <file>": a defect with
 * one screenshot links that file; with several, a Drive search for the ID in the file names, which lists them all.
 */
function driveCell(links, entry, fallback) {
  if (!entry || !entry.images.length) return fallback;
  const total = new Set(entry.images.map((im) => im.sha256)).size;
  const pending = drivePending(links, entry).length;
  if (pending === total) return 'Screenshots not on Google Drive yet (run npm run evidence:drive)';
  const done = total - pending;
  const urls = [...new Set(entry.images.map((im) => driveImage(links, entry.id, im)).filter(Boolean))];
  const hyperlink = urls.length === 1 ? urls[0] : `https://drive.google.com/drive/search?q=${encodeURIComponent(`title:"${entry.id}"`)}`;
  return { text: `${done} screenshot${done === 1 ? '' : 's'} on Google Drive (click to open)${pending ? `; ${pending} not uploaded yet` : ''}`, hyperlink };
}

async function buildDefects(ledger) {
  const manual = await readManual();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SalesHiker Mobile QA automation';
  wb.calcProperties.fullCalcOnLoad = true;
  const summary = wb.addWorksheet('Summary');
  const changes = [];
  const sheets = [];
  const today = new Date();

  // Screenshots per defect (kept on Google Drive, not embedded in the workbook).
  const shots = new Map();
  for (const mod of modules) for (const d of mod.defects) shots.set(d.id, defectImages(ledger, d).filter((im) => fs.existsSync(im.src)));
  const evidenceIndex = writeEvidenceIndex(shots);
  const links = driveLinks();
  const pendingUploads = [...evidenceIndex.values()].flatMap((e) => drivePending(links, e).map(() => e.id));

  for (const mod of modules) {
    const ws = wb.addWorksheet(mod.sheet, { views: [{ state: 'frozen', xSplit: 4, ySplit: 1, topLeftCell: 'E2' }] });
    ws.columns = [6, 22, 18, 40, 60, 40, 45, 12, 14, 11, 13, 16, 24, 36, 20, 14, 14, 14, 50, 30, 12].map((w) => ({ width: w }));
    ws.addRow(DT_HEADERS);
    styleHeader(ws.getRow(1), 48);
    const tally = { severity: {} };
    mod.defects.forEach((d, i) => {
      const keep = manual.defects.get(d.id) || {};
      const status = autoStatus(ledger, d, keep.status || d.status, changes);
      // Evidence is a link to the defect's Google Drive folder (all its screenshots); no images in the cell, no local paths.
      const evidence = driveCell(links, evidenceIndex.get(d.id), d.evidence || '');
      let qa = d.qaComment;
      const guard = d.guardTest && ledger.tests[d.guardTest];
      if (guard && guard.last) {
        qa += `\nLast automated check: ${fmtDate(guard.last.date)} ${d.guardTest} ${guard.last.status} (run ${guard.last.run})` +
          (guard.last.status === 'FAIL' ? ' - still reproduces.' : ' - no longer reproduces; retest manually before closing.');
      }
      const env = `${BACKEND}; ${(guard && guard.last && guard.last.env) || 'see QA comment'}`;
      const row = ws.addRow([i + 1, mod.label, d.category, `${d.id} - ${d.title}`, d.steps, d.expected, d.actual, keep.date || today,
        d.issueType, d.severity, d.priority, status, env, evidence, keep.o || '', keep.p || '', keep.q || '', keep.r || '', qa, keep.t || '', keep.u || null]);
      styleBody(row, DT_HEADERS.length);
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
      row.getCell(8).numFmt = 'dd-mmm-yyyy';
      row.getCell(21).numFmt = 'dd-mmm-yyyy';
      if (typeof evidence === 'object') row.getCell(14).font = LINK_FONT;
      if (SEVERITY_FILL[d.severity]) row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEVERITY_FILL[d.severity] } };
      tally[status] = (tally[status] || 0) + 1;
      tally.severity[d.severity] = (tally.severity[d.severity] || 0) + 1;
    });
    const dvTo = 202;
    listValidation(ws, 'I', 2, dvTo, ['Bug', 'Enhancement', 'Observation', 'Data Issue', 'Accessibility', 'Needs Decision']);
    listValidation(ws, 'J', 2, dvTo, ['Critical', 'High', 'Medium', 'Low']);
    listValidation(ws, 'K', 2, dvTo, ['P1 - Urgent', 'P2 - High', 'P3 - Medium', 'P4 - Low']);
    listValidation(ws, 'L', 2, dvTo, STATUSES);
    ws.autoFilter = `A1:U${ws.rowCount}`;
    sheets.push({ mod, tally, total: mod.defects.length, dvTo });
  }

  // ---- Failures without a linked defect: classify them here (rules: test-side / environment / app defect)
  const triage = wb.addWorksheet('Failures to triage', { views: [{ state: 'frozen', ySplit: 1 }] });
  triage.columns = [12, 16, 40, 60, 14, 34, 20, 50].map((w) => ({ width: w }));
  triage.addRow(['Test ID', 'Module', 'Test', 'Failure', 'Date', 'Evidence', 'Classification', 'Notes']);
  styleHeader(triage.getRow(1), 30);
  let open = 0;
  for (const mod of modules) {
    for (const tc of mod.cases) {
      const last = ledger.tests[tc.id] && ledger.tests[tc.id].last;
      if (!last || last.status !== 'FAIL' || tc.defect) continue;
      const keep = manual.triage.get(tc.id) || {};
      const ev = last.evidence && last.evidence[0] ? link(last.evidence[0], 'Screenshot') : link(`reports/${last.run}/summary.md`, last.run);
      const row = triage.addRow([tc.id, mod.sheet, tc.title, last.message, new Date(last.date), ev, keep.classification || 'To triage', keep.notes || '']);
      styleBody(row, 8);
      row.getCell(5).numFmt = 'dd-mmm-yyyy';
      row.getCell(6).font = LINK_FONT;
      open++;
    }
  }
  listValidation(triage, 'G', 2, Math.max(triage.rowCount, 2) + 20, TRIAGE);
  if (!open) triage.addRow(['No failed test without a linked defect.']);

  // ---- Summary (same columns and formulas as the web tracker)
  summary.columns = [48, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12].map((w) => ({ width: w }));
  summary.addRow(['Module', 'Total', ...STATUSES, 'Critical', 'High', 'Medium', 'Low']);
  summary.getRow(1).eachCell((c) => { c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEADER_FILL; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheets.forEach(({ mod, tally, total, dvTo }, i) => {
    const row = summary.getRow(2 + i);
    row.getCell(1).value = { text: mod.label, hyperlink: `#'${mod.sheet}'!A1` };
    row.getCell(1).font = LINK_FONT;
    row.getCell(2).value = { formula: `COUNTA('${mod.sheet}'!$D$2:$D$${dvTo})`, result: total };
    STATUSES.forEach((s, j) => { row.getCell(3 + j).value = { formula: `COUNTIF('${mod.sheet}'!$L$2:$L$${dvTo},"${s.replace(/"/g, '""')}")`, result: tally[s] || 0 }; });
    ['Critical', 'High', 'Medium', 'Low'].forEach((s, j) => { row.getCell(10 + j).value = { formula: `COUNTIF('${mod.sheet}'!$J$2:$J$${dvTo},"${s}")`, result: tally.severity[s] || 0 }; });
    for (let c = 2; c <= 13; c++) { row.getCell(c).font = { name: 'Arial' }; row.getCell(c).alignment = { horizontal: 'center' }; }
  });
  const tRow = summary.getRow(2 + sheets.length);
  tRow.getCell(1).value = 'Total';
  for (let c = 2; c <= 13; c++) {
    const col = String.fromCharCode(64 + c);
    const result = sheets.reduce((a, _, i) => a + (summary.getRow(2 + i).getCell(c).value.result || 0), 0);
    tRow.getCell(c).value = { formula: `SUM(${col}2:${col}${1 + sheets.length})`, result };
    tRow.getCell(c).alignment = { horizontal: 'center' };
  }
  tRow.eachCell((c) => { c.font = { name: 'Arial', bold: true }; });
  const note = summary.getCell(`A${4 + sheets.length}`);
  note.value = `Failures to triage (no linked defect): ${open}. Status and columns O-U are kept between updates; a defect with a guard test moves to "Ready for Retest" or "Reopened" automatically (see tools\\excel\\update-workbooks.js).`;
  note.font = { name: 'Arial', size: 9, italic: true };

  await wb.xlsx.writeFile(DT_FILE);
  return { total: sheets.reduce((a, s) => a + s.total, 0), kept: manual.defects.size, changes, open, pendingUploads };
}

// ---------------------------------------------------------------- Google Drive copy (Google Drive for desktop)
const DRIVE_FOLDER_NAME = 'SalesHiker Mobile QA';

/** DRIVE_SYNC_DIR from the shell, config/.env or config/.env.example (same precedence as src/config/settings.ts). */
function driveSetting() {
  if (process.env.DRIVE_SYNC_DIR !== undefined) return process.env.DRIVE_SYNC_DIR.trim();
  let value = '';
  for (const name of ['.env.example', '.env']) {
    const file = path.join(ROOT, 'config', name);
    if (!fs.existsSync(file)) continue;
    const m = fs.readFileSync(file, 'utf8').match(/^[ \t]*DRIVE_SYNC_DIR[ \t]*=[ \t]*(.*)$/m); // [ \t], not \s: an empty value must not read the next line
    if (m) value = m[1].trim().replace(/^["']|["']$/g, '');
  }
  return value;
}

/** The Drive folder to copy into, or '' when there is none: the setting, else "<X>:\My Drive\SalesHiker Mobile QA". */
function driveFolder() {
  const setting = driveSetting();
  if (/^off$/i.test(setting)) return '';
  if (setting) return setting;
  for (const letter of 'GHIJKLMNOPQRSTUVWXYZDEF') {
    const myDrive = `${letter}:\\My Drive`;
    if (fs.existsSync(myDrive)) return path.join(myDrive, DRIVE_FOLDER_NAME);
  }
  return '';
}

/** Copies both workbooks into the Drive folder (same file names, so Drive keeps the same files and links). */
function copyToDrive() {
  const folder = driveFolder();
  if (!folder) { console.log('Google Drive copy: skipped (Google Drive for desktop not found; set DRIVE_SYNC_DIR in config\\.env)'); return; }
  try {
    fs.mkdirSync(folder, { recursive: true });
    for (const file of [DT_FILE, TC_FILE]) fs.copyFileSync(file, path.join(folder, path.basename(file)));
    console.log(`Google Drive copy: ${path.basename(DT_FILE)}, ${path.basename(TC_FILE)} -> ${folder}`);
  } catch (e) {
    // A copy open in Excel from the Drive folder is locked; the next update copies again.
    console.warn(`Google Drive copy failed (${e.code || e.message}); it is retried on the next update: ${folder}`);
  }
}

// ---------------------------------------------------------------- main
(async () => {
  const ledger = loadLedger();
  for (const dir of process.argv.slice(2)) {
    const n = ingest(ledger, path.resolve(dir));
    if (n) console.log(`Added ${n} result(s) from ${path.basename(dir)}`);
  }
  const defectChecks = JSON.stringify(ledger.defects);
  try {
    const tally = await buildTestCases(ledger);
    const dt = await buildDefects(ledger);
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');   // after the defect pass recorded its checks
    for (const { mod, counts } of tally) {
      console.log(`${mod.sheet}: ${counts.total} cases - PASS ${counts.PASS}, FAIL ${counts.FAIL}, not executed ${counts.total - counts.PASS - counts.FAIL}`);
    }
    console.log(`Test cases -> ${TC_FILE}`);
    console.log(`Defects: ${dt.total} (manual fields kept for ${dt.kept}); failures to triage: ${dt.open} -> ${DT_FILE}`);
    for (const c of dt.changes) console.log(`Defect status changed: ${c}`);
    console.log(dt.pendingUploads.length
      ? `Drive evidence: ${dt.pendingUploads.length} screenshot(s) to upload (npm run evidence:drive lists them): ${[...new Set(dt.pendingUploads)].join(', ')}`
      : 'Drive evidence: every defect screenshot is on Google Drive');
    if (!process.env.QA_DOCS_DIR) copyToDrive();   // not for trial output (QA_DOCS_DIR)
    // Rebuild the framework overview from the new results (npm run excel; the runner calls it separately).
    if (!process.env.SKIP_DOCS) {
      const { execFileSync } = require('child_process');
      try { process.stdout.write(execFileSync(process.execPath, [path.join(ROOT, 'tools', 'docs', 'framework-overview.mjs')], { encoding: 'utf8' })); }
      catch (e) { console.warn('Framework overview not rebuilt: ' + String(e.message).split('\n')[0]); }
    }
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      ledger.defects = JSON.parse(defectChecks);   // status moves not written yet: apply them on the next update
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');
      console.error(`A workbook is open in Excel (${e.path}). Results are saved in the ledger; close Excel and run: npm run excel`);
      process.exit(3);
    }
    throw e;
  }
})().catch((e) => { console.error(e); process.exit(1); });
