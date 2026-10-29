// Builds docs/SalesHiker_Mobile_Test_Cases.xlsx and docs/SalesHiker_Mobile_Defect_Tracker.xlsx
// from login-test-cases.js, login-defects.js and the results of one run folder.
// Layout, styles, dropdowns and Summary formulas mirror the web project's workbooks
// (D:\QA\Automation\SalesHiker\docs) so both read the same way.
//
// Usage: node build-login-workbooks.js <reports\<run> folder> [<another run folder> ...]
// Later folders win when several contain a result for the same test.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT = path.resolve(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs');
const TC_FILE = path.join(DOCS, 'SalesHiker_Mobile_Test_Cases.xlsx');
const DT_FILE = path.join(DOCS, 'SalesHiker_Mobile_Defect_Tracker.xlsx');
const cases = require('./login-test-cases');
const defects = require('./login-defects');

const ENVIRONMENT = 'Beta backend: accountsbeta.saleshiker.com\nAndroid 15 emulator (SalesHiker_API35, Pixel 7, x86_64)\nApp: com.saleshiker.app 1.0.0 (saleshiker-beta-2026-10-28.apk)';
const ENV_SHORT = 'Beta - Android 15 emulator, app 1.0.0';

// ---------------------------------------------------------------- styles (from the web template)
const FONT = { name: 'Arial', size: 10 };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const HEADER_FONT = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
const BORDER_SIDE = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER = { left: BORDER_SIDE, right: BORDER_SIDE, top: BORDER_SIDE, bottom: BORDER_SIDE };
const LINK_FONT = { name: 'Arial', size: 10, underline: true, color: { argb: 'FF0563C1' } };
const SEVERITY_FILL = { Critical: 'FFC00000', High: 'FFFF6D6D', Medium: 'FFFFC000', Low: 'FF92D050' };

// ---------------------------------------------------------------- results
function readResults(runDirs) {
  const results = new Map();
  for (const runDir of runDirs) {
    const junit = path.join(runDir, 'junit.xml');
    if (!fs.existsSync(junit)) { console.warn(`no junit.xml in ${runDir}`); continue; }
    const xml = fs.readFileSync(junit, 'utf8');
    const suiteTs = (xml.match(/<testsuite [^>]*timestamp="([^"]+)"/) || [])[1];
    const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
    let m;
    while ((m = re.exec(xml))) {
      const attrs = m[1];
      const name = decode((attrs.match(/\bname="([^"]*)"/) || [])[1] || '');
      const ts = (attrs.match(/\btimestamp="([^"]*)"/) || [])[1] || suiteTs;
      const body = m[3] || '';
      const failure = body.match(/<(failure|error)\b[^>]*?(?:message="([^"]*)")?[^>]*>([\s\S]*?)<\/\1>|<(failure|error)\b[^>]*?message="([^"]*)"[^>]*\/>/);
      const skipped = /<skipped\b/.test(body);
      const message = failure ? decode((failure[2] || failure[3] || failure[5] || '').trim()) : '';
      let status = failure ? 'FAIL' : skipped ? 'SKIPPED' : 'PASS';
      // A device dropping out mid-run means the test never really ran (same rule as the runner).
      if (status === 'FAIL' && envFailure(runDir, name)) status = 'ENV';
      const previous = results.get(name);
      // A real result from an earlier folder is not replaced by a later environment abort.
      if (status === 'ENV' && previous && previous.status !== 'ENV') continue;
      results.set(name, { status, message, date: ts ? new Date(ts) : new Date(), runDir });
    }
  }
  return results;
}

const ENV_FAILURE = /DeviceServerDiedException|host:transport:[^)]*\): device offline|Maestro Android driver did not start/;
function envFailure(runDir, flowName) {
  const artifacts = path.join(runDir, 'artifacts');
  if (!fs.existsSync(artifacts)) return false;
  for (const ts of fs.readdirSync(artifacts)) {
    const log = path.join(artifacts, ts, flowName, 'logs', 'maestro.log');
    if (fs.existsSync(log) && ENV_FAILURE.test(fs.readFileSync(log, 'utf8'))) return true;
  }
  return false;
}

function findFile(dir, fileName) {
  if (!dir || !fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { const hit = findFile(full, fileName); if (hit) return hit; }
    else if (entry.name === fileName) return full;
  }
  return null;
}

// Relative to docs/, so the hyperlink works wherever the project folder is copied.
const linkTo = (file) => path.relative(DOCS, file).split(path.sep).join('/');
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

// Keep the first line of a Maestro failure: "Element not found: ..." / "Assertion is false: ..."
const shortFailure = (msg) => msg.split('\n').map((l) => l.trim()).filter(Boolean)[0] || 'Failed (see report)';

// ---------------------------------------------------------------- helpers
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

// ---------------------------------------------------------------- test cases workbook
async function buildTestCases(results) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SalesHiker Mobile QA automation';
  wb.calcProperties.fullCalcOnLoad = true;

  const summary = wb.addWorksheet('Summary');
  const ws = wb.addWorksheet('Login', { views: [{ state: 'frozen', xSplit: 7, ySplit: 1, topLeftCell: 'H2' }] });
  const notes = wb.addWorksheet('Notes');

  // ---- Login sheet
  const headers = ['Req. ID #', 'Feature / Module', 'Applicable Role', 'Test Senarios ID #', 'Test Scenarios', 'Test Case ID', 'Test Cases',
    'Pre-requisites', 'Test Environment', 'Test Steps', 'Inputs Data', 'Test Type (Smoke / Functional / Regression / UAT / API)',
    'Test Design (Positive / Negative / Boundary Value / Equivalence Partitioning / Error Handling / Validation)', 'Expected Result',
    'Actual Result', 'Screenshot / Video', 'Status\n(PASS / FAIL)', 'Test Iteration', 'Test Executed By', 'Date of Execution',
    'Mode\n(Manual / Automation)', 'Comments'];
  const widths = [12, 16, 16, 13, 30, 12, 34, 34, 26, 48, 34, 16, 20, 40, 40, 34, 11, 10, 18, 14, 14, 42];
  ws.columns = widths.map((w) => ({ width: w }));
  ws.addRow(headers);
  styleHeader(ws.getRow(1), 62);

  const counts = { PASS: 0, FAIL: 0, total: 0 };
  const sorted = [...cases].sort((a, b) => a.id.localeCompare(b.id));
  for (const tc of sorted) {
    const res = results.get(tc.flow);
    const shot = res ? findFile(path.join(res.runDir, 'artifacts'), tc.shot) : null;
    const video = res ? findFile(path.join(res.runDir, 'artifacts'), tc.id + '.mp4') : null;
    let actual = null, status = null, evidence = null, iteration = null, by = null, date = null, comment;
    const runLabel = res ? `${path.basename(res.runDir)}` : '';
    if (res && res.status === 'PASS') {
      actual = tc.observed; status = 'PASS'; evidence = shot ? { text: 'Screenshot: ' + path.basename(shot), hyperlink: linkTo(shot) } : 'N/A (passed)';
    } else if (res && res.status === 'FAIL') {
      actual = shortFailure(res.message) + (tc.defect ? `\nDefect: ${tc.defect}` : '');
      status = 'FAIL';
      const failShotDir = path.join(res.runDir, 'artifacts');
      evidence = shot ? { text: 'Screenshot: ' + path.basename(shot), hyperlink: linkTo(shot) } : { text: 'Run report: ' + runLabel, hyperlink: linkTo(path.join(res.runDir, 'summary.md')) };
      if (!fs.existsSync(failShotDir)) evidence = 'See ' + runLabel;
    }
    if (res && (res.status === 'PASS' || res.status === 'FAIL')) {
      iteration = 1; by = 'Automation Suite (Maestro)'; date = res.date;
      counts[res.status]++;
      comment = `Flow: ${tc.file}\nLast automated run: ${fmtDate(res.date)} ${res.status} (emulator-5554, Android 15) - ${runLabel}` + (tc.defect ? ` - defect ${tc.defect}` : '');
    } else if (res && res.status === 'ENV') {
      comment = `Flow: ${tc.file}\nNot executed: the device went offline during run ${runLabel} (environment, not a product result).`;
    } else {
      comment = `Flow: ${tc.file}\nNot executed in the selected run(s).`;
    }
    if (video) comment += `\nVideo: ${linkTo(video)}`;
    counts.total++;
    const row = ws.addRow([tc.req, 'Login', 'Workspace user (mobile app)', tc.ts, tc.scenario, tc.id, tc.title, tc.pre, ENVIRONMENT, tc.steps, tc.input,
      tc.type, tc.design, tc.expected, actual, evidence, status, iteration, by, date, 'Automation', comment]);
    if (evidence && typeof evidence === 'object') row.getCell(16).font = LINK_FONT;
    row.getCell(20).numFmt = 'dd-mmm-yyyy';
    styleBody(row, headers.length);
    row.getCell(17).alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
  }
  const lastRow = ws.rowCount;
  const dvTo = lastRow + 50;   // like the web sheets: room for new rows
  listValidation(ws, 'L', 2, dvTo, ['Smoke', 'Functional', 'Regression', 'UAT', 'API']);
  listValidation(ws, 'M', 2, dvTo, ['Positive', 'Negative', 'Boundary Value', 'Equivalence Partitioning', 'Error Handling', 'Validation']);
  listValidation(ws, 'Q', 2, dvTo, ['PASS', 'FAIL']);
  listValidation(ws, 'U', 2, dvTo, ['Manual', 'Automation', 'Removed']);
  ws.autoFilter = `A1:V${lastRow}`;
  ws.addConditionalFormatting({ ref: `Q2:Q${dvTo}`, rules: [
    { type: 'cellIs', operator: 'equal', priority: 1, formulae: ['"PASS"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } }, font: { bold: true, color: { argb: 'FF006100' } } } },
    { type: 'cellIs', operator: 'equal', priority: 2, formulae: ['"FAIL"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { bold: true, color: { argb: 'FF9C0006' } } } },
  ] });

  // ---- Summary sheet (formulas over Status and Mode, cached results included)
  summary.columns = [14, 15, 15, 15, 15, 15, 15, 15, 15].map((w) => ({ width: w }));
  summary.getCell('A1').value = 'SalesHiker Mobile Test Execution Summary';
  summary.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  const sHead = summary.getRow(3);
  ['Module', 'Total Test Cases', 'Automation', 'Manual', 'Executed', 'PASS', 'FAIL', 'Not Executed', 'Pass Rate (of executed)'].forEach((h, i) => { sHead.getCell(i + 1).value = h; });
  sHead.eachCell((c) => { c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEADER_FILL; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sHead.height = 32;
  const rng = (col) => `'Login'!${col}2:${col}${dvTo}`;
  const executed = counts.PASS + counts.FAIL;
  const r4 = summary.getRow(4);
  r4.getCell(1).value = 'Login';
  r4.getCell(2).value = { formula: 'C4+D4', result: counts.total };
  r4.getCell(3).value = { formula: `COUNTIF(${rng('U')},"Automation")`, result: counts.total };
  r4.getCell(4).value = { formula: `COUNTIF(${rng('U')},"Manual")`, result: 0 };
  r4.getCell(5).value = { formula: 'F4+G4', result: executed };
  r4.getCell(6).value = { formula: `COUNTIF(${rng('Q')},"PASS")`, result: counts.PASS };
  r4.getCell(7).value = { formula: `COUNTIF(${rng('Q')},"FAIL")`, result: counts.FAIL };
  r4.getCell(8).value = { formula: 'B4-E4', result: counts.total - executed };
  r4.getCell(9).value = { formula: 'IF(E4=0,0,F4/E4)', result: executed ? counts.PASS / executed : 0 };
  const r5 = summary.getRow(5);
  r5.getCell(1).value = 'Total';
  'BCDEFGH'.split('').forEach((col, i) => { r5.getCell(i + 2).value = { formula: `SUM(${col}4:${col}4)`, result: r4.getCell(i + 2).value.result }; });
  r5.getCell(9).value = { formula: 'IF(E5=0,0,F5/E5)', result: r4.getCell(9).value.result };
  for (const row of [r4, r5]) {
    for (let c = 1; c <= 9; c++) { const cell = row.getCell(c); cell.font = { name: 'Arial', bold: row === r5 }; cell.alignment = { horizontal: c === 1 ? 'left' : 'center' }; }
    row.getCell(9).numFmt = '0.0%;-0.0%;-';
  }
  const note = (r, text) => { const c = summary.getCell(`A${r}`); c.value = text; c.font = { name: 'Arial', size: 9, italic: true }; };
  note(7, 'Counts update automatically when the Status or Mode columns on the Login sheet change.');
  note(8, 'Not Executed = cases with no PASS/FAIL in the selected run (for example, skipped because credentials were missing).');
  note(9, 'MLGN-012 is expected to FAIL until defect MLGN-D01 is fixed: its assertions describe the correct behaviour and must not be relaxed.');

  // ---- Notes sheet
  notes.columns = [{ width: 28 }, { width: 110 }];
  const noteRows = [
    ['How to use this workbook', ''],
    ['Generated file', 'Rebuilt by tools\\excel\\build-login-workbooks.js from tools\\excel\\login-test-cases.js and the selected run folder(s). Edit test-case text in login-test-cases.js, not here, or it is overwritten on the next build.'],
    ['Columns filled from the run', 'Actual Result, Screenshot / Video, Status, Test Iteration, Test Executed By, Date of Execution, Comments.'],
    ['Summary sheet', 'Counts are formulas over the Status and Mode columns of the Login sheet.'],
    ['Test Executed By', '"Automation Suite (Maestro)" means the Maestro flows in .maestro\\flows of this project, run with scripts\\run-regression.ps1 -Tags login. Evidence (screenshots, video, logs, junit.xml) is under reports\\<timestamp>-<suite>\\.'],
    ['Test Environment', ENVIRONMENT.replace(/\n/g, '; ')],
    ['Credentials', 'Credentials are never written in this file. They come from config\\.env (git-ignored), and the runner redacts the password from all text reports.'],
    ['Test Iteration', '1 = first execution cycle. 2 = re-test after a failure.'],
    ['Relation to the web workbook', 'Same columns and conventions as D:\\QA\\Automation\\SalesHiker\\docs\\test-cases\\SalesHiker_Test_Cases.xlsx (web app). Mobile IDs use the MLGN- prefix so they never clash with the web LGN- IDs.'],
    ['Defects', 'See docs\\SalesHiker_Mobile_Defect_Tracker.xlsx (sheet Login). IDs: MLGN-Dnn.'],
  ];
  noteRows.forEach(([a, b], i) => {
    const row = notes.getRow(i + 1);
    row.getCell(1).value = a; row.getCell(2).value = b;
    row.getCell(1).font = { name: 'Arial', bold: true, size: i === 0 ? 12 : 10 };
    row.getCell(2).font = { name: 'Arial', size: 10 };
    row.getCell(1).alignment = row.getCell(2).alignment = { vertical: 'top', wrapText: true };
  });

  await wb.xlsx.writeFile(TC_FILE);
  return counts;
}

// ---------------------------------------------------------------- defect tracker workbook
async function buildDefects(runDirs) {
  // Keep manual triage fields from an existing tracker.
  const manual = new Map();
  if (fs.existsSync(DT_FILE)) {
    const old = new ExcelJS.Workbook();
    await old.xlsx.readFile(DT_FILE);
    const sheet = old.getWorksheet('Login');
    if (sheet) {
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const title = String(row.getCell(4).value || '');
        const id = (title.match(/^(MLGN-D\d+)/) || [])[1];
        if (id) manual.set(id, { status: row.getCell(12).value, o: row.getCell(15).value, p: row.getCell(16).value, q: row.getCell(17).value, r: row.getCell(18).value, t: row.getCell(20).value, u: row.getCell(21).value });
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SalesHiker Mobile QA automation';
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet('Login', { views: [{ state: 'frozen', xSplit: 4, ySplit: 1, topLeftCell: 'E2' }] });
  const summary = wb.addWorksheet('Summary');

  const headers = ['No#', 'Module/Screen / Extension', 'Section / Category', 'Task / Bugs / Enhacement', 'Steps to Reproduce \n(If required)', 'Expected Result',
    'Actual Result', 'Date', 'Issue Type', 'Severity', 'Priority', 'Status', 'Test Environment', 'Screenshot/Video', 'Reopen SS/Video\n&\nDescription',
    'Assigned To', 'Closed / Resolved by', 'Requested by', 'QA Comment', 'Developer / Designer Comment', 'Closed Date'];
  ws.columns = [6, 22, 18, 40, 60, 40, 45, 12, 14, 11, 13, 16, 24, 36, 20, 14, 14, 14, 45, 30, 12].map((w) => ({ width: w }));
  ws.addRow(headers);
  styleHeader(ws.getRow(1), 48);

  const today = new Date();
  const tally = { Open: 0, 'Needs Decision': 0, Closed: 0, other: 0, severity: {} };
  defects.forEach((d, i) => {
    let shots = [];
    for (const runDir of runDirs) for (const s of d.evidenceShots || []) { const f = findFile(path.join(runDir, 'artifacts'), s); if (f) shots.push(f); }
    shots = [...new Set(shots)];
    const keep = manual.get(d.id) || {};
    const status = keep.status || d.status;
    const evidence = shots.length
      ? { text: shots.map((f) => 'Screenshot: ' + path.basename(f)).join('\n'), hyperlink: linkTo(shots[shots.length - 1]) }
      : (d.evidence || '');
    const row = ws.addRow([i + 1, 'Login (mobile sign-in)', d.category, `${d.id} - ${d.title}`, d.steps, d.expected, d.actual, today,
      d.issueType, d.severity, d.priority, status, ENV_SHORT, evidence, keep.o || '', keep.p || '', keep.q || '', keep.r || '', d.qaComment, keep.t || '', keep.u || null]);
    styleBody(row, headers.length);
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    row.getCell(8).numFmt = 'dd-mmm-yyyy';
    row.getCell(21).numFmt = 'dd-mmm-yyyy';
    if (typeof evidence === 'object') row.getCell(14).font = LINK_FONT;
    if (SEVERITY_FILL[d.severity]) row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SEVERITY_FILL[d.severity] } };
    tally[status] = (tally[status] || 0) + 1;
    tally.severity[d.severity] = (tally.severity[d.severity] || 0) + 1;
  });
  const lastDefectRow = ws.rowCount;
  const dvTo = 202;   // same row capacity as the web tracker's Login sheet
  listValidation(ws, 'I', 2, dvTo, ['Bug', 'Enhancement', 'Observation', 'Data Issue', 'Accessibility', 'Needs Decision']);
  listValidation(ws, 'J', 2, dvTo, ['Critical', 'High', 'Medium', 'Low']);
  listValidation(ws, 'K', 2, dvTo, ['P1 - Urgent', 'P2 - High', 'P3 - Medium', 'P4 - Low']);
  listValidation(ws, 'L', 2, dvTo, ['Open', 'In Progress', 'Ready for Retest', 'Reopened', 'Closed', "Won't Fix", 'Needs Decision']);
  ws.autoFilter = `A1:U${lastDefectRow}`;

  // ---- Summary (same columns and formulas as the web tracker)
  summary.columns = [48, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12].map((w) => ({ width: w }));
  const sh = ['Module', 'Total', 'Open', 'In Progress', 'Ready for Retest', 'Reopened', 'Closed', "Won't Fix", 'Needs Decision', 'Critical', 'High', 'Medium', 'Low'];
  summary.addRow(sh);
  summary.getRow(1).eachCell((c) => { c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = HEADER_FILL; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  const row = summary.getRow(2);
  row.getCell(1).value = { text: 'Login (mobile sign-in)', hyperlink: "#'Login'!A1" };
  row.getCell(1).font = { name: 'Arial', underline: true, color: { argb: 'FF0563C1' } };
  row.getCell(2).value = { formula: `COUNTA('Login'!$D$2:$D$${dvTo})`, result: defects.length };
  ['Open', 'In Progress', 'Ready for Retest', 'Reopened', 'Closed', "Won't Fix", 'Needs Decision'].forEach((s, i) => {
    row.getCell(3 + i).value = { formula: `COUNTIF('Login'!$L$2:$L$${dvTo},"${s.replace(/"/g, '""')}")`, result: tally[s] || 0 };
  });
  ['Critical', 'High', 'Medium', 'Low'].forEach((s, i) => {
    row.getCell(10 + i).value = { formula: `COUNTIF('Login'!$J$2:$J$${dvTo},"${s}")`, result: tally.severity[s] || 0 };
  });
  for (let c = 2; c <= 13; c++) { row.getCell(c).font = { name: 'Arial' }; row.getCell(c).alignment = { horizontal: 'center' }; }

  await wb.xlsx.writeFile(DT_FILE);
  return { total: defects.length, kept: manual.size };
}

(async () => {
  const runDirs = process.argv.slice(2).map((p) => path.resolve(p));
  if (!runDirs.length) { console.error('Usage: node build-login-workbooks.js <reports\\run folder> [...]'); process.exit(2); }
  const results = readResults(runDirs);
  const counts = await buildTestCases(results);
  const dt = await buildDefects(runDirs);
  console.log(`Test cases: ${counts.total} (PASS ${counts.PASS}, FAIL ${counts.FAIL}, not executed ${counts.total - counts.PASS - counts.FAIL}) -> ${TC_FILE}`);
  console.log(`Defects: ${dt.total} (manual fields kept for ${dt.kept}) -> ${DT_FILE}`);
  const unmatched = cases.filter((c) => !results.has(c.flow)).map((c) => c.id);
  if (unmatched.length) console.log(`No result for: ${unmatched.join(', ')}`);
})().catch((e) => { console.error(e); process.exit(1); });
