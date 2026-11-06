// Builds one Allure report with the latest result of every automated test, across all modules:
// reports\allure\index.html (single self-contained file). Called by scripts\_common.ps1 after the workbooks
// are updated; can also be run by hand (npm run report).
//
// How it works
// - Which run counts for a test comes from docs/test-execution-ledger.json (the same rules as the
//   workbooks): the latest PASS/FAIL. A later SKIPPED / NOT EXECUTED attempt never replaces it.
// - That run's Allure result (reports\<run>\allure-results) is copied with its screenshots and failure
//   attachments. Up to MAX_RETRIES earlier PASS/FAIL runs are added too; Allure shows them under Retries.
// - Tests are grouped by module (the sheets in tools/excel/modules) and scenario, in both the Suites and
//   Behaviors tabs. Failures linked to a defect carry its ID and tracker status; other failures carry their
//   triage classification from the defect tracker. Categories sort them on that.
// - Tests in the specs with no result yet are listed as "unknown" (Not run yet).
// - The trend charts come from the history kept in reports\allure\history between builds.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, REPORTS, ID_PATTERN, DT_FILE, trackerState, loadCatalog } from '../report-data.mjs';

const OUT = path.join(REPORTS, 'allure');
const RESULTS = path.join(OUT, 'results');
const HISTORY = path.join(OUT, 'history');
const MAX_RETRIES = 4;
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- inputs
const runCache = new Map();
/** The Allure results of one run folder, by test ID (the latest if a test ran twice). */
function runResults(run) {
  if (runCache.has(run)) return runCache.get(run);
  const dir = path.join(REPORTS, run, 'allure-results');
  const byId = new Map();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('-result.json'))) {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const id = (String(r.name).match(ID_PATTERN) || [])[1];
      if (id && (!byId.has(id) || (r.stop || 0) > (byId.get(id).stop || 0))) byId.set(id, r);
    }
  }
  const entry = { dir, byId };
  runCache.set(run, entry);
  return entry;
}

function attachmentsOf(node) {
  return [...(node.attachments || []), ...(node.steps || []).flatMap(attachmentsOf)];
}

function stripAttachments(node) {
  node.attachments = [];
  for (const s of node.steps || []) stripAttachments(s);
}

// ---------------------------------------------------------------- one test
function describe(id, tc, mod, spec, entry, defect, defectStatus, triage) {
  const rows = [];
  const add = (k, v) => { if (v) rows.push(`<tr><th style="text-align:left;vertical-align:top;padding-right:12px">${esc(k)}</th><td style="white-space:pre-wrap">${esc(v)}</td></tr>`); };
  add('Module', mod.label);
  if (tc) { add('Scenario', `${tc.ts} ${tc.scenario}`); add('Pre-requisites', tc.pre); add('Steps', tc.steps); add('Input', tc.input); add('Expected', tc.expected); add('Observed (workbook)', tc.observed); }
  add('Defect', defect && `${defect.id} - ${defect.title} (${defectStatus || defect.status})`);
  if (!defect && triage) add('Triage', triage);
  add('Spec', spec?.file);
  if (entry?.last) add('Latest result', `${entry.last.status}, run ${entry.last.run} (${entry.iterations || 1} iteration(s))`);
  if (entry?.lastAttempt) add('Later attempt', `${entry.lastAttempt.status}, run ${entry.lastAttempt.run}: ${entry.lastAttempt.message}`);
  return `<table>${rows.join('')}</table>`;
}

function labelsFor(id, tc, mod, spec, run, device) {
  const scenario = tc ? `${tc.ts} ${tc.scenario}` : 'Tests';
  const kind = spec?.file.includes('/smoke/') ? 'smoke' : 'regression';
  const labels = [
    { name: 'parentSuite', value: mod.label }, { name: 'suite', value: scenario },
    { name: 'epic', value: 'SalesHiker Android' }, { name: 'feature', value: mod.label }, { name: 'story', value: tc?.scenario || 'Tests' },
    { name: 'severity', value: kind === 'smoke' || tc?.type === 'Smoke' ? 'critical' : 'normal' },
    { name: 'tag', value: kind }, { name: 'host', value: device || 'device' }, { name: 'thread', value: run || 'not run' },
    { name: 'framework', value: 'wdio' }, { name: 'language', value: 'javascript' },
  ];
  if (tc?.design) labels.push({ name: 'tag', value: tc.design });
  if (spec) labels.push({ name: 'package', value: spec.file.replace(/\//g, '.') });
  return labels;
}

function main(state) {
  const { ledger, specs, cases, defectsById, moduleOf, ids } = loadCatalog();

  // Emptied rather than removed: Windows cannot remove a folder that a shell or Explorer has open.
  fs.mkdirSync(RESULTS, { recursive: true });
  for (const f of fs.readdirSync(RESULTS)) fs.rmSync(path.join(RESULTS, f), { recursive: true, force: true });
  if (fs.existsSync(HISTORY)) fs.cpSync(HISTORY, path.join(RESULTS, 'history'), { recursive: true });

  const counts = { passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 };
  let device = '';
  let app = '';
  // Test order follows the workbooks (module by module), then any spec-only tests.
  for (const id of ids) {
    const { tc } = cases.get(id) || {};
    const mod = moduleOf(id);
    const spec = specs.get(id);
    const entry = ledger.tests[id];
    const defect = tc?.defect ? defectsById.get(tc.defect) : null;
    const defectStatus = defect ? state.defects.get(defect.id) : '';
    const triage = state.triage.get(id);
    const historyId = md5(`saleshiker-mobile:${id}`);

    const runs = [];
    if (entry?.last) {
      runs.push(entry.last.run);
      for (const h of entry.history || []) {
        if (runs.length > MAX_RETRIES) break;
        if ((h.status === 'PASS' || h.status === 'FAIL') && !runs.includes(h.run)) runs.push(h.run);
      }
      const env = entry.last.env || '';
      if (!device && env) { device = env.split(';')[0]; app = (env.match(/app (.+)$/) || [])[1] || ''; }
    }

    let written = 0;
    for (const [i, run] of runs.entries()) {
      const { dir, byId } = runResults(run);
      const original = byId.get(id);
      if (!original) continue;
      const r = structuredClone(original);
      r.name = spec.title;
      r.fullName = `${spec.file}#${spec.title}`;
      r.historyId = historyId;
      r.testCaseId = historyId;
      r.labels = labelsFor(id, tc, mod, spec, run, (entry.last.env || '').split(' ')[0]);
      r.links = defect ? [{ name: defect.id, type: 'issue', url: `../../docs/${path.basename(DT_FILE)}` }] : [];
      r.descriptionHtml = describe(id, tc, mod, spec, entry, defect, defectStatus, triage);
      if (r.status === 'failed' || r.status === 'broken') {
        const tagText = defect ? `[${defect.id} ${defectStatus || defect.status}] ` : `[Triage: ${triage || 'To triage'}] `;
        r.statusDetails = { ...r.statusDetails, message: tagText + (r.statusDetails?.message || '') };
      }
      if (i === 0) {
        for (const a of attachmentsOf(r)) {
          const from = path.join(dir, a.source);
          if (fs.existsSync(from)) fs.copyFileSync(from, path.join(RESULTS, a.source));
        }
      } else {
        stripAttachments(r);   // retries keep status, time and error; evidence stays in their run folder
      }
      fs.writeFileSync(path.join(RESULTS, `${r.uuid}-result.json`), JSON.stringify(r));
      if (i === 0) counts[r.status] = (counts[r.status] || 0) + 1;
      written++;
    }

    if (!written) {
      // In the specs but never run (or its run folder was removed).
      const uuid = crypto.randomUUID();
      const now = Date.now();
      fs.writeFileSync(path.join(RESULTS, `${uuid}-result.json`), JSON.stringify({
        uuid, historyId, testCaseId: historyId, name: spec.title, fullName: `${spec.file}#${spec.title}`,
        status: 'unknown', stage: 'finished', start: now, stop: now, steps: [], attachments: [], parameters: [], links: [],
        statusDetails: { message: entry?.last ? `No Allure results kept for run ${entry.last.run}` : 'Not run yet' },
        labels: labelsFor(id, tc, mod, spec, '', device), descriptionHtml: describe(id, tc, mod, spec, entry, defect, defectStatus, triage),
      }));
      counts.unknown++;
    }
  }

  fs.writeFileSync(path.join(RESULTS, 'categories.json'), JSON.stringify([
    { name: 'Application defects (logged)', matchedStatuses: ['failed', 'broken'], messageRegex: '(?s)\\[[A-Z]+-D[0-9]+ .*' },
    { name: 'Failures to triage', matchedStatuses: ['failed', 'broken'], messageRegex: '(?s)\\[Triage: To triage\\].*' },
    { name: 'Test-side issues', matchedStatuses: ['failed', 'broken'], messageRegex: '(?s)\\[Triage: Test-side issue\\].*' },
    { name: 'Environment issues', matchedStatuses: ['failed', 'broken'], messageRegex: '(?s)\\[Triage: Environment issue\\].*' },
    { name: 'Skipped (account lacks the data)', matchedStatuses: ['skipped'] },
    { name: 'Not run yet', matchedStatuses: ['unknown'] },
  ], null, 2));
  fs.writeFileSync(path.join(RESULTS, 'environment.properties'), [
    `Device=${device}`, `App=${app}`, 'Backend=accountsbeta.saleshiker.com (beta)',
    `Modules=${new Set(ids.map((id) => moduleOf(id).label)).size}`, `Tests=${ids.length}`,
    'Source=latest PASS/FAIL per test (docs/test-execution-ledger.json)',
  ].join('\n'));
  fs.writeFileSync(path.join(RESULTS, 'executor.json'), JSON.stringify({
    name: 'SalesHiker mobile runner', type: 'local', reportName: 'SalesHiker Mobile: all modules',
    buildName: `All modules ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  }));
  return { ids, counts };
}

const state = await trackerState();
const { ids, counts } = main(state);

// Generate twice: the folder report gives the history for the next trend; the single file is what people open.
const ALLURE = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'allure.cmd' : 'allure');
const allure = (args) => spawnSync(`"${ALLURE}" ${args.map((a) => `"${a}"`).join(' ')}`, { cwd: ROOT, encoding: 'utf8', shell: true });
const tmp = path.join(OUT, '.full');
let gen = allure(['generate', RESULTS, '--clean', '-o', tmp]);
if (gen.status === 0) {
  fs.rmSync(HISTORY, { recursive: true, force: true });
  fs.cpSync(path.join(tmp, 'history'), HISTORY, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });
  const single = path.join(OUT, '.single');
  gen = allure(['generate', RESULTS, '--clean', '--single-file', '-o', single]);
  if (gen.status === 0) {
    fs.copyFileSync(path.join(single, 'index.html'), path.join(OUT, 'index.html'));
    fs.rmSync(single, { recursive: true, force: true });
  }
}
if (gen.status !== 0) {
  console.error(`Allure report not generated: ${(gen.stderr || gen.stdout || '').trim()}`);
  process.exit(1);
}
const summary = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ');
console.log(`All-modules Allure report: ${path.relative(ROOT, path.join(OUT, 'index.html'))} (${ids.length} tests: ${summary})`);
