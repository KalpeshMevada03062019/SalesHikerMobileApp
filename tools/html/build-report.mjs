// Builds one WebdriverIO HTML report (wdio-html-nice-reporter) with the latest result of every automated test,
// across all modules: reports\html\index.html. Called after every run by scripts\_common.ps1 and by the wdio
// onComplete hook for direct runs; can also be run by hand (npm run report:html).
//
// How it works
// - Which run counts for a test comes from docs/test-execution-ledger.json (the same rules as the workbooks
//   and the Allure report): the latest PASS/FAIL. A later SKIPPED / NOT EXECUTED attempt never replaces it
//   (it is shown as a note).
// - Each module is a section, each scenario a suite inside it, each test an entry with its result, run, test
//   case, defect or triage classification, error and the screenshots of that run.
// - Screenshots are linked (not embedded) from the run folders under reports\, so the report stays small; it
//   must stay in reports\html to show them.
// - Tests in the specs with no result yet are shown as skipped ("Not run yet").

import fs from 'node:fs';
import path from 'node:path';
import logger from '@wdio/logger';
import { HtmlGenerator } from 'wdio-html-nice-reporter';
import { ROOT, REPORTS, trackerState, loadCatalog, runSeconds } from '../report-data.mjs';

const OUT = path.join(REPORTS, 'html');
const REPORT = path.join(OUT, 'index.html');
const STATE = { PASS: 'passed', FAIL: 'failed' };
logger.setLevel('HtmlGenerator', 'warn');   // one INFO line per screenshot otherwise

const iso = (d) => new Date(d).toISOString();

function testEntry(id, catalog, state) {
  const { tc } = catalog.cases.get(id) || {};
  const spec = catalog.specs.get(id);
  const entry = catalog.ledger.tests[id];
  const defect = tc?.defect ? catalog.defectsById.get(tc.defect) : null;
  const last = entry?.last;
  const events = [];
  const log = (text) => { if (text) events.push({ type: 'log', value: text }); };

  log(last ? `Result: ${last.status} · run ${last.run} · ${new Date(last.date).toLocaleString('en-GB')} · ${entry.iterations || 1} iteration(s)` : 'Not run yet');
  if (last?.env) log(`Device: ${last.env}`);
  log(`Spec: ${spec.file}`);
  if (tc) log(`Expected: ${tc.expected}`);
  if (defect) log(`Defect ${defect.id} (${state.defects.get(defect.id) || defect.status}): ${defect.title}`);
  else if (last?.status === 'FAIL') log(`Triage: ${state.triage.get(id) || 'To triage'}`);
  if (entry?.lastAttempt) log(`Later attempt: ${entry.lastAttempt.status}, run ${entry.lastAttempt.run}${entry.lastAttempt.message ? `: ${entry.lastAttempt.message}` : ''}`);
  if (last?.status === 'FAIL') events.push({ type: 'Error', value: { message: last.message || 'Failed' } });
  for (const rel of last?.evidence || []) {
    const file = path.join(ROOT, rel);
    if (fs.existsSync(file)) events.push({ type: 'screenshot', value: file });
  }

  const seconds = last ? runSeconds(last.run).get(id) || 0 : 0;
  return {
    test: { title: spec.title, state: STATE[last?.status] || 'skipped', events },
    date: last?.date, seconds, status: last?.status,
  };
}

async function main() {
  const state = await trackerState();
  const catalog = loadCatalog();

  // Module -> scenario -> tests, in workbook order.
  const modules = new Map();
  const counts = { passed: 0, failed: 0, skipped: 0 };
  let first = Infinity;
  let last = 0;
  let device = '';
  for (const id of catalog.ids) {
    const mod = catalog.moduleOf(id);
    const { tc } = catalog.cases.get(id) || {};
    const scenario = tc ? `${tc.ts} ${tc.scenario}` : 'Tests';
    const e = testEntry(id, catalog, state);
    counts[e.test.state]++;
    if (e.date) { const t = new Date(e.date).getTime(); first = Math.min(first, t); last = Math.max(last, t); }
    if (!device && catalog.ledger.tests[id]?.last?.env) device = catalog.ledger.tests[id].last.env.split(';')[0];
    if (!modules.has(mod.label)) modules.set(mod.label, new Map());
    const scenarios = modules.get(mod.label);
    if (!scenarios.has(scenario)) scenarios.set(scenario, []);
    scenarios.get(scenario).push(e);
  }
  if (!Number.isFinite(first)) first = last = Date.now();

  // Top-level suites are sorted by start: give the modules increasing starts to keep the workbook order.
  const suites = [...modules].map(([label, scenarios], i) => {
    const all = [...scenarios.values()].flat();
    const tally = ['passed', 'failed', 'skipped'].map((s) => [s, all.filter((e) => e.test.state === s).length]).filter(([, n]) => n);
    return {
      type: 'feature', uid: `module-${i}`, title: label, start: iso(first + i), end: iso(first + i),
      description: `${all.length} tests: ${tally.map(([s, n]) => `${n} ${s === 'skipped' ? 'not run' : s}`).join(', ')}`,
      suites: [...scenarios].map(([scenario, entries], j) => {
        const dates = entries.map((e) => e.date && new Date(e.date).getTime()).filter(Boolean);
        return {
          type: 'suite', uid: `module-${i}-${j}`, title: scenario,
          start: iso(dates.length ? Math.min(...dates) : first), end: iso(dates.length ? Math.max(...dates) : first),
          _duration: entries.reduce((s, e) => s + e.seconds * 1000, 0),
          tests: entries.map((e) => e.test), suites: [],
        };
      }),
    };
  });

  // Emptied rather than removed: Windows cannot remove a folder that a shell or Explorer has open.
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
  const options = { outputDir: OUT + path.sep, filename: 'index.html', linkScreenshots: true, collapseTests: true, collapseSuites: false };
  const metrics = { ...counts, start: iso(first), end: iso(last), duration: suites.flatMap((m) => m.suites).reduce((s, x) => s + x._duration, 0) };
  await HtmlGenerator.htmlOutput(options, {
    title: 'SalesHiker Mobile: all modules (latest result per test)', info: { specs: [] }, metrics, suites,
    reportFile: REPORT, browserName: device || 'Android device',
  });
  if (!fs.existsSync(REPORT) || !fs.readFileSync(REPORT, 'utf8').includes('table-suite')) {
    console.error('HTML report not generated (see logs above).');
    process.exit(1);
  }
  // Linked screenshots come out as Windows paths (escaped as &#92;): make them URLs.
  const html = fs.readFileSync(REPORT, 'utf8').replace(/(<img[^>]*src=")([^"]+)"/g, (_, start, src) => `${start}${src.split('&#92;').join('/')}"`);
  fs.writeFileSync(REPORT, html);
  console.log(`All-modules HTML report: ${path.relative(ROOT, REPORT)} (${catalog.ids.length} tests: passed ${counts.passed}, failed ${counts.failed}, not run ${counts.skipped})`);
}

await main();
