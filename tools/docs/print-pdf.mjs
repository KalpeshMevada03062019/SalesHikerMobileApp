// Prints an HTML file to an A4 PDF with the installed Chrome or Edge (DevTools protocol, no extra packages).
// Shared by the framework overview (tools/docs/framework-overview.mjs) and the defect evidence PDFs
// (tools/excel/evidence-pdfs.mjs).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ---------------------------------------------------------------- PDF (installed Chrome or Edge, DevTools protocol)
export function browserPath() {
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

export async function printPdf(htmlFile, pdfFile, footer) {
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
