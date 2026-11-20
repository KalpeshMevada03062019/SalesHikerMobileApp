// Defect screenshots on Google Drive. Rule: only defect evidence is stored, i.e. the screenshots of logged defects
// (identical copies once), all in one folder, "SalesHiker Mobile QA/SalesHiker Mobile Android Defect" (`root` below),
// named "<DEFECT-ID> - <n> - <file>". The links live in tools/excel/drive-evidence.json and the next `npm run excel`
// links each defect's screenshots in the defect tracker (column N, Screenshot/Video).
//
//   npm run evidence:drive
//       Lists the screenshots not on Drive yet (new, or changed since their upload) and writes them to
//       docs/defect-evidence/drive-upload-list.json (defect, file, SHA-256, MIME type, Drive title, folder if known).
//   npm run evidence:drive -- --root <folderId> <url>
//   npm run evidence:drive -- --image <DEFECT-ID> <project-relative file> <fileId> <url>
//       Record an uploaded folder / image (the SHA-256 is taken from the evidence index).
//
// The evidence index (docs/defect-evidence/evidence-index.json) is written by `npm run excel`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX = join(ROOT, 'docs', 'defect-evidence', 'evidence-index.json');
const LIST = join(ROOT, 'docs', 'defect-evidence', 'drive-upload-list.json');
const LINKS = join(ROOT, 'tools', 'excel', 'drive-evidence.json');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback);
const index = () => {
  const i = readJson(INDEX, null);
  if (!i) throw new Error('docs/defect-evidence/evidence-index.json is missing: run npm run excel first');
  return i;
};
const loadLinks = () => ({ root: null, defects: {}, ...readJson(LINKS, {}) });
function saveLinks(links) {
  links.defects = Object.fromEntries(Object.entries(links.defects).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LINKS, JSON.stringify(links, null, 2) + '\n');
}

function list() {
  const links = loadLinks();
  const todo = [];
  let linked = 0;
  for (const e of index()) {
    const done = (links.defects[e.id] && links.defects[e.id].images) || {};
    const listed = new Set();
    e.images.forEach((im, n) => {
      if (done[im.file] && done[im.file].sha256 === im.sha256) return;
      // The same image is already on Drive under another name (e.g. a run's step screenshot and its failure screenshot):
      // link that file instead of uploading a copy.
      const same = Object.values(done).find((u) => u.sha256 === im.sha256);
      if (same) { done[im.file] = { ...same }; links.defects[e.id].images = done; linked++; return; }
      if (listed.has(im.sha256)) return;
      listed.add(im.sha256);
      todo.push({
        id: e.id, file: im.file, path: join(ROOT, im.file).split('\\').join('/'), sha256: im.sha256,
        mime: MIME[extname(im.file).toLowerCase()] || 'application/octet-stream',
        title: `${e.id} - ${n + 1} - ${basename(im.file)}`, caption: im.caption,
        folderId: (links.root && links.root.folderId) || null, replaceFileId: (done[im.file] && done[im.file].fileId) || null,
      });
    });
  }
  if (linked) saveLinks(links);
  writeFileSync(LIST, JSON.stringify(todo, null, 2) + '\n');
  console.log(todo.length ? `${todo.length} screenshot(s) to upload (${new Set(todo.map((t) => t.id)).size} defects): ${LIST}` : 'Every defect screenshot is on Google Drive.');
}

function record(kind, args) {
  const links = loadLinks();
  const today = new Date().toISOString().slice(0, 10);
  if (kind === '--root') {
    const [folderId, url] = args;
    if (!folderId || !url) throw new Error('usage: --root <folderId> <url>');
    links.root = { folderId, url };
  } else if (kind === '--folder') {
    const [id, folderId, url] = args;
    if (!id || !folderId || !url) throw new Error('usage: --folder <DEFECT-ID> <folderId> <url>');
    links.defects[id] = { ...(links.defects[id] || { images: {} }), folderId, url };
  } else {
    const [id, file, fileId, url] = args;
    if (!id || !file || !fileId || !url) throw new Error('usage: --image <DEFECT-ID> <file> <fileId> <url>');
    const im = (index().find((e) => e.id === id) || { images: [] }).images.find((i) => i.file === file);
    if (!im) throw new Error(`${file} is not a screenshot of ${id} in the evidence index`);
    links.defects[id] = links.defects[id] || { images: {} };
    const entry = { fileId, url, sha256: im.sha256, uploaded: today };
    links.defects[id].images = { ...(links.defects[id].images || {}), [file]: entry };
    // Identical copies of this image in the same defect point to the same Drive file.
    for (const other of index().find((e) => e.id === id).images) if (other.sha256 === im.sha256) links.defects[id].images[other.file] = { ...entry };
  }
  saveLinks(links);
}

const [kind, ...args] = process.argv.slice(2);
try {
  if (['--root', '--folder', '--image'].includes(kind)) record(kind, args); else list();
} catch (e) { console.error(e.message); process.exit(1); }
