import { expect } from 'chai';
import { stockReceiptsPage, RECEIPT_TEXTS } from '../../../src/pages/StockReceiptsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openStockReceipts } from '../../helpers/stockreceipts.js';

describe('Smoke: stock receipts', () => {
  requiresAccount();

  it('MSRC-001 Stock Receipts opens with the count, search and the receipts', async () => {
    await openStockReceipts();
    const p = stockReceiptsPage;
    const count = await p.count();
    expect(count, 'stock receipts').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(RECEIPT_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New stock receipt (not tapped)').to.equal(true);
    const rows = await p.rows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.supplier || !/^GRN-[0-9]+$/.test(r.number) || !r.warehouse || !r.status
      || !/^([0-9]{1,2} [A-Z][a-z]{2}|Today|Yesterday)$/.test(r.date));
    expect(bad.map((r) => r.label), 'rows without supplier, date, GRN number, warehouse or status').to.deep.equal([]);
    if (rows.length === count) expect(await p.endOfListText(), 'end of list').to.equal(`End of list. ${count} stock receipt${count === 1 ? '' : 's'}.`);
    await checkpoint('MSRC-001 stock receipts');
  });
});
