import { expect } from 'chai';
import { documentsPage, DOCUMENT_TEXTS } from '../../../src/pages/DocumentsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openDocuments } from '../../helpers/documents.js';

describe('Smoke: documents', () => {
  requiresAccount();

  it('MDOC-001 Documents opens with the count, search, upload and the documents', async () => {
    await openDocuments();
    const p = documentsPage;
    const count = await p.count();
    expect(count, 'documents').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(DOCUMENT_TEXTS.searchHint);
    expect(await $(p.selectors.upload).isExisting(), 'Upload document (not tapped)').to.equal(true);
    const rows = await p.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(rows.filter((r) => !r.name || !r.date || !r.size || !r.folder).map((r) => r.name), 'rows without name, date, size or folder').to.deep.equal([]);
    if (count <= rows.length) expect(await p.footer(), 'footer').to.deep.equal({ shown: count, total: count });
    await checkpoint('MDOC-001 documents');
  });
});
