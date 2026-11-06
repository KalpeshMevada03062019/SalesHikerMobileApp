// What the all-modules reports (tools/allure, tools/html) need to know about every automated test: its spec
// and title, its module and test case (tools/excel/modules), its latest recorded result
// (docs/test-execution-ledger.json) and its defect status or triage classification (the defect tracker).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPORTS = path.join(ROOT, 'reports');
export const ID_PATTERN = /^([A-Z]+(?:-[A-Z]+)?-\d+)\b/;
export const DT_FILE = path.join(ROOT, 'docs', 'SalesHiker_Mobile_Defect_Tracker.xlsx');
const LEDGER_FILE = path.join(ROOT, 'docs', 'test-execution-ledger.json');
const SPEC_DIR = path.join(ROOT, 'test', 'specs');
// Tests that have no sheet in the workbooks.
const EXTRA_MODULES = [{ prefix: 'REG-NAV-', label: 'Navigation (tabs and More)' }];

const cellText = (v) => (v && typeof v === 'object' ? v.text || v.result || '' : v == null ? '' : String(v));

/** Test ID -> { file (repo-relative), title ("ID title") } for every it() in test/specs. */
export function specIndex(dir = SPEC_DIR, index = new Map()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) specIndex(file, index);
    else if (e.name.endsWith('.spec.ts')) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bit\(\s*['"`]([A-Z]+(?:-[A-Z]+)?-\d+) ([^'"`]*)/g)) {
        index.set(m[1], { file: path.relative(ROOT, file).replace(/\\/g, '/'), title: `${m[1]} ${m[2]}` });
      }
    }
  }
  return index;
}

/** Defect ID -> tracker status, and test ID -> triage classification ("Failures to triage" sheet). */
export async function trackerState() {
  const defects = new Map();
  const triage = new Map();
  if (!fs.existsSync(DT_FILE)) return { defects, triage };
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DT_FILE);
  wb.eachSheet((ws) => {
    if (ws.name === 'Summary') return;
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (ws.name === 'Failures to triage') {
        const id = cellText(row.getCell(1).value);
        if (id) triage.set(id, cellText(row.getCell(7).value));
        continue;
      }
      const id = (cellText(row.getCell(4).value).match(/^([A-Z]+-D\d+)/) || [])[1];
      if (id) defects.set(id, cellText(row.getCell(12).value));
    }
  });
  return { defects, triage };
}

/**
 * Everything about the tests in the specs, in workbook order (module by module, then spec-only tests):
 * ids, the ledger, specs, test cases, defects and moduleOf(id).
 */
export function loadCatalog() {
  const modules = require(path.join(ROOT, 'tools', 'excel', 'modules'));
  const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
  const specs = specIndex();
  const cases = new Map();
  const defectsById = new Map();
  for (const mod of modules) {
    for (const tc of mod.cases) cases.set(tc.id, { tc, mod });
    for (const d of mod.defects) defectsById.set(d.id, d);
  }
  const moduleOf = (id) => cases.get(id)?.mod || EXTRA_MODULES.find((m) => id.startsWith(m.prefix)) || { label: 'Other' };
  const ids = [...new Set([...cases.keys(), ...specs.keys()])].filter((id) => specs.has(id));
  return { modules, ledger, specs, cases, defectsById, moduleOf, ids };
}

const runCache = new Map();
/** Seconds per test ID from a run's results.json (written by the runner), when the run folder is kept. */
export function runSeconds(run) {
  if (!runCache.has(run)) {
    const file = path.join(REPORTS, run, 'results.json');
    const byId = new Map();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
      for (const t of data.tests || data || []) {
        const id = String(t.Test || '').split(' ')[0];
        if (id) byId.set(id, Number(t.Seconds) || 0);
      }
    }
    runCache.set(run, byId);
  }
  return runCache.get(run);
}
