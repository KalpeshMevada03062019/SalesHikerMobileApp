// Builds one Monocart report with the latest result of every automated test, across all modules:
// reports\monocart\index.html. Called after every run by scripts\_common.ps1 and by the wdio onComplete hook
// for direct runs; can also be run by hand (npm run report:monocart).
//
// How it works
// - Monocart's test reporter is a Playwright reporter; there is none for WebdriverIO. Its merge() API turns
//   Monocart report data into the Monocart HTML report, so this script writes that data from the recorded
//   results and lets merge() build the report.
// - Which run counts for a test comes from docs/test-execution-ledger.json (the same rules as the workbooks
//   and the other reports): the latest PASS/FAIL. A later SKIPPED / NOT EXECUTED attempt never replaces it.
// - Each module is a project, each scenario a describe, each test a case with its status, duration, error,
//   screenshots (copied into the report), run and device (logs) and test case and defect (annotations).
// - Tests in the specs with no result yet are skipped cases ("Not run yet").
// - The trend chart comes from the previous report's data, kept between builds.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { merge } from 'monocart-reporter';
import { ROOT, REPORTS, trackerState, loadCatalog, runSeconds } from '../report-data.mjs';

const require = createRequire(import.meta.url);
// Monocart's own defaults (not exported: loaded by file path).
const MONOCART = path.dirname(require.resolve('monocart-reporter/package.json'));
const getDefaultColumns = require(path.join(MONOCART, 'lib', 'default', 'columns.js'));
const { getSystemInfo, getTickInfo } = require(path.join(MONOCART, 'lib', 'utils', 'system.js'));

const OUT = path.join(REPORTS, 'monocart');
const REPORT = path.join(OUT, 'index.html');
const DATA = path.join(REPORTS, '.monocart-data');   // staging: report data and its screenshots
const STATE = { PASS: 'passed', FAIL: 'failed' };
const id = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 20);
const version = (pkg) => { try { return require(`${pkg}/package.json`).version; } catch { return '?'; } };

function caseRow(testId, catalog, state) {
  const { tc } = catalog.cases.get(testId) || {};
  const spec = catalog.specs.get(testId);
  const entry = catalog.ledger.tests[testId];
  const last = entry?.last;
  const defect = tc?.defect ? catalog.defectsById.get(tc.defect) : null;
  const caseType = STATE[last?.status] || 'skipped';
  const duration = last ? Math.round((runSeconds(last.run).get(testId) || 0) * 1000) : 0;
  const start = last ? new Date(last.date).getTime() : 0;

  const logs = [last ? `Result: ${last.status}, run ${last.run}, ${new Date(last.date).toLocaleString('en-GB')}, ${entry.iterations || 1} iteration(s)` : 'Not run yet'];
  if (last?.env) logs.push(`Device: ${last.env}`);
  if (entry?.lastAttempt) logs.push(`Later attempt: ${entry.lastAttempt.status}, run ${entry.lastAttempt.run}${entry.lastAttempt.message ? `: ${entry.lastAttempt.message}` : ''}`);

  const notes = [];
  if (defect) notes.push(`**Defect ${defect.id}** (${state.defects.get(defect.id) || defect.status}): ${defect.title}`);
  else if (last?.status === 'FAIL') notes.push(`**Triage**: ${state.triage.get(testId) || 'To triage'}`);
  if (tc) notes.push(`**Expected**: ${tc.expected}`);

  // Screenshots are staged next to the data; merge() copies them into the report folder.
  const attachments = [];
  for (const rel of last?.evidence || []) {
    const from = path.join(ROOT, rel);
    if (!fs.existsSync(from)) continue;
    // Keep the path inside the run folder: every failure screenshot is called screenshot.png.
    const to = path.join('attachments', path.relative(REPORTS, from));
    fs.mkdirSync(path.dirname(path.join(DATA, to)), { recursive: true });
    fs.copyFileSync(from, path.join(DATA, to));
    attachments.push({ name: path.basename(rel), contentType: 'image/png', path: to.split(path.sep).join('/') });
  }

  const row = {
    id: id(testId), title: spec.title, type: 'case', caseType,
    ok: caseType !== 'failed', outcome: { passed: 'expected', failed: 'unexpected', skipped: 'skipped' }[caseType],
    expectedStatus: 'passed', status: caseType, retry: 0,
    location: `${spec.file}`, duration, timestamps: start ? [start, start + duration] : [],
    annotations: notes.join('\n\n'), logs,
    tags: [tc?.type === 'Smoke' || spec.file.includes('/smoke/') ? 'smoke' : 'regression'],
  };
  if (attachments.length) row.attachments = attachments;
  if (last?.status === 'FAIL') row.errors = [last.message || 'Failed'];
  return { row, start, duration };
}

async function main() {
  const state = await trackerState();
  const catalog = loadCatalog();

  fs.rmSync(DATA, { recursive: true, force: true });
  fs.mkdirSync(DATA, { recursive: true });
  // Trend: the previous report's data (merge() empties the report folder before reading it).
  const previous = path.join(OUT, 'index.json');
  const trend = path.join(DATA, 'previous.json');
  if (fs.existsSync(previous)) fs.copyFileSync(previous, trend);

  const projects = new Map();
  let first = Infinity;
  let last = 0;
  let device = '';
  for (const testId of catalog.ids) {
    const mod = catalog.moduleOf(testId);
    const { tc } = catalog.cases.get(testId) || {};
    const scenario = tc ? `${tc.ts} ${tc.scenario}` : 'Tests';
    const { row, start, duration } = caseRow(testId, catalog, state);
    if (start) { first = Math.min(first, start); last = Math.max(last, start + duration); }
    if (!device && catalog.ledger.tests[testId]?.last?.env) device = catalog.ledger.tests[testId].last.env.split(';')[0];
    if (!projects.has(mod.label)) projects.set(mod.label, new Map());
    const scenarios = projects.get(mod.label);
    if (!scenarios.has(scenario)) scenarios.set(scenario, []);
    scenarios.get(scenario).push(row);
  }
  if (!Number.isFinite(first)) first = last = Date.now();

  const rows = [...projects].map(([label, scenarios]) => ({
    id: id(`project:${label}`), title: label, type: 'suite', suiteType: 'project',
    caseNum: [...scenarios.values()].flat().length,
    subs: [...scenarios].map(([scenario, cases]) => ({
      id: id(`describe:${label}:${scenario}`), title: scenario, type: 'suite', suiteType: 'describe', caseNum: cases.length, subs: cases,
    })),
  }));

  const tick = await getTickInfo(Date.now());
  const system = {
    ...getSystemInfo(),
    hostname: device ? `Android device ${device}` : 'Android device',
    playwright: `n/a (WebdriverIO ${version('webdriverio')})`,
    monocart: version('monocart-reporter'),
    timestampStart: first, timestampEnd: last, ticks: [{ ...tick, timestamp: first }, { ...tick, timestamp: last }],
    workers: 1, jobs: [],
  };
  const data = {
    name: 'SalesHiker Mobile: all modules (latest result per test)',
    date: first, duration: last - first,
    metadata: { device: device || 'Android device', backend: 'accountsbeta.saleshiker.com (beta)', source: 'latest PASS/FAIL per test (docs/test-execution-ledger.json)' },
    system, rows, columns: getDefaultColumns(), formatters: {},
    suiteTypes: ['project', 'file', 'describe', 'shard'], caseTypes: ['failed', 'flaky', 'skipped', 'passed'],
    summary: { tests: { value: catalog.ids.length } },
  };
  const dataFile = path.join(DATA, 'data.json');
  fs.writeFileSync(dataFile, JSON.stringify(data));

  await merge([dataFile], {
    name: data.name, outputFile: REPORT, logging: 'error', clean: true,
    ...(fs.existsSync(trend) ? { trend } : {}),
  });
  if (!fs.existsSync(REPORT)) {
    console.error('Monocart report not generated (see above).');
    process.exit(1);
  }
  const counts = { passed: 0, failed: 0, skipped: 0 };
  for (const p of rows) for (const d of p.subs) for (const c of d.subs) counts[c.caseType]++;
  console.log(`All-modules Monocart report: ${path.relative(ROOT, REPORT)} (${catalog.ids.length} tests: passed ${counts.passed}, failed ${counts.failed}, not run ${counts.skipped})`);
}

await main();
