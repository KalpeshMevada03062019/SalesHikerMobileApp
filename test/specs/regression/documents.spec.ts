// Documents, read only: rows, search, the Actions sheet (opened and closed) and a document detail reached
// through Actions > Details. Upload, Open, Download, Share, Rename and Delete are never tapped, and rows
// are never tapped (that may open the file).
import { expect } from 'chai';
import { documentsPage, documentDetailPage, DOCUMENT_ACTIONS, DOCUMENT_MORE_ACTIONS, DOCUMENT_TEXTS, type DocumentRow } from '../../../src/pages/DocumentsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { documentData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openDocuments, openFirstDocument } from '../../helpers/documents.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SIZE = /^[0-9]+([.][0-9]+)? (B|KB|MB|GB)$/;

/** Does the list date ("Fri", "29 Oct", "9:51 PM", "Yesterday") describe the detail's Created ("30 Oct, 9:51 PM")? */
function sameCreated(list: string, created: string): boolean {
  const m = created.match(/^(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))?, (.+)$/);
  if (!m) return false;
  const now = new Date();
  const d = new Date(m[3] ? Number(m[3]) : now.getFullYear(), MONTHS.indexOf(m[2]!), Number(m[1]));
  const daysAgo = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - d.getTime()) / 86_400_000);
  if (/^\d{1,2}:\d{2}/.test(list)) return daysAgo === 0 && list === m[4];
  if (list === 'Yesterday') return daysAgo === 1;
  if (WEEKDAYS.includes(list)) return WEEKDAYS[d.getDay()] === list && daysAgo < 7;
  return list.replace(/ \d{4}$/, '') === `${m[1]} ${m[2]}`;
}

describe('Documents: list, search and detail (nothing is changed)', () => {
  requiresAccount();

  it('MDOC-002 Each document shows its name, a readable date, its size and folder, and an actions button', async () => {
    await openDocuments();
    const p = documentsPage;
    const rows = await p.visibleRows();
    const problems: string[] = [];
    for (const r of rows) {
      if (!SIZE.test(r.size)) problems.push(`${r.name}: size "${r.size}"`);
      if (!/^(\d{1,2} [A-Z][a-z]{2}( \d{4})?|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Yesterday|\d{1,2}:\d{2}( [AP]M)?)$/.test(r.date)) problems.push(`${r.name}: date "${r.date}"`);
      if (!(await $(p.selectors.actions(r.name)).isExisting())) problems.push(`${r.name}: no actions button`);
    }
    await checkpoint('MDOC-002 rows');
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(problems, 'rows').to.deep.equal([]);
  });

  it('MDOC-003 Search finds documents by name in any letter case and updates the counts', async () => {
    await openDocuments();
    const p = documentsPage;
    const all = await p.count();
    await p.search(documentData.search.toUpperCase());
    const rows = await p.visibleRows();
    const count = await p.count();
    await checkpoint('MDOC-003 search');
    expect(rows.length, `results for "${documentData.search.toUpperCase()}"`).to.be.greaterThan(0);
    expect(rows.filter((r) => !r.name.toLowerCase().includes(documentData.search)).map((r) => r.name), 'results without the word').to.deep.equal([]);
    expect(count, 'count under the title').to.equal(rows.length);
    expect(count, 'count vs all').to.be.lessThan(all);
    expect(await p.footer(), 'footer').to.deep.equal({ shown: count, total: count });
  });

  it('MDOC-004 An unknown name finds no documents and Clear Filters restores the list', async () => {
    await openDocuments();
    const p = documentsPage;
    const all = await p.count();
    await p.search(documentData.noMatch);
    expect(await p.isEmptyStateShown(), `"${DOCUMENT_TEXTS.noDocuments}"`).to.equal(true);
    expect(await $(p.selectors.noDocumentsHint).isExisting(), `"${DOCUMENT_TEXTS.noDocumentsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MDOC-004 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search box after Clear Filters').to.equal(DOCUMENT_TEXTS.searchHint);
    expect(await p.count(), 'count after Clear Filters').to.equal(all);
  });

  it('MDOC-005 The actions sheet offers open, download, share and details', async () => {
    await openDocuments();
    const p = documentsPage;
    const [row] = await p.visibleRows();
    const options = await p.openActions(row!.name);
    await checkpoint('MDOC-005 actions');
    expect(options, `actions for ${row!.name}`).to.deep.equal([...DOCUMENT_ACTIONS]);
    await p.closeActions(row!.name);
    expect((await p.visibleRows()).map((r) => r.name), 'list after closing').to.include(row!.name);
  });

  it('MDOC-006 Details shows the file name, size, folder and creation as on the list', async function () {
    const row: DocumentRow = await openFirstDocument(this);
    const d = documentDetailPage;
    expect(await d.text(d.selectors.name), 'name in the summary').to.equal(row.name);
    expect(await d.text(d.selectors.code), 'document code').to.match(/^DOC[0-9]+$/);
    expect(await d.text(d.selectors.status), 'status').to.equal('Active');
    expect(await d.value('File name'), 'File name').to.equal(row.name);
    expect(await d.value('Size'), 'Size').to.equal(row.size);
    expect(await d.value('Folder'), 'Folder').to.equal(row.folder);
    expect(await d.value('Created by'), 'Created by').to.not.equal('');
    const created = await d.value('Created');
    expect(sameCreated(row.date, created), `Created "${created}" vs list date "${row.date}"`).to.equal(true);
    expect(await d.value('Downloads'), 'Downloads').to.match(/^[0-9]+$/);
    expect(await $(d.selectors.openHint).isExisting(), `"${DOCUMENT_TEXTS.openHint}"`).to.equal(true);
    expect(await $(d.selectors.download).isExisting(), 'Download (not tapped)').to.equal(true);
    expect(await $(d.selectors.open).isExisting(), 'Open (not tapped)').to.equal(true);
    await checkpoint('MDOC-006 details');
    await d.goBack();
    await documentsPage.waitForDisplayed();
    expect((await documentsPage.visibleRows()).map((r) => r.name), 'list after Back').to.include(row.name);
  });

  it('MDOC-007 The detail menu offers rename and delete', async function () {
    await openFirstDocument(this);
    const options = await documentDetailPage.moreActionOptions();
    expect(options, 'More actions').to.deep.equal([...DOCUMENT_MORE_ACTIONS]);
    await checkpoint('MDOC-007 closed');
    expect(await documentDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });
});
