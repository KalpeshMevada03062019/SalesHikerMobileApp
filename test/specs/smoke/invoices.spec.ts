import { expect } from 'chai';
import { invoicesPage, INVOICE_STATUSES, INVOICE_TEXTS } from '../../../src/pages/InvoicesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openInvoices } from '../../helpers/invoices.js';

describe('Smoke: invoices', () => {
  requiresAccount();

  it('MINV-001 Invoices opens with the count, search, status filters and invoices', async () => {
    await openInvoices();
    const p = invoicesPage;
    expect(await p.count(), 'invoices').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(INVOICE_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New invoice (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.invoiceRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.title || !/^₹[0-9,]+([.][0-9]{1,2})?$/.test(r.amount) || !/^INV-[0-9]+$/.test(r.number)
      || (r.due && !/^Due [0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?$/.test(r.due)) || (r.paid && !/^Paid ₹[0-9,]+([.][0-9]{1,2})?$/.test(r.paid))
      || !(INVOICE_STATUSES as readonly string[]).includes(r.status));
    expect(bad.map((r) => r.label), 'rows without title, amount, number or a known status, or with a malformed due date or paid amount').to.deep.equal([]);
    await checkpoint('MINV-001 invoices');
  });
});
