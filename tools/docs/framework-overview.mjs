#!/usr/bin/env node
/**
 * Builds the printable "SalesHiker Mobile QA Automation Framework" overview:
 * docs/SalesHiker_Mobile_QA_Automation_Framework.html and .pdf (cover, summary, stack, how it works,
 * kinds of tests and safety, scope, results snapshot, appendix). Same layout as the web project's
 * docs/SalesHiker_QA_Automation_Framework.pdf.
 *
 * Every number comes from the repository when the document is built: test titles in test/specs, results
 * in docs/test-execution-ledger.json, test cases and defects in tools/excel/modules, defect status from
 * the defect tracker workbook (manual edits included), recent runs from reports/<run>/results.json and
 * versions from package.json and the installed Appium. Nothing is invented: missing data is shown as
 * "Not available" or "Not run". No credentials, phone numbers or contact names are written.
 *
 *   node tools/docs/framework-overview.mjs           rebuild (only when the content changed)
 *   node tools/docs/framework-overview.mjs --check   report only; exit 1 when out of date
 *   node tools/docs/framework-overview.mjs --watch   rebuild whenever specs, pages, modules or results change
 *
 * Rebuilt automatically after every run (scripts\_common.ps1) and by npm run excel.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, watch } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(ROOT, 'package.json'));
const DOCS = join(ROOT, 'docs');
const HTML_FILE = join(DOCS, 'SalesHiker_Mobile_QA_Automation_Framework.html');
const PDF_FILE = join(DOCS, 'SalesHiker_Mobile_QA_Automation_Framework.pdf');
const LEDGER = join(DOCS, 'test-execution-ledger.json');
const TRACKER = join(DOCS, 'SalesHiker_Mobile_Defect_Tracker.xlsx');
const STAMP = /<!-- built: [^>]* -->/;
const ID = /^([A-Z]+(?:-[A-Z]+)?-\d+)/;
// Tests whose IDs are not covered by a workbook module.
const EXTRA_MODULES = { 'REG-NAV': 'Navigation (before sign-in)' };
const OPEN = (s) => !['Closed', "Won't Fix"].includes(s);
const SEV = ['Critical', 'High', 'Medium', 'Low'];

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const code = (t) => `<code>${esc(t)}</code>`;
const right = (t) => `<span style="float:right">${t}</span>`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not available');
const table = (head, rows, cls = '') => `<table class="${cls}">${head.length ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
// Windows .cmd shims (appium) need cmd /c; plain executables (git, adb) run directly.
const run = (cmd, args) => { try { return execFileSync(process.platform === 'win32' && cmd === 'appium' ? 'cmd' : cmd, process.platform === 'win32' && cmd === 'appium' ? ['/c', cmd, ...args] : args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const git = (...args) => run('git', args);
const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ---------------------------------------------------------------- data
function specTests() {
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith('.spec.ts')) files.push(f); } };
  walk(join(ROOT, 'test', 'specs'));
  const tests = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const starts = [...text.matchAll(/\bit\(\s*['"`]([A-Z]+(?:-[A-Z]+)?-\d+) ([^'"`]+)['"`]/g)];
    starts.forEach((m, i) => {
      const body = text.slice(m.index, starts[i + 1]?.index ?? text.length);
      tests.push({
        id: m[1], title: m[2], file: rel(file),
        suite: file.includes(`${sep}smoke${sep}`) ? 'smoke' : 'regression',
        needsAccount: /requiresAccount\(\)/.test(text),
        dataDependent: /skipBecause\(/.test(body),
        sends: /confirmSend\(\)/.test(body),
      });
    });
  }
  return { tests, specCount: files.length };
}

function defectStatuses() {
  // Status as kept in the tracker (manual triage and automatic moves), read from the workbook.
  const statuses = new Map();
  if (!existsSync(TRACKER)) return Promise.resolve(statuses);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.readFile(TRACKER).then(() => {
    wb.eachSheet((ws) => {
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const id = (String(row.getCell(4).value ?? '').match(/^([A-Z]+-D\d+)/) || [])[1];
        if (id) statuses.set(id, String(row.getCell(12).value ?? ''));
      }
    });
    return statuses;
  }, () => statuses);
}

function recentRuns(limit = 6) {
  const dir = join(ROOT, 'reports');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => ({ name, data: readJson(join(dir, name, 'results.json')) }))
    .filter((r) => r.data?.meta?.started)
    .map(({ name, data }) => {
      const tests = [].concat(data.tests || []);
      const n = (s) => tests.filter((t) => t.Status === s).length;
      return { name, label: data.meta.label, started: data.meta.started, device: data.meta.device, app: data.meta.app, passed: n('PASSED'), failed: n('FAILED'), skipped: n('SKIPPED'), notRun: n('NOT EXECUTED') };
    })
    .sort((a, b) => b.started.localeCompare(a.started))
    .slice(0, limit);
}

function versions() {
  const pkg = readJson(join(ROOT, 'package.json')) || {};
  const dev = { ...pkg.dependencies, ...pkg.devDependencies };
  const v = (name) => (dev[name] || 'Not available').replace(/^[\^~]/, '');
  const driver = readJson(join(homedir(), '.appium', 'node_modules', 'appium-uiautomator2-driver', 'package.json'));
  return {
    wdio: v('webdriverio'), typescript: v('typescript'), mocha: v('@wdio/mocha-framework'), chai: v('chai'), allure: v('allure-commandline'),
    exceljs: v('exceljs'), dotenv: v('dotenv'), node: process.version.replace(/^v/, ''),
    appium: run('appium', ['--version']) || 'Not available', uia2: driver?.version || 'Not available',
    adb: (run('adb', ['version']).match(/Version ([\d.]+)/) || [])[1] || 'Not available',
  };
}

async function collect() {
  const modules = require(join(ROOT, 'tools', 'excel', 'modules'));
  const ledger = readJson(LEDGER) || { runs: [], tests: {} };
  const { tests, specCount } = specTests();
  const statuses = await defectStatuses();
  const defects = modules.flatMap((m) => m.defects.map((d) => ({ ...d, module: m.label, status: statuses.get(d.id) || d.status })));
  const prefixOf = (id) => id.replace(/-\d+$/, '');
  const moduleByPrefix = new Map(modules.map((m) => [prefixOf(m.cases[0].id), m]));
  const groups = new Map();
  for (const t of tests) {
    const p = prefixOf(t.id);
    const name = moduleByPrefix.get(p)?.label || EXTRA_MODULES[p] || `Other (${p})`;
    if (!groups.has(name)) groups.set(name, { name, prefix: p, tests: [], cases: moduleByPrefix.get(p)?.cases || [] });
    groups.get(name).tests.push(t);
  }
  const last = (id) => ledger.tests[id]?.last;
  const perModule = [...groups.values()].map((g) => {
    const results = g.tests.map((t) => last(t.id)).filter(Boolean);
    const dates = results.map((r) => r.date).sort();
    const own = defects.filter((d) => g.cases.some((c) => c.id.startsWith(g.prefix)) && d.id.startsWith(`${g.prefix}-D`));
    return {
      name: g.name, prefix: g.prefix, tests: g.tests.length, smoke: g.tests.filter((t) => t.suite === 'smoke').length,
      pass: results.filter((r) => r.status === 'PASS').length, fail: results.filter((r) => r.status === 'FAIL').length,
      none: g.tests.length - results.length, from: dates[0], to: dates.at(-1),
      defects: own.length, openDefects: own.filter((d) => OPEN(d.status)).length, manual: g.cases.length - g.cases.filter((c) => g.tests.some((t) => t.id === c.id)).length,
    };
  });
  const guardOf = new Map(defects.filter((d) => d.guardTest).map((d) => [d.guardTest, d]));
  const linkedDefect = (id) => modules.flatMap((m) => m.cases).find((c) => c.id === id)?.defect || guardOf.get(id)?.id;
  const expectedFail = tests.filter((t) => { const d = defects.find((x) => x.id === linkedDefect(t.id)); return d && OPEN(d.status); });
  const unexplained = tests.filter((t) => last(t.id)?.status === 'FAIL' && !linkedDefect(t.id));
  const runs = recentRuns();
  const device = (runs.find((r) => r.device)?.device || '').replace(/^\S+\s+\((.*)\)$/, '$1') || 'Not available';
  return { modules, ledger, tests, specCount, defects, perModule, expectedFail, unexplained, runs, device, app: runs.find((r) => r.app)?.app || 'Not available', v: versions(), last };
}

// ---------------------------------------------------------------- render
function css() {
  return `
  /* Page margins live here: Chrome lets @page override the margins passed to printToPDF. */
  @page { size: A4; margin: 16mm 20mm 18mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Noto Sans", Arial, sans-serif; color: #1f2937; font-size: 9.5pt; line-height: 1.35; margin: 0; }
  h1 { font-size: 20pt; color: #1e3a5f; border-bottom: 3px solid #1e3a5f; padding-bottom: 6px; margin: 0 0 12px; }
  h2 { font-size: 13pt; color: #1e3a5f; margin: 18px 0 8px; }
  h3 { font-size: 11pt; color: #1e3a5f; margin: 14px 0 6px; }
  p { margin: 6px 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
  .hero { background: #1e3a5f; color: #fff; border-radius: 10px; padding: 34px 38px 40px; }
  .hero .kicker { letter-spacing: 2px; font-size: 9.5pt; color: #b9c9de; }
  .hero h1 { color: #fff; border: 0; font-size: 30pt; line-height: 1.15; margin: 14px 0 12px; }
  .hero p { color: #dbe5f1; font-size: 12pt; }
  .meta td { border: 0; padding: 4px 0; } .meta td:first-child { color: #6b7280; width: 32%; }
  .note { color: #6b7280; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 9pt; }
  tr, .box, .card, .layers, .flow, .alert, li { break-inside: avoid; }
  th { background: #f1f4f8; color: #1e3a5f; text-align: left; padding: 6px 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #e3e8ef; vertical-align: top; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
  .card { border: 1px solid #d6dde7; border-radius: 8px; padding: 10px 12px; }
  .card b { display: block; font-size: 22pt; color: #1e3a5f; line-height: 1.1; }
  .card span { font-size: 8.5pt; color: #4b5563; }
  .alert { border-left: 4px solid #b42318; background: #fdf1f0; padding: 10px 14px; margin: 12px 0; }
  .tag { display: inline-block; border: 1px solid #c9d3e0; border-radius: 4px; padding: 0 5px; font-family: Consolas, monospace; font-size: 8.5pt; background: #f7f9fb; }
  code { font-family: Consolas, monospace; font-size: 8.8pt; background: #f1f4f8; padding: 0 3px; border-radius: 3px; }
  td code { white-space: nowrap; }
  table.compact { font-size: 8.8pt; } table.compact td, table.compact th { padding: 3px 8px; }
  .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 10px 0 4px; }
  .box { border: 1.5px solid #3b6ea8; border-radius: 6px; padding: 8px; text-align: center; font-size: 8.8pt; background: #f2f6fc; }
  .box b { display: block; color: #1e3a5f; margin-bottom: 2px; }
  .box.warn { border-color: #c2852b; background: #fdf7ec; } .box.bad { border-color: #b42318; background: #fdf1f0; } .box.ok { border-color: #2e7d4f; background: #eff8f2; }
  .arrow { text-align: center; color: #3b6ea8; font-size: 14pt; line-height: 1; margin: 2px 0; }
  .layers .row { display: grid; gap: 12px; margin: 6px 0; }
  .caption { color: #6b7280; font-size: 8.8pt; margin: 4px 0 12px; }
  ul, ol { margin: 6px 0; padding-left: 18px; } li { margin: 3px 0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .bar { display: inline-block; height: 9px; border-radius: 2px; vertical-align: middle; }`;
}

function render(x, meta) {
  const { tests, perModule, defects, expectedFail, unexplained, runs, v, device, app } = x;
  const { date, prepared, commit, branch, remote } = meta;
  const total = { tests: tests.length, smoke: tests.filter((t) => t.suite === 'smoke').length, pass: perModule.reduce((n, m) => n + m.pass, 0), fail: perModule.reduce((n, m) => n + m.fail, 0), none: perModule.reduce((n, m) => n + m.none, 0) };
  const open = defects.filter((d) => OPEN(d.status));
  const highOpen = open.filter((d) => /Critical|High/.test(d.severity));
  const neverRun = perModule.filter((m) => m.pass + m.fail === 0);
  const repo = remote.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '') || 'Not available';
  const sendTests = tests.filter((t) => t.sends);

  const cover = `<section class="page cover">
    <div class="hero"><div class="kicker">QUALITY ASSURANCE · MOBILE TEST AUTOMATION</div>
      <h1>SalesHiker Mobile QA Automation Framework</h1>
      <p>SalesHiker Android app - how the automated testing works, what it covers, and where we stand today</p></div>
    <div>${table([], [
      ['Application', `SalesHiker for Android (${code(app)}); beta backend ${code('accountsbeta.saleshiker.com')}; test account in ${code('config\\.env')}`],
      ['Test device', `${esc(device)} (real phone over USB); emulator scripts kept for Android Virtual Devices`],
      ['Status as of', date],
      ['Prepared by', `${esc(prepared || 'Not available')}, QA (generated from the repository)`],
      ['Source', `Repository ${code(repo)}, branch ${code(branch || '?')} (commit ${esc(commit || '?')})`],
    ], 'meta')}
    <p class="note">Numbers in this document come from the test specs, the results ledger, the test-case and defect workbooks and the kept run reports on ${date}. They change with every run; the document is rebuilt automatically after each test run (<code>npm run docs:framework</code>).</p></div>
  </section>`;

  const statusRows = perModule.map((m) => [esc(m.name), m.pass + m.fail
    ? `Built and run: ${m.pass} PASS, ${m.fail} FAIL last recorded (${m.from && fmtDay(m.from) !== fmtDay(m.to) ? `${fmtDay(m.from)} – ${fmtDay(m.to)}` : fmtDay(m.to)})${m.none ? `; ${m.none} with no result` : ''}${m.defects ? `; ${plural(m.defects, 'defect')} logged` : ''}`
    : `<b>Built, not yet run</b> on this framework: no recorded result (${plural(m.tests, 'test')})`]);
  statusRows.push(['Nightly / on-push run (CI)', '<b>Not configured</b>: tests need a USB-connected phone, so they run on the QA machine only.']);
  const attention = [
    highOpen.length ? `open High defects ${highOpen.map((d) => d.id).join(', ')}` : '',
    neverRun.length ? `modules not yet run on this framework: ${neverRun.map((m) => m.name).join(', ')}` : '',
    unexplained.length ? `failures not linked to a defect, to re-run or triage: ${unexplained.map((t) => t.id).join(', ')}` : '',
  ].filter(Boolean);

  const summary = `<section class="page"><h1>1. Summary</h1>
    <p>We test the <b>SalesHiker Android app</b> with one automated framework. It drives the real app on a real phone the way a user would (taps, typing, scrolling), checks what the screen shows, and records evidence (screenshots, UI hierarchy, device logs) for every key step and every failure.</p>
    <div class="cards">
      <div class="card"><b>${total.tests}</b><span>automated tests (${total.smoke} smoke)</span></div>
      <div class="card"><b>${perModule.length}</b><span>modules (${x.specCount} spec files)</span></div>
      <div class="card"><b>${defects.length}</b><span>defects logged (${open.length} open)</span></div>
      <div class="card"><b>1</b><span>device: ${esc(device)}</span></div>
    </div>
    <h3>What the framework gives the team</h3><ul>
      <li><b>Readable tests:</b> every test has an ID (e.g. <code>MCMP-012</code>) and a plain title, so anyone can read what is covered and run exactly that test.</li>
      <li><b>Defects the team can act on:</b> each defect has steps to reproduce, expected and actual result, severity and screenshots, kept in the Excel defect tracker.</li>
      <li><b>Automatic records:</b> after every run, results go into the test-case workbook, failures without a defect go to a triage sheet, defect status moves when its guard test changes, and this document is rebuilt.</li>
      <li><b>Safe on a live workspace:</b> real WhatsApp messages reach only ${plural(x.sendAllowlist, 'allowlisted test number')}, only when switched on, and the recipients are checked before and after sending.</li></ul>
    <h3>Status today</h3>${table(['Area', 'Status'], statusRows)}
    ${attention.length ? `<div class="alert"><b>Needs attention:</b> ${attention.map((a, i) => `(${i + 1}) ${esc(a)}`).join('; ')}.</div>` : ''}
  </section>`;

  const stack = `<section class="page"><h1>2. What the framework is built with</h1>${table(['Purpose', 'Tool', 'Why'], [
    ['Mobile automation', `<b>Appium</b> ${esc(v.appium)} with the <b>UiAutomator2</b> driver ${esc(v.uia2)}`, 'Drives the native Android app through the accessibility tree; no changes to the app are needed.'],
    ['Test runner', `<b>WebdriverIO</b> ${esc(v.wdio)} with <b>Mocha</b> (@wdio/mocha-framework ${esc(v.mocha)}) and <b>Chai</b> ${esc(v.chai)}`, 'Starts Appium, runs one spec per session, waits for elements, readable assertions.'],
    ['Language', `<b>TypeScript</b> ${esc(v.typescript)}, Node.js ${esc(v.node)}`, 'Class-based page objects and typed helpers; errors caught before a run.'],
    ['Device access', `Android SDK platform-tools (adb ${esc(v.adb)}), no Android Studio`, 'Installs the APK, reads device logs and ANR events, captures screenshots.'],
    ['Reports', `Allure ${esc(v.allure)} (single-file HTML), JUnit, ${code('summary.md')}`, 'Readable results with screenshots per run; machine-readable results for the workbooks.'],
    ['Test cases and defects', `<b>exceljs</b> ${esc(v.exceljs)} + ${code('tools/excel/update-workbooks.js')}`, 'Writes run results into the test-case workbook and keeps the defect tracker up to date.'],
    ['Configuration', `dotenv ${esc(v.dotenv)}`, 'Device, test account and send switches live in a local <code>config\\.env</code> (never in git).'],
    ['Code quality', 'TypeScript strict mode, <code>npm run typecheck</code>', 'Type errors are caught before tests run.'],
    ['Automation server', 'None', '<b>Not configured</b>: tests need the USB phone on the QA machine.'],
  ])}
    <h3>How the code is organised</h3>
    <div class="layers">
      <div class="row" style="grid-template-columns:1fr"><div class="box"><b>Run the tests</b>PowerShell runners on the QA machine (<code>run-smoke</code>, <code>run-regression</code>, <code>run-single-test</code>) · WebdriverIO starts Appium · one spec file per session</div></div>
      <div class="arrow">↓</div>
      <div class="row" style="grid-template-columns:1fr 1fr"><div class="box"><b>test/specs/ - tests</b>smoke/ and regression/ · one ID per test<br>${total.tests} tests in ${x.specCount} files</div><div class="box"><b>test/helpers/ - shared steps</b>sign-in when needed, open a module, discard half-made broadcasts</div></div>
      <div class="arrow">↓</div>
      <div class="row" style="grid-template-columns:1fr"><div class="box ok"><b>src/ - shared framework</b>pages/ (one class per screen, selectors only here) · utils/ (app lifecycle, adb, evidence) · data/ (test inputs) · config/ (settings from config\\.env)</div></div>
      <div class="arrow">↓</div>
      <div class="row" style="grid-template-columns:1fr 1fr 1fr"><div class="box warn"><b>reports/&lt;run&gt;</b>summary, Allure HTML, screenshots, logcat, failure diagnostics</div><div class="box warn"><b>docs/</b>test-case workbook, defect tracker, results ledger, this document</div><div class="box warn"><b>tools/</b>workbook and document generators, test cases and defects per module</div></div>
    </div>
    <p class="caption">Figure 1 - Layers. Specs say <i>what</i> is tested, page classes know <i>how</i> to use each screen, and the shared framework handles the device, sign-in, evidence and safety for every module.</p>
  </section>`;

  const flow = (steps, cls = []) => `<div class="flow">${steps.map(([t, d], i) => `<div class="box ${cls[i] ?? ''}"><b>${i + 1} ${t}</b>${d}</div>`).join('')}</div>`;
  const how = `<section class="page"><h1>3. How it works</h1>
    <h2>3.1 From a new module to tested coverage</h2>
    ${flow([['Explore', 'read-only walk-through on the phone (UI dumps, screenshots)'], ['Page classes', 'one class per screen; selectors from the live app'], ['Specs', 'tests with IDs; smoke or regression'], ['Run on device', 'real phone over USB; one session per spec'], ['Report kept', 'summary, Allure HTML, screenshots, logs per run'], ['Triage', 'test issue, environment problem or app defect'], ['Defect logged', 'steps, expected / actual, severity; guard test linked'], ['Records updated', 'workbooks and this document rebuilt automatically']], ['', '', '', '', 'warn', 'warn', 'bad', 'ok'])}
    <p class="caption">Figure 2 - Testing workflow. A failure first goes to the "Failures to triage" sheet; it becomes a defect only after triage. A test problem is fixed and re-run instead.</p>
    <h2>3.2 Defect lifecycle</h2>
    ${flow([['Test fails', 'listed under "Failures to triage"'], ['Triage', 'test-side, environment or application defect'], ['Logged', 'defect with ID, severity, steps and evidence'], ['Guard test', 'the test that fails while the defect exists'], ['Developer fixes', 'next build of the app'], ['Guard passes', 'status moves to <b>Ready for Retest</b>'], ['Retest and close', 'closing is always manual'], ['Reopened', 'automatically, if the guard fails again']], ['bad', 'warn', 'warn', '', '', 'ok', 'ok', 'bad'])}
    <p class="caption">Figure 3 - A guard test keeps failing while its defect is open (its assertions describe the correct behaviour and are never relaxed). When it passes, the tracker moves the defect to Ready for Retest; "Needs Decision" and "Won't Fix" are never changed automatically.</p>
    <h2>3.3 What happens in one run</h2><ol>
      <li><b>Checks:</b> the runner confirms the phone is connected and the app is installed, and records its version.</li>
      <li><b>Session:</b> WebdriverIO starts Appium; the UiAutomator2 helper already on the phone is reused (ColorOS blocks reinstalls behind a security prompt).</li>
      <li><b>Each test</b> restarts the app; signed-in tests sign in only when the session is gone. Tests that need data the account lacks are <b>skipped with a reason</b>, never passed.</li>
      <li><b>Safety:</b> sending needs <code>BROADCAST_SEND=true</code>; the audience and recipients are checked against the allowlist; nothing is deleted.</li>
      <li><b>Evidence:</b> screenshots at key steps; on failure the screen, UI hierarchy, foreground app and logcat are saved.</li>
      <li><b>After the run:</b> environment aborts are reported as "not executed" (not failed), then the test-case workbook, defect tracker and this document are updated.</li></ol>
  </section>`;

  const count = (pred) => tests.filter(pred).length;
  const kinds = `<section class="page"><h1>4. What we test, and how we keep the workspace safe</h1>
    <h2>4.1 Kinds of tests</h2>${table(['Kind', 'What it means', right('Tests')], [
      [`<span class="tag">smoke</span>`, 'The essentials of each module (<code>test/specs/smoke</code>); run first', right(count((t) => t.suite === 'smoke'))],
      [`<span class="tag">regression</span>`, 'Full behaviour per module (<code>test/specs/regression</code>)', right(count((t) => t.suite === 'regression'))],
      [`<span class="tag">needs account</span>`, 'Needs the beta test account from <code>config\\.env</code>; skipped when it is missing', right(count((t) => t.needsAccount))],
      [`<span class="tag">expected to fail</span>`, 'Guard tests of open defects: fail until the defect is fixed', right(expectedFail.length)],
      [`<span class="tag">sends WhatsApp</span>`, 'Creates and sends a real broadcast (allowlisted numbers only); stops before sending unless switched on', right(sendTests.length)],
      [`<span class="tag">data dependent</span>`, 'Skipped with a reason when the account has no matching data (e.g. no campaign with replies)', right(count((t) => t.dataDependent))],
    ])}
    <p class="note">Tests run by module with <code>-Grep &lt;prefix&gt;</code> (${perModule.map((m) => `<span class="tag">${esc(m.prefix)}</span>`).join(' ')}) or one by one with its ID. There are no accessibility, performance, API, iOS or visual-comparison tests: <b>not covered</b>.</p>
    <h2>4.2 Safety rules on the live workspace</h2>${table(['Rule', 'How it is enforced'], [
      ['Beta backend only', 'The APK under test points to <code>accountsbeta.saleshiker.com</code>; production is never used.'],
      ['Real messages only to test numbers', `The broadcast audience is a tag carried only by the ${plural(x.sendAllowlist, 'allowlisted contact')}. Before sending, each number must have exactly one contact with that tag; after sending, the recipients must be exactly the allowlist.`],
      ['Sending needs a switch', '<code>BROADCAST_SEND=true</code> must be set; otherwise the send test runs every check and stops before "Send Now" (skipped).'],
      ['Send once, never retry', '"Send Now" is tapped once; "All contacts" can never be chosen by the automation.'],
      ['No half-made broadcasts', 'Every wizard test ends with Cancel / Discard; a safety net discards an open wizard after each test.'],
      ['Read-only elsewhere', 'Campaign tests never create, pause or edit campaigns; nothing is deleted.'],
      ['No secrets in git', 'Credentials, device serial and allowlist live in <code>config\\.env</code> (git-ignored); the runner removes the password from all reports.'],
    ])}
  </section>`;

  const scopeRows = perModule.map((m) => [esc(m.name), right(m.tests), right(m.smoke), right(m.defects || '–'), right(m.pass + m.fail ? `${m.pass} / ${m.fail}` : 'Not run')]);
  scopeRows.push(['<b>Total</b>', right(`<b>${total.tests}</b>`), right(`<b>${total.smoke}</b>`), right(`<b>${defects.length}</b>`), right(`<b>${total.pass} / ${total.fail}</b>`)]);
  const scope = `<section class="page"><h1>5. Scope</h1>
    <h2>In scope</h2>${table(['Module', right('Tests'), right('Smoke'), right('Defects'), right('Last recorded PASS / FAIL')], scopeRows)}
    <p class="note">Defects are the records in <code>docs/SalesHiker_Mobile_Defect_Tracker.xlsx</code> (open and closed). Results are the last PASS/FAIL per test in <code>docs/test-execution-ledger.json</code>; skipped and not-executed runs never replace a result.</p>
    <h2>Out of scope, or waiting</h2>${table(['Item', 'Status / reason'], [
      ['iOS app', 'Not covered: Android only.'],
      ['Other app areas', 'Not covered: Dashboard, Inbox (chats), Contacts and Deals tabs, Templates, Chatbots, AI Agents, WhatsApp Logs, Organizations, Leads, Tasks, Calendar.'],
      ['Scheduled broadcasts, drafts', 'Not covered: only "Send now" is tested; scheduling would leave a pending send.'],
      ['Emulator runs', 'Scripts kept, but the emulators on this PC are unstable under memory pressure; tests run on the real phone.'],
      ['API / back-end tests', 'Out of scope: UI tests only.'],
      ['Test environment', 'Tests run against the shared beta workspace; no dedicated test workspace.'],
    ])}
  </section>`;

  const sevMax = Math.max(1, ...SEV.map((s) => defects.filter((d) => d.severity === s).length));
  const sevColor = { Critical: '#b42318', High: '#dd6b20', Medium: '#d69e2e', Low: '#7aa2d6' };
  const sevRows = SEV.map((s) => { const n = defects.filter((d) => d.severity === s).length; return [s, right(n), `<span class="bar" style="width:${Math.round((n / sevMax) * 110)}px;background:${sevColor[s]}"></span>`]; });
  const statusNames = [...new Set(defects.map((d) => d.status))].sort();
  const findings = [...open].sort((a, b) => SEV.indexOf(a.severity) - SEV.indexOf(b.severity)).slice(0, 5).map((d) => [code(d.id), esc(d.title), esc(d.module), d.severity, esc(d.status)]);
  const runRows = runs.map((r) => [code(r.name), fmtDay(r.started), right(r.passed), right(r.failed), right(r.skipped), right(r.notRun)]);
  const results = `<section class="page"><h1>6. Results snapshot - ${date}</h1>
    <div class="two"><div><h3>Defects by severity</h3>${table(['Severity', right('Defects'), ''], [...sevRows, ['<b>Total</b>', right(`<b>${defects.length}</b>`), '']])}</div>
    <div><h3>Defects by status</h3>${table(['Status', right('Defects')], statusNames.map((s) => [esc(s), right(defects.filter((d) => d.status === s).length)]))}
    <p class="note">Last recorded test results: <b>${total.pass} PASS · ${total.fail} FAIL · ${total.none} no result</b> of ${total.tests}.</p></div></div>
    <h3>Most important open findings</h3>${findings.length ? table(['ID', 'Finding', 'Module', 'Severity', 'Status'], findings, 'compact') : '<p>No open defects.</p>'}
    <h3>Latest runs</h3>${runRows.length ? table(['Run (reports/)', 'Started', right('Passed'), right('Failed'), right('Skipped'), right('Not executed')], runRows, 'compact') : '<p>No run reports kept on this machine.</p>'}
    <p class="note">Each run folder keeps one run, which can be a single test rather than a module regression.</p>
    <h3>Risks and next steps</h3><ul>
      ${neverRun.length ? `<li><b>Not yet run on this framework</b> - run ${neverRun.map((m) => esc(m.name)).join(', ')} so every module has current results.</li>` : ''}
      ${unexplained.length ? `<li><b>Failures to triage</b> - ${unexplained.map((t) => code(t.id)).join(', ')} are not linked to a defect: re-run them, fix the test or log a defect.</li>` : ''}
      ${highOpen.length ? `<li><b>High defects</b> - ${highOpen.map((d) => code(d.id)).join(', ')}: agree fixes with development, then re-run the guard tests.</li>` : ''}
      ${open.filter((d) => d.severity === 'Medium').length ? `<li><b>Medium defects</b> - ${open.filter((d) => d.severity === 'Medium').map((d) => code(d.id)).join(', ')}: plan a fix and re-run the guard tests.</li>` : ''}
      <li><b>Single device</b> - all results come from one phone; a second device or Android version would catch device-specific problems.</li>
      <li><b>Shared beta workspace</b> - tests read live data and the send test leaves real broadcasts; a dedicated test workspace would make results repeatable.</li></ul>
  </section>`;

  const appendix = `<section class="page"><h1>Appendix - for the QA and development team</h1>
    <h3>Folder structure</h3>${table(['Folder', 'Contents'], [
      [code('test/specs/smoke'), 'Smoke tests per module'],
      [code('test/specs/regression'), 'Regression tests per module'],
      [code('test/helpers'), 'Shared test steps: sign-in check, open a module, safety nets'],
      [code('src/pages'), 'Page classes for each screen (selectors and actions)'],
      [`${code('src/utils')}, ${code('src/data')}, ${code('src/config')}`, 'App lifecycle, adb and evidence helpers; test inputs; settings from config\\.env'],
      [code('config/'), 'WebdriverIO configuration, .env (local only) and .env.example'],
      [code('scripts/'), 'PowerShell runners, emulator and APK scripts'],
      [code('tools/excel'), 'Workbook generator; test cases and defects per module in modules/'],
      [code('tools/docs'), 'Generator of this document'],
      [code('docs/'), 'Test-case workbook, defect tracker, results ledger, this document, setup notes'],
      [code('reports/<run>'), 'One folder per run: summary.md, Allure HTML, JUnit, screenshots, logs, failure diagnostics'],
    ])}
    <h3>Common commands</h3>${table(['Command', 'What it does'], [
      [code('npm install'), 'Install dependencies (Appium: npm install -g appium; appium driver install uiautomator2)'],
      [code('.\\scripts\\run-smoke.ps1'), 'Smoke tests of every module'],
      [code('.\\scripts\\run-regression.ps1 -IncludeSmoke'), 'Every test'],
      [code('.\\scripts\\run-regression.ps1 -IncludeSmoke -Grep MCMP'), 'One module by its ID prefix'],
      [code('.\\scripts\\run-single-test.ps1 MBRD-012'), 'One test by its ID'],
      [code('npm run excel'), 'Rebuild the workbooks and this document from the recorded results'],
      [code('npm run docs:framework'), 'Rebuild this document (HTML and PDF); add -- --watch to rebuild on every change'],
    ])}
    <h3>Conventions</h3><ul>
      <li>Test IDs are <code>&lt;MODULE&gt;-nnn</code> (${perModule.map((m) => code(`${m.prefix}-nnn`)).join(', ')}); defect IDs are <code>&lt;MODULE&gt;-Dnn</code> (e.g. <code>MCMP-D02</code>).</li>
      <li>Selectors and expected texts live only in the page classes; the app has no test IDs, so accessibility labels are used.</li>
      <li>Test data uses recognisable names (<code>QA_Mobile_BC_</code>, <code>QA_Mobile_Draft_</code>, <code>qa_mobile_bc_allowlist_2026</code>) so it is never confused with real records.</li></ul>
  </section>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SalesHiker Mobile QA Automation Framework</title><style>${css()}</style></head><body>
<!-- built: ${date} · commit ${esc(commit)} -->
${cover}${summary}${stack}${how}${kinds}${scope}${results}${appendix}
</body></html>`;
  return { html, footer: `SalesHiker Mobile QA Automation Framework · ${date}` };
}

// ---------------------------------------------------------------- PDF (installed Chrome or Edge, DevTools protocol)
function browserPath() {
  const candidates = [
    process.env.DOCS_BROWSER,
    join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome or Edge found for the PDF; set DOCS_BROWSER to a Chromium-based browser');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function printPdf(htmlFile, pdfFile, footer) {
  const profile = mkdtempSync(join(tmpdir(), 'qa-doc-'));
  const proc = spawn(browserPath(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  try {
    // Chrome writes the port file while starting: retry until it holds a port number.
    const portFile = join(profile, 'DevToolsActivePort');
    let port = '';
    for (let i = 0; i < 200 && !/^\d+$/.test(port); i++) {
      try { port = readFileSync(portFile, 'utf8').split('\n')[0].trim(); } catch { /* not written yet */ }
      if (!/^\d+$/.test(port)) await sleep(100);
    }
    if (!/^\d+$/.test(port)) throw new Error('The browser did not open its DevTools port within 20 s');
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let next = 0;
    let onLoad = () => {};
    const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); }
      else if (m.method === 'Page.loadEventFired') onLoad();
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    await send('Page.enable');
    const loaded = new Promise((r) => { onLoad = r; });
    await send('Page.navigate', { url: pathToFileURL(htmlFile).href });
    await loaded;
    const mm = (n) => n / 25.4;
    const { data } = await send('Page.printToPDF', {
      printBackground: true, displayHeaderFooter: true, paperWidth: mm(210), paperHeight: mm(297),
      marginTop: mm(16), marginBottom: mm(18), marginLeft: mm(20), marginRight: mm(20),   // same as @page
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:7pt;color:#6b7280;width:100%;padding:0 20mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif"><span>${esc(footer)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    writeFileSync(pdfFile, Buffer.from(data, 'base64'));
    ws.close();
  } finally {
    proc.kill();
    for (let i = 0; i < 10; i++) { try { rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); } }
  }
}

// ---------------------------------------------------------------- build
async function build({ check = false } = {}) {
  const x = await collect();
  x.sendAllowlist = allowlistSize();
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const meta = { date, prepared: git('config', 'user.name'), commit: git('rev-parse', '--short', 'HEAD'), branch: git('branch', '--show-current'), remote: git('remote', 'get-url', 'origin') };
  const { html, footer } = render(x, meta);
  // Ignore what changes on every build: the date and the commit.
  const comparable = (t) => t.replace(/\r\n/g, '\n').replace(STAMP, '').split(date).join('').replace(/commit [0-9a-f]{7,}/g, '');
  const before = existsSync(HTML_FILE) ? readFileSync(HTML_FILE, 'utf8') : '';
  const changed = !existsSync(PDF_FILE) || comparable(before) !== comparable(html);
  if (!changed || check) return changed;
  // Print from a temporary copy and write the HTML last, so a failed print never leaves an up-to-date
  // looking HTML next to an old PDF.
  const draft = join(tmpdir(), `qa-framework-${process.pid}.html`);
  writeFileSync(draft, html);
  try {
    await printPdf(draft, PDF_FILE, footer);
  } catch (e) {
    if ((e.code === 'EBUSY' || e.code === 'EPERM') && e.path === PDF_FILE) throw new Error(`${rel(PDF_FILE)} is open in another program; close it and run npm run docs:framework`);
    throw e;
  } finally {
    rmSync(draft, { force: true });
  }
  writeFileSync(HTML_FILE, html);
  return changed;
}

/** Number of allowlisted numbers in config\.env (the numbers themselves are never written). */
function allowlistSize() {
  for (const name of ['.env', '.env.example']) {
    const file = join(ROOT, 'config', name);
    if (!existsSync(file)) continue;
    const m = readFileSync(file, 'utf8').match(/^BROADCAST_ALLOWLIST=(.*)$/m);
    if (m && m[1].trim()) return m[1].split(',').filter((p) => p.trim()).length;
  }
  return 0;
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
  // Rebuild (debounced) when specs, page classes, test-case/defect modules, results or the tracker change.
  const targets = ['test', 'src', join('tools', 'excel', 'modules'), 'docs'].map((p) => join(ROOT, p));
  let timer = null;
  const rebuild = () => build().then((c) => console.log(`${new Date().toLocaleTimeString()} framework overview ${c ? 'updated' : 'unchanged'}`), (e) => console.error(e.message));
  for (const dir of targets) {
    watch(dir, { recursive: true }, (_, file) => {
      if (!file || /SalesHiker_Mobile_QA_Automation_Framework|~\$/.test(file)) return;   // own output, Excel lock files
      clearTimeout(timer); timer = setTimeout(rebuild, 1500);
    });
  }
  console.log('Watching test/, src/, tools/excel/modules/ and docs/ - Ctrl+C to stop');
  await rebuild();
} else {
  const check = args.includes('--check');
  const changed = await build({ check });
  console.log(`Framework overview: ${changed ? (check ? 'out of date; run npm run docs:framework' : `updated -> ${rel(PDF_FILE)}`) : 'already up to date'}`);
  if (check && changed) process.exit(1);
}
