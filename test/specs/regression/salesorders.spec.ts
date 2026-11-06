// Sales orders, read only: status chips, search, and the detail of the QA sales order with its line items,
// totals, the quotation it came from and its actions menu (opened and closed). New sales order, Download
// PDF, Edit and every menu action are never tapped.
import { expect } from 'chai';
import { salesOrdersPage, salesOrderDetailPage, SALES_ORDER_STATUSES, SALES_ORDER_ACTIONS, SALES_ORDER_TEXTS } from '../../../src/pages/SalesOrdersPage.js';
import { quotationDetailPage } from '../../../src/pages/QuotationsPage.js';
import { money } from '../../../src/pages/SalesDocumentPages.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { salesOrderData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openSalesOrder, openSalesOrders } from '../../helpers/salesorders.js';

const cents = (n: number) => Math.round(n * 100);

describe('Sales orders: filters, search and detail (nothing is changed)', () => {
  requiresAccount();

  it('MSOR-002 Status counts add up to all sales orders', async () => {
    await openSalesOrders();
    const p = salesOrdersPage;
    const all = await p.count();
    const counts: string[] = [];
    let sum = 0;
    for (const s of SALES_ORDER_STATUSES) { const n = await p.selectFilter(s); counts.push(`${s} ${n}`); sum += n; }
    await checkpoint('MSOR-002 last status');
    expect(sum, `${counts.join(' + ')} vs All ${all}`).to.equal(all);
  });

  it('MSOR-003 Each status filter shows only sales orders with that status', async () => {
    await openSalesOrders();
    const p = salesOrdersPage;
    const problems: string[] = [];
    for (const s of SALES_ORDER_STATUSES) {
      await p.selectFilter(s);
      const rows = await p.visibleRows();
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (await p.isFilterSelected('All')) problems.push(`${s}: All still selected`);
      if (!rows.length) problems.push(`${s}: no sales orders`);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    await checkpoint('MSOR-003 last status');
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MSOR-004 Search finds a sales order by number or subject in any letter case', async () => {
    await openSalesOrders();
    const p = salesOrdersPage;
    await p.search(salesOrderData.number.toLowerCase());
    const byNumber = await p.visibleRows();
    expect(byNumber.map((r) => r.number), `results for "${salesOrderData.number.toLowerCase()}"`).to.deep.equal([salesOrderData.number]);
    expect(byNumber[0]!.title, 'subject').to.equal(salesOrderData.title);
    await p.search(salesOrderData.titleSearch.toUpperCase());
    const bySubject = await p.visibleRows();
    await checkpoint('MSOR-004 by subject');
    expect(bySubject.map((r) => r.number), `results for "${salesOrderData.titleSearch.toUpperCase()}"`).to.include(salesOrderData.number);
    expect(bySubject.filter((r) => !r.title.toLowerCase().includes(salesOrderData.titleSearch)).map((r) => r.label), 'results without the words').to.deep.equal([]);
    expect(await p.count(), 'count vs results').to.equal(bySubject.length);
  });

  it('MSOR-005 An unknown word finds no sales orders and Clear filters restores the list', async () => {
    await openSalesOrders();
    const p = salesOrdersPage;
    const all = await p.count();
    await p.search(salesOrderData.noMatch);
    expect(await p.isEmptyStateShown(), `"${SALES_ORDER_TEXTS.noOrders}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${SALES_ORDER_TEXTS.noOrdersHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MSOR-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(SALES_ORDER_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MSOR-006 The sales order detail shows its number, status, amount and subject as on the list', async function () {
    const row = await openSalesOrder(this, salesOrderData.number);
    const d = salesOrderDetailPage;
    expect(await d.text(d.selectors.number), 'number').to.equal(row.number);
    expect(await d.text(d.selectors.status), 'status').to.equal(row.status);
    expect(await d.text(d.selectors.amount), 'amount').to.equal(row.amount);
    expect(await d.text(d.selectors.title), 'subject').to.equal(row.title);
    await checkpoint('MSOR-006 detail');
    await d.goBack();
    await salesOrdersPage.waitForDisplayed();
    expect((await salesOrdersPage.visibleRows()).map((r) => r.number), 'list after Back').to.include(row.number);
  });

  it('MSOR-007 Line items, taxes and the total add up to the sales order amount', async function () {
    const row = await openSalesOrder(this, salesOrderData.number);
    const d = salesOrderDetailPage;
    const lines = await d.lineItems();
    expect(lines.length, 'line items vs LINE ITEMS count').to.equal(Number(await d.text(d.selectors.lineCount)));
    expect(lines.filter((l) => cents(l.quantity * l.price) !== cents(l.total)).map((l) => `${l.quantity} x ${l.price} = ${l.total}`), 'lines where quantity x price is not the line total').to.deep.equal([]);
    const totals = await d.totals();
    await checkpoint('MSOR-007 totals');
    const subtotal = totals.find((t) => t.label === 'Subtotal')?.amount;
    const total = totals.find((t) => t.label === 'Total')?.amount;
    expect(subtotal, 'Subtotal').to.not.equal(undefined);
    expect(cents(subtotal!), 'Subtotal vs the sum of the lines').to.equal(cents(lines.reduce((s, l) => s + l.total, 0)));
    const adjustments = totals.filter((t) => t.label !== 'Subtotal' && t.label !== 'Total');
    expect(cents(total!), `Total vs Subtotal ${adjustments.map((t) => `${t.label} ${t.amount}`).join(', ')}`).to.equal(cents(subtotal! + adjustments.reduce((s, t) => s + t.amount, 0)));
    expect(cents(total!), 'Total vs the amount on the list').to.equal(cents(money(row.amount)));
  });

  it('MSOR-008 The sales order links to its quotation with the same amount and lines', async function () {
    const row = await openSalesOrder(this, salesOrderData.number);
    const d = salesOrderDetailPage;
    const lines = await d.lineItems();
    await d.scrollTo(d.selectors.related('Quotation'));
    expect(await d.relatedLabel('Quotation'), 'Quotation').to.equal(`Quotation, ${salesOrderData.quotation}`);
    expect(await d.relatedLabel('Assigned to'), 'Assigned to').to.match(/^Assigned to, .+/);
    expect(await $(d.selectors.button('Download PDF')).isExisting(), 'Download PDF (not tapped)').to.equal(true);
    expect(await $(d.selectors.button('Edit')).isExisting(), 'Edit (not tapped)').to.equal(true);
    await $(d.selectors.related('Quotation')).click();
    const q = quotationDetailPage;
    await q.waitForDisplayed(15_000);
    await checkpoint('MSOR-008 quotation');
    expect(await q.text(q.selectors.number), 'quotation number').to.equal(salesOrderData.quotation);
    expect(await q.text(q.selectors.amount), 'quotation amount vs sales order').to.equal(row.amount);
    expect(await q.lineItems(), 'quotation lines vs sales order').to.deep.equal(lines);
    await q.goBack();
    await d.waitForDisplayed(15_000);
    expect(await d.text(d.selectors.number), 'back on the sales order').to.equal(row.number);
  });

  it('MSOR-009 The actions menu offers status, invoice, delivery, expense, PDF, notes, task, edit and delete', async function () {
    await openSalesOrder(this, salesOrderData.number);
    const options = await salesOrderDetailPage.actionOptions(SALES_ORDER_ACTIONS);
    await checkpoint('MSOR-009 closed');
    expect(options.map((o) => o.label), 'Sales order actions').to.deep.equal([...SALES_ORDER_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled actions').to.deep.equal([]);
    expect(await salesOrderDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });
});
