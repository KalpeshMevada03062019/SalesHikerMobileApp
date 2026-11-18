import { expect } from 'chai';
import { priceBooksPage, PRICE_BOOK_TEXTS } from '../../../src/pages/PriceBooksPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openPriceBooks } from '../../helpers/pricebooks.js';

describe('Smoke: price books', () => {
  requiresAccount();

  it('MPBK-001 Price Books opens with the count, search, status chips and the price books', async () => {
    await openPriceBooks();
    const p = priceBooksPage;
    const count = await p.count();
    expect(count, 'price books').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(PRICE_BOOK_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New price book (not tapped)').to.equal(true);
    expect((await p.chipCounts()).All, 'All chip count').to.equal(count);
    expect(await p.isChipSelected('All'), 'All selected').to.equal(true);
    const rows = await p.rowsOnScreen();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.name || !/^[A-Z]{3}, [0-9]+ prices?(, .+)?$/.test(r.info));
    expect(bad.map((r) => r.label), 'rows without a name or "currency, n prices"').to.deep.equal([]);
    if (rows.length === count) expect(await p.endOfListText(), 'end of list').to.equal(`End of list. ${count} price book${count === 1 ? '' : 's'}.`);
    await checkpoint('MPBK-001 price books');
  });
});
