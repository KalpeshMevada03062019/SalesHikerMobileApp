// Invoices, read only: status chips, search, and the detail of two reference invoices: INV-300005 (paid in two
// payments, a discounted line and a deducted tax, made from SO-077380) and INV-004221 (partially paid). New
// invoice, Record payment, Share and every menu action are never tapped.
import { expect } from 'chai';
import { invoicesPage, invoiceDetailPage, money, INVOICE_STATUSES, INVOICE_ACTIONS, INVOICE_TEXTS } from '../../../src/pages/InvoicesPage.js';
import { salesOrderDetailPage } from '../../../src/pages/SalesOrdersPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { invoiceData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openInvoice, openInvoices } from '../../helpers/invoices.js';

const cents = (n: number) => Math.round(n * 100);

describe('Invoices: filters, search, calculations and payments (nothing is changed)', () => {
  requiresAccount();

  it('MINV-002 Status counts add up to all invoices', async () => {
    await openInvoices();
    const p = invoicesPage;
    const all = await p.count();
    const counts: string[] = [];
    let sum = 0;
    for (const s of INVOICE_STATUSES) { const n = await p.selectFilter(s); counts.push(`${s} ${n}`); sum += n; }
    await checkpoint('MINV-002 last status');
    expect(sum, `${counts.join(' + ')} vs All ${all}`).to.equal(all);
  });

  it('MINV-003 Each status filter shows only invoices with that status', async () => {
    await openInvoices();
    const p = invoicesPage;
    const problems: string[] = [];
    const checked: string[] = [];
    for (const s of INVOICE_STATUSES) {
      const n = await p.selectFilter(s);
      const rows = await p.invoiceRows();
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (await p.isFilterSelected('All')) problems.push(`${s}: All still selected`);
      // A status nobody holds today (Approved on 2026-11-06) must show the empty state with count 0.
      if (!rows.length && !(n === 0 && (await p.isEmptyStateShown(5_000)))) problems.push(`${s}: no invoices but count ${n}`);
      if (rows.length) checked.push(s);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    await checkpoint('MINV-003 last status');
    expect(problems, `status filters: ${problems.join('; ')}`).to.deep.equal([]);
    expect(checked.length, `statuses with invoices: ${checked.join(', ')}`).to.be.greaterThan(1);
  });

  it('MINV-004 Search finds an invoice by number or subject in any letter case', async () => {
    await openInvoices();
    const p = invoicesPage;
    await p.search(invoiceData.paid.toLowerCase());
    const byNumber = await p.invoiceRows();
    expect(byNumber.map((r) => r.number), `results for "${invoiceData.paid.toLowerCase()}"`).to.deep.equal([invoiceData.paid]);
    await p.search(invoiceData.titleSearch.toUpperCase());
    const bySubject = await p.invoiceRows();
    await checkpoint('MINV-004 by subject');
    expect(bySubject.map((r) => r.number), `results for "${invoiceData.titleSearch.toUpperCase()}"`).to.include(invoiceData.partial);
    expect(bySubject.filter((r) => !r.title.toLowerCase().includes(invoiceData.titleSearch)).map((r) => r.label), 'results without the words').to.deep.equal([]);
    expect(await p.count(), 'count vs results').to.equal(bySubject.length);
  });

  it('MINV-005 An unknown word finds no invoices and Clear filters restores the list', async () => {
    await openInvoices();
    const p = invoicesPage;
    const all = await p.count();
    await p.search(invoiceData.noMatch);
    expect(await p.isEmptyStateShown(), `"${INVOICE_TEXTS.noInvoices}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${INVOICE_TEXTS.noInvoicesHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MINV-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(INVOICE_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MINV-006 The invoice detail shows its number, status, amount, subject and due date as on the list', async function () {
    const row = await openInvoice(this, invoiceData.partial);
    const d = invoiceDetailPage;
    expect(await d.text(d.selectors.number), 'number').to.equal(row.number);
    expect(await d.text(d.selectors.status), 'status').to.equal(row.status);
    expect(await d.text(d.selectors.amount), 'amount').to.equal(row.amount);
    expect(await d.text(d.selectors.title), 'subject').to.equal(row.title);
    expect(await d.text(d.invoice.due), 'due date (with the year)').to.match(new RegExp(`^${row.due} [0-9]{4}$`));
    await checkpoint('MINV-006 detail');
    await d.goBack();
    await invoicesPage.waitForDisplayed();
    expect((await invoicesPage.invoiceRows()).map((r) => r.number), 'list after Back').to.include(row.number);
  });

  it('MINV-007 Line items with discount, taxes and the total add up to the invoice amount', async function () {
    const row = await openInvoice(this, invoiceData.paid);
    const d = invoiceDetailPage;
    await d.scrollTo(d.invoice.grandTotal);
    const lines = await d.invoiceLines();
    expect(lines.length, 'line items vs LINE ITEMS count').to.equal(Number(await d.text(d.selectors.lineCount)));
    expect(lines.filter((l) => cents(l.quantity * l.price * (1 - l.discount / 100)) !== cents(l.total))
      .map((l) => `${l.quantity} x ${l.price} - ${l.discount}% = ${l.total}`), 'lines where quantity x price less the discount is not the line total').to.deep.equal([]);
    const totals = await d.totals();
    await checkpoint('MINV-007 totals');
    const subtotal = totals.find((t) => t.label === 'Subtotal')?.amount;
    const total = totals.find((t) => t.label === 'Total')?.amount;
    expect(subtotal, 'Subtotal').to.not.equal(undefined);
    expect(cents(subtotal!), 'Subtotal vs the sum of the lines').to.equal(cents(lines.reduce((s, l) => s + l.total, 0)));
    const adjustments = totals.filter((t) => t.label !== 'Subtotal' && t.label !== 'Total');
    expect(cents(total!), `Total vs Subtotal ${adjustments.map((t) => `${t.label} ${t.amount}`).join(', ')}`).to.equal(cents(subtotal! + adjustments.reduce((s, t) => s + t.amount, 0)));
    expect(cents(total!), 'Total vs the amount on the list').to.equal(cents(money(row.amount)));
  });

  it('MINV-008 A paid invoice shows its payments adding up to the total with nothing due', async function () {
    const row = await openInvoice(this, invoiceData.paid);
    const d = invoiceDetailPage;
    const [total, paid, due, progress, payments] = [await d.payment('Total'), await d.payment('Paid'), await d.payment('Balance due'), await d.progress(), await d.payments()];
    await checkpoint('MINV-008 payment');
    expect(row.status, 'status on the list').to.equal('Paid');
    expect(cents(total), 'PAYMENT Total vs the invoice amount').to.equal(cents(money(row.amount)));
    expect(payments.length, 'payments listed').to.be.greaterThan(0);
    expect(cents(payments.reduce((s, p) => s + p.amount, 0)), `Paid vs the payments ${payments.map((p) => p.amount).join(' + ')}`).to.equal(cents(paid));
    expect(cents(due), 'Balance due').to.equal(0);
    expect(cents(paid), 'Paid vs Total').to.equal(cents(total));
    expect(progress, 'progress').to.equal(100);
    expect(await $(d.invoice.bottomButton('Record payment')).isExisting(), 'Record payment on a paid invoice').to.equal(false);
    expect(await $(d.invoice.shareHint).isExisting(), `"${INVOICE_TEXTS.shareHint}"`).to.equal(true);
  });

  it('MINV-009 A partially paid invoice shows paid, balance and progress that agree with each other and its payments', async function () {
    const row = await openInvoice(this, invoiceData.partial);
    const d = invoiceDetailPage;
    const [total, paid, due, progress, payments] = [await d.payment('Total'), await d.payment('Paid'), await d.payment('Balance due'), await d.progress(), await d.payments()];
    const balance = money(await d.text(d.invoice.balance));
    await checkpoint('MINV-009 payment');
    expect(row.status, 'status on the list').to.equal('Partially Paid');
    expect(cents(total), 'PAYMENT Total vs the invoice amount').to.equal(cents(money(row.amount)));
    expect(cents(paid), 'Paid vs the list').to.equal(cents(money(row.paid)));
    expect(cents(due), 'Balance due = Total - Paid').to.equal(cents(total - paid));
    expect(cents(balance), 'Balance in the summary vs Balance due').to.equal(cents(due));
    expect(progress, 'progress').to.equal(Math.round((paid / total) * 100));
    expect(await $(d.invoice.bottomButton('Record payment')).isExisting(), 'Record payment (not tapped)').to.equal(true);
    expect(cents(payments.reduce((s, p) => s + p.amount, 0)), `Paid vs the payments listed ${payments.map((p) => p.amount).join(' + ')}`).to.equal(cents(paid));
  });

  it('MINV-010 The invoice links to its sales order and the sales order lists the invoice', async function () {
    const row = await openInvoice(this, invoiceData.paid);
    const d = invoiceDetailPage;
    await d.scrollTo(d.selectors.related('Sales order'));
    expect(await d.relatedLabel('Sales order'), 'Sales order').to.equal(`Sales order, ${invoiceData.salesOrder}`);
    await $(d.selectors.related('Sales order')).click();
    const so = salesOrderDetailPage;
    await so.waitForDisplayed(60_000);
    expect(await so.text(so.selectors.number), 'sales order number').to.equal(invoiceData.salesOrder);
    const entry = await d.salesOrderInvoice(row.number);
    await checkpoint('MINV-010 sales order');
    expect(entry, 'INVOICES entry on the sales order').to.equal(`${row.status}, ${row.number}, ${row.amount}`);
    await so.goBack();
    // The invoice comes back scrolled to RELATED, with its summary off-screen.
    await $(d.selectors.related('Sales order')).waitForDisplayed({ timeout: 60_000 });
    expect(await d.relatedLabel('Sales order'), 'back on the invoice').to.equal(`Sales order, ${invoiceData.salesOrder}`);
    expect(await $(d.selectors.text('Invoice')).isExisting(), 'Invoice title').to.equal(true);
  });

  it('MINV-011 The actions menu offers status, payment, PDF, share, delivery, expense, notes, task, edit and delete', async function () {
    await openInvoice(this, invoiceData.partial);
    const options = await invoiceDetailPage.actionOptions(INVOICE_ACTIONS);
    await checkpoint('MINV-011 closed');
    expect(options.map((o) => o.label), 'Invoice actions').to.deep.equal([...INVOICE_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled actions').to.deep.equal([]);
    expect(await invoiceDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });
});
