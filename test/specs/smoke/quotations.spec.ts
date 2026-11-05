import { expect } from 'chai';
import { quotationsPage, QUOTATION_STATUSES, QUOTATION_TEXTS } from '../../../src/pages/QuotationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openQuotations } from '../../helpers/quotations.js';

describe('Smoke: quotations', () => {
  requiresAccount();

  it('MQTN-001 Quotations opens with the count, search, status filters and quotations', async () => {
    await openQuotations();
    const p = quotationsPage;
    expect(await p.count(), 'quotations').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(QUOTATION_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.title || !/^₹[0-9,]+([.][0-9]{1,2})?$/.test(r.amount) || !/^(QT|QUO)-[0-9]+$/.test(r.number)
      || !/^[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?$/.test(r.date) || !(QUOTATION_STATUSES as readonly string[]).includes(r.status));
    expect(bad.map((r) => r.label), 'rows without title, amount, number, date or a known status').to.deep.equal([]);
    await checkpoint('MQTN-001 quotations');
  });
});
