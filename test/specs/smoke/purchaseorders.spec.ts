import { expect } from 'chai';
import { purchaseOrdersPage, PURCHASE_ORDER_TEXTS } from '../../../src/pages/PurchaseOrdersPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openPurchaseOrders } from '../../helpers/purchaseorders.js';

describe('Smoke: purchase orders', () => {
  requiresAccount();

  it('MPUR-001 Purchase Orders opens with the count, search, status chips and the orders', async () => {
    await openPurchaseOrders();
    const p = purchaseOrdersPage;
    const count = await p.count();
    expect(count, 'purchase orders').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(PURCHASE_ORDER_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New purchase order (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected status').to.deep.equal(['All']);
    const rows = await p.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.title || !/^₹[0-9,.]+$/.test(r.amount) || !/^PO-[0-9]+$/.test(r.number)
      || !/^[0-9]{1,2} [A-Z][a-z]{2}$/.test(r.date) || !p.filters.includes(r.status));
    expect(bad.map((r) => r.label), 'rows without supplier, amount, PO number, date or a known status').to.deep.equal([]);
    await checkpoint('MPUR-001 purchase orders');
  });
});
