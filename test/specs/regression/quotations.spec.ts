// Quotations, read only: status chips, search, and the detail of the QA quotation with its line items,
// totals, related records and actions menu (opened and closed). Change status, Convert to sales order,
// View PDF, Share link, Download PDF and Share are never tapped.
import { expect } from 'chai';
import { quotationsPage, quotationDetailPage, money, QUOTATION_STATUSES, QUOTATION_ACTIONS, QUOTATION_TEXTS } from '../../../src/pages/QuotationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { quotationData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openQuotation, openQuotations } from '../../helpers/quotations.js';

const cents = (n: number) => Math.round(n * 100);

describe('Quotations: filters, search and detail (nothing is changed)', () => {
  requiresAccount();

  it('MQTN-002 Status counts add up to all quotations', async () => {
    await openQuotations();
    const p = quotationsPage;
    const all = await p.count();
    const counts: string[] = [];
    let sum = 0;
    for (const s of QUOTATION_STATUSES) { const n = await p.selectFilter(s); counts.push(`${s} ${n}`); sum += n; }
    await checkpoint('MQTN-002 last status');
    expect(sum, `${counts.join(' + ')} vs All ${all}`).to.equal(all);
  });

  it('MQTN-003 Each status filter shows only quotations with that status', async () => {
    await openQuotations();
    const p = quotationsPage;
    const problems: string[] = [];
    for (const s of QUOTATION_STATUSES) {
      await p.selectFilter(s);
      const rows = await p.visibleRows();
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (await p.isFilterSelected('All')) problems.push(`${s}: All still selected`);
      if (!rows.length) problems.push(`${s}: no quotations`);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    await checkpoint('MQTN-003 last status');
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MQTN-004 Search finds a quotation by title or number in any letter case', async () => {
    await openQuotations();
    const p = quotationsPage;
    await p.search(quotationData.titleSearch.toUpperCase());
    const byTitle = await p.visibleRows();
    expect(byTitle.map((r) => r.number), `results for "${quotationData.titleSearch.toUpperCase()}"`).to.include(quotationData.number);
    expect(byTitle.filter((r) => !r.title.toLowerCase().includes(quotationData.titleSearch)).map((r) => r.label), 'results without the words').to.deep.equal([]);
    expect(await p.count(), 'count vs results').to.equal(byTitle.length);
    await p.search(quotationData.number.toLowerCase());
    const byNumber = await p.visibleRows();
    await checkpoint('MQTN-004 by number');
    expect(byNumber.map((r) => r.number), `results for "${quotationData.number.toLowerCase()}"`).to.deep.equal([quotationData.number]);
    expect(byNumber[0]!.title, 'title').to.equal(quotationData.title);
  });

  it('MQTN-005 An unknown word finds no quotations and Clear filters restores the list', async () => {
    await openQuotations();
    const p = quotationsPage;
    const all = await p.count();
    await p.search(quotationData.noMatch);
    expect(await p.isEmptyStateShown(), `"${QUOTATION_TEXTS.noQuotations}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${QUOTATION_TEXTS.noQuotationsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MQTN-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(QUOTATION_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MQTN-006 The quotation detail shows its number, status, amount and title as on the list', async function () {
    const row = await openQuotation(this, quotationData.number);
    const d = quotationDetailPage;
    expect(await d.text(d.selectors.number), 'number').to.equal(row.number);
    expect(await d.text(d.selectors.status), 'status').to.equal(row.status);
    expect(await d.text(d.selectors.amount), 'amount').to.equal(row.amount);
    expect(await d.text(d.selectors.title), 'title').to.equal(row.title);
    await checkpoint('MQTN-006 detail');
    await d.goBack();
    await quotationsPage.waitForDisplayed();
    expect((await quotationsPage.visibleRows()).map((r) => r.number), 'list after Back').to.include(row.number);
  });

  it('MQTN-007 Line items, taxes and the total add up to the quotation amount', async function () {
    const row = await openQuotation(this, quotationData.number);
    const d = quotationDetailPage;
    const lines = await d.lineItems();
    expect(lines.length, 'line items vs LINE ITEMS count').to.equal(Number(await d.text(d.selectors.lineCount)));
    expect(lines.filter((l) => cents(l.quantity * l.price) !== cents(l.total)).map((l) => `${l.quantity} x ${l.price} = ${l.total}`), 'lines where quantity x price is not the line total').to.deep.equal([]);
    const totals = await d.totals();
    await checkpoint('MQTN-007 totals');
    const subtotal = totals.find((t) => t.label === 'Subtotal')?.amount;
    const total = totals.find((t) => t.label === 'Total')?.amount;
    expect(subtotal, 'Subtotal vs the sum of the lines').to.not.equal(undefined);
    expect(cents(subtotal!), 'Subtotal vs the sum of the lines').to.equal(cents(lines.reduce((s, l) => s + l.total, 0)));
    const adjustments = totals.filter((t) => t.label !== 'Subtotal' && t.label !== 'Total');
    expect(cents(total!), `Total vs Subtotal ${adjustments.map((t) => `${t.label} ${t.amount}`).join(', ')}`).to.equal(cents(subtotal! + adjustments.reduce((s, t) => s + t.amount, 0)));
    expect(cents(total!), 'Total vs the amount on the list').to.equal(cents(money(row.amount)));
  });

  it('MQTN-008 The quotation shows who it is assigned to, its sales order and the share options', async function () {
    const row = await openQuotation(this, quotationData.number);
    const d = quotationDetailPage;
    await d.scrollTo(d.selectors.text(QUOTATION_TEXTS.shareHint));
    expect(await d.relatedLabel('Assigned to'), 'Assigned to').to.match(/^Assigned to, .+/);
    expect(await d.relatedLabel('Sales order'), 'Sales order').to.match(new RegExp(`^Sales order, [A-Za-z ]+, SO-[0-9]+, ${row.amount.replace(/[.]/g, '[.]')}$`));
    expect(await $(d.selectors.text(QUOTATION_TEXTS.shareHint)).isExisting(), `"${QUOTATION_TEXTS.shareHint}"`).to.equal(true);
    expect(await $(d.selectors.button('Download PDF')).isExisting(), 'Download PDF (not tapped)').to.equal(true);
    expect(await $(d.selectors.button('Share')).isExisting(), 'Share (not tapped)').to.equal(true);
    await checkpoint('MQTN-008 related');
  });

  it('MQTN-009 The actions menu offers its actions and blocks a second sales order', async function () {
    await openQuotation(this, quotationData.number);
    const options = await quotationDetailPage.actionOptions(QUOTATION_ACTIONS);
    await checkpoint('MQTN-009 closed');
    expect(options.map((o) => o.label.split(', ')[0]), 'Quotation actions').to.deep.equal([...QUOTATION_ACTIONS]);
    const convert = options.find((o) => o.label.startsWith('Convert to sales order'))!;
    expect(convert.label, 'Convert to sales order reason').to.equal(`Convert to sales order, ${QUOTATION_TEXTS.hasSalesOrder}`);
    expect(convert.enabled, 'Convert to sales order enabled').to.equal(false);
    expect(options.filter((o) => o !== convert && !o.enabled).map((o) => o.label), 'disabled actions').to.deep.equal([]);
    expect(await quotationDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });
});
