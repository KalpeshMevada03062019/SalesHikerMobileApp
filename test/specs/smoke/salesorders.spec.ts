import { expect } from 'chai';
import { salesOrdersPage, SALES_ORDER_STATUSES, SALES_ORDER_TEXTS } from '../../../src/pages/SalesOrdersPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openSalesOrders } from '../../helpers/salesorders.js';

describe('Smoke: sales orders', () => {
  requiresAccount();

  it('MSOR-001 Sales orders opens with the count, search, status filters and orders', async () => {
    await openSalesOrders();
    const p = salesOrdersPage;
    expect(await p.count(), 'sales orders').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(SALES_ORDER_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New sales order (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.title || !/^₹[0-9,]+([.][0-9]{1,2})?$/.test(r.amount) || !r.number
      || !/^[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?$/.test(r.date) || !(SALES_ORDER_STATUSES as readonly string[]).includes(r.status));
    expect(bad.map((r) => r.label), 'rows without title, amount, number, date or a known status').to.deep.equal([]);
    await checkpoint('MSOR-001 sales orders');
  });
});
