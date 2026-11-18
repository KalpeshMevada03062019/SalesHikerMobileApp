// Expenses, the whole screen: status and payment chips, search, the QA expense EXP-0008 (saved by MEXP-020) with
// its amount, tax, people, description, details and receipts, the actions menu and the Edit form (opened and
// cancelled), and the New expense form with its pickers and live calculation (filled and discarded).
// Submit, Attach, Save and every menu action are never chosen.
import { expect } from 'chai';
import { expensesPage, expenseDetailPage, newExpensePage, editExpensePage, EXPENSE_STATUSES, EXPENSE_PAYMENT_FILTERS, EXPENSE_ACTIONS,
  EXPENSE_CATEGORIES, EXPENSE_PAID_THROUGH, EXPENSE_TAXES, EXPENSE_TEXTS } from '../../../src/pages/ExpensesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { expenseData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openExpense, openExpenses, openNewExpense } from '../../helpers/expenses.js';

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

describe('Expenses: filters, search, detail, actions and the new expense form (nothing is saved)', () => {
  requiresAccount();

  it('MEXP-002 Status counts and payment counts each add up to all expenses', async () => {
    await openExpenses();
    const p = expensesPage;
    const all = await p.count();
    const read = async (names: readonly string[]) => { const c: string[] = []; let s = 0; for (const n of names) { const k = await p.selectFilter(n); c.push(`${n} ${k}`); s += k; } return { c, s }; };
    const statuses = await read(EXPENSE_STATUSES);
    // Status and payment chips are separate filter groups that combine: back to All before the payment chips.
    await p.selectFilter('All');
    const payments = await read(EXPENSE_PAYMENT_FILTERS);
    await checkpoint('MEXP-002 last filter');
    expect(statuses.s, `${statuses.c.join(' + ')} vs All ${all}`).to.equal(all);
    expect(payments.s, `${payments.c.join(' + ')} vs All ${all}`).to.equal(all);
  });

  it('MEXP-003 Each status filter shows only its expenses and the payment filters split the QA expense correctly', async () => {
    await openExpenses();
    const p = expensesPage;
    const problems: string[] = [];
    for (const s of EXPENSE_STATUSES) {
      const n = await p.selectFilter(s);
      const rows = await p.expenseRows();
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (n === 0 && !(await p.isEmptyStateShown(5_000))) problems.push(`${s}: count 0 without "${EXPENSE_TEXTS.noResults}"`);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    // Status and payment chips combine. The QA expense is a Draft and unpaid: listed under All + Payment: Unpaid
    // and Draft + Payment: Unpaid (both chips selected), not under All + Payment: Paid.
    const has = async () => (await p.expenseRows()).some((r) => r.number === expenseData.saved);
    await p.selectFilter('All');
    await p.selectFilter('Payment: Unpaid');
    if (!(await has())) problems.push(`All + Payment: Unpaid without ${expenseData.saved}`);
    await p.selectFilter('Draft');
    if (!(await p.isFilterSelected('Payment: Unpaid'))) problems.push('Payment: Unpaid not kept with Draft');
    if (!(await has())) problems.push(`Draft + Payment: Unpaid without ${expenseData.saved}`);
    await p.selectFilter('All');
    await p.selectFilter('Payment: Paid');
    if (await has()) problems.push(`All + Payment: Paid lists the unpaid ${expenseData.saved}`);
    await checkpoint('MEXP-003 last filter');
    expect(problems, `filters: ${problems.join('; ')}`).to.deep.equal([]);
  });

  it('MEXP-004 Search finds the QA expense by number, vendor, description and reference in any letter case', async () => {
    await openExpenses();
    const p = expensesPage;
    const misses: string[] = [];
    for (const term of [expenseData.saved.toLowerCase(), expenseData.vendorName.toUpperCase(), expenseData.descriptionPrefix.toLowerCase(), expenseData.reference.toLowerCase()]) {
      await p.search(term);
      if (!(await p.expenseRows()).some((r) => r.number === expenseData.saved)) misses.push(term);
    }
    await checkpoint('MEXP-004 last search');
    expect(misses, `searches without ${expenseData.saved}`).to.deep.equal([]);
  });

  it('MEXP-005 An unknown word finds no expenses and Clear filters restores the list', async () => {
    await openExpenses();
    const p = expensesPage;
    const all = await p.count();
    await p.search(expenseData.noMatch);
    expect(await p.isEmptyStateShown(), `"${EXPENSE_TEXTS.noResults}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${EXPENSE_TEXTS.noResultsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MEXP-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(EXPENSE_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MEXP-006 The expense detail shows its number, status, amount, date, category and vendor as on the list', async function () {
    const row = await openExpense(this, expenseData.saved);
    const d = expenseDetailPage;
    expect(await d.text(d.selectors.number), 'number').to.equal(row.number);
    expect(await d.summary(), 'summary').to.deep.equal({ status: row.status, amount: row.amount, date: row.date, category: expenseData.category, vendor: row.title });
    expect(await $(d.expense.submit).isExisting(), 'Submit (not tapped)').to.equal(true);
    await checkpoint('MEXP-006 detail');
    await d.goBack();
    await expensesPage.waitForDisplayed();
    expect((await expensesPage.expenseRows()).map((r) => r.number), 'list after Back').to.include(row.number);
  });

  it('MEXP-007 The amount section shows amount, tax with its rate, total, currency and payment status', async function () {
    const row = await openExpense(this, expenseData.saved);
    const d = expenseDetailPage;
    const got = { amount: await d.field('Amount'), tax: await d.field('Tax'), total: await d.field('Total'), includesTax: await d.field('Amount includes tax'),
      currency: await d.field('Currency'), payment: await d.field('Payment status') };
    await checkpoint('MEXP-007 amount');
    expect(got, 'AMOUNT').to.deep.equal({ amount: '₹1,000', tax: expenseData.savedTax, total: '₹1,100', includesTax: 'No', currency: 'INR', payment: 'Unpaid' });
    expect(got.total, 'Total vs the list amount').to.equal(row.amount);
  });

  it('MEXP-008 People, description, details and receipts show the owner, text, reference and no receipts', async function () {
    await openExpense(this, expenseData.saved);
    const d = expenseDetailPage;
    const owner = await d.field('Owner');
    const created = await d.field('Created');
    await d.scrollTo(d.expense.noReceipts);
    const got = { description: await d.text(d.expense.description), reference: await d.field('Reference no'), receipts: await d.text(d.expense.receiptCount) };
    await checkpoint('MEXP-008 details');
    expect(owner, 'Owner').to.match(/^.+$/);
    expect(created, 'Created').to.match(/^([0-9]{1,2}:[0-9]{2}|[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?)$/);
    expect(got, 'description, reference, receipts').to.deep.equal({ description: expenseData.savedDescription, reference: expenseData.reference, receipts: '0' });
    expect(await $(d.expense.noReceipts).isExisting(), 'No receipts message').to.equal(true);
    expect(await $(d.expense.attach).isExisting(), 'Attach (not tapped)').to.equal(true);
  });

  it('MEXP-009 The actions menu offers edit, notes, task and delete', async function () {
    await openExpense(this, expenseData.saved);
    const options = await expenseDetailPage.actionOptions(EXPENSE_ACTIONS);
    await checkpoint('MEXP-009 closed');
    expect(options.map((o) => o.label), 'Expense actions').to.deep.equal([...EXPENSE_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled actions').to.deep.equal([]);
    expect(await expenseDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });

  it('MEXP-010 Edit opens the expense form filled in and Cancel without changes returns to the expense', async function () {
    await openExpense(this, expenseData.saved);
    const d = expenseDetailPage;
    await d.openAction('Edit');
    const f = editExpensePage;
    await f.waitForDisplayed(15_000);
    const got = { date: await f.desc(f.selectors.date), category: await f.desc(f.selectors.category), reference: await $(f.selectors.reference).getText(),
      vendorName: await $(f.selectors.vendorName).getText(), description: await $(f.selectors.description).getText() };
    const summary = await f.summary();
    await f.scrollTo(f.selectors.taxRate, 'up');
    const tax = await f.desc(f.selectors.taxRate);
    await checkpoint('MEXP-010 edit form');
    await f.cancel();
    await d.waitForDisplayed(15_000);
    expect(got, 'Edit expense fields').to.deep.equal({ date: `Date: ${expenseData.savedDate}`, category: `Category: ${expenseData.category}`, reference: expenseData.reference,
      vendorName: expenseData.vendorName, description: expenseData.savedDescription });
    expect(summary, 'Amount / Tax / Total').to.deep.equal({ amount: expenseData.amount, tax: expenseData.total - expenseData.amount, total: expenseData.total });
    expect(tax, 'tax rate').to.equal(`Tax rate: ${expenseData.tax}`);
    expect(await d.text(d.selectors.status), 'status after Cancel').to.equal('Draft');
  });

  it('MEXP-011 The new expense form starts empty with today, its pickers list every option and Cancel saves nothing', async () => {
    await openExpenses();
    const all = await expensesPage.count();
    await $(expensesPage.expense.headerNew).click();
    const f = newExpensePage;
    await f.waitForDisplayed(15_000);
    const defaults = { date: await f.desc(f.selectors.date), category: await f.desc(f.selectors.category), referenceHint: await $(f.selectors.referenceHint).isExisting(),
      vendor: await f.desc(f.selectors.vendor), vendorNameHint: await $(f.selectors.vendorName).getText(), owner: await f.desc(f.selectors.owner) };
    const categories = await f.picker(f.selectors.category, 'Category', EXPENSE_CATEGORIES);
    const summary = await f.summary();
    const toggles = { tax: await f.desc(f.selectors.taxRate), includesTax: await f.isChecked(f.selectors.includesTax), unpaid: await f.isChecked(f.selectors.unpaid), paid: await f.isChecked(f.selectors.paid) };
    const taxes = await f.picker(f.selectors.taxRate, 'Tax', EXPENSE_TAXES);
    const paidThrough = await f.picker(f.selectors.paidThrough, 'Paid through', EXPENSE_PAID_THROUGH);
    await f.scrollTo(f.selectors.billable);
    const links = { salesOrder: await f.desc(f.selectors.salesOrder), invoice: await f.desc(f.selectors.invoice), billable: await f.isChecked(f.selectors.billable) };
    await checkpoint('MEXP-011 form');
    // Nothing was typed or chosen: Cancel leaves without the discard dialog (MEXP-012 covers the dialog).
    await f.cancel();
    await expensesPage.waitForDisplayed(20_000);
    await expensesPage.waitForLoaded();
    expect(defaults, 'defaults').to.deep.equal({ date: `Date: ${today()}`, category: 'Category: No category', referenceHint: true, vendor: 'Vendor: Choose a supplier',
      vendorNameHint: EXPENSE_TEXTS.vendorNameHint, owner: 'Owner: Me' });
    expect(summary, 'Amount / Tax / Total').to.deep.equal({ amount: 0, tax: 0, total: 0 });
    expect(toggles, 'tax and payment').to.deep.equal({ tax: 'Tax rate: No tax', includesTax: false, unpaid: true, paid: false });
    expect(links, 'links').to.deep.equal({ salesOrder: 'Sales order: Link a sales order', invoice: 'Invoice: Link an invoice', billable: false });
    expect(categories.map((o) => o.label), 'categories').to.deep.equal([...EXPENSE_CATEGORIES]);
    expect(taxes.map((o) => o.label), 'tax rates').to.deep.equal([...EXPENSE_TAXES]);
    expect(paidThrough.map((o) => o.label), 'paid through').to.deep.equal([...EXPENSE_PAID_THROUGH]);
    expect(await expensesPage.count(), 'count after Cancel (nothing saved)').to.equal(all);
  });

  it('MEXP-012 The new expense form adds or extracts each tax rate in its amount, tax and total', async () => {
    await openNewExpense();
    const f = newExpensePage;
    await f.setAmount(expenseData.amount);
    const got: string[] = [];
    for (const [tax, rate] of [['VAT 4.5%', 4.5], ['Sales 10%', 10], ['Service 12.5%', 12.5]] as const) {
      await f.setTax(tax);
      const s = await f.summary();
      got.push(`${tax}: ${s.amount} + ${s.tax} = ${s.total}`);
      if (s.tax !== expenseData.amount * rate / 100 || s.total !== s.amount + s.tax) got.push(`  expected ${expenseData.amount} + ${expenseData.amount * rate / 100}`);
    }
    await f.setTax(expenseData.tax);
    await f.setIncludesTax(true);
    const included = await f.summary();
    await checkpoint('MEXP-012 includes tax');
    const dialog = await f.discard();
    expect(dialog, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(got.filter((g) => g.startsWith('  ')), got.join('; ')).to.deep.equal([]);
    expect(included, 'Sales 10% included in 1000').to.deep.equal({ amount: expenseData.includedAmount, tax: expenseData.includedTax, total: expenseData.amount });
  });

  it('MEXP-013 TDS 2% on the new expense form is deducted from the total', async () => {
    await openNewExpense();
    const f = newExpensePage;
    await f.setAmount(expenseData.amount);
    await f.setTax('TDS 2%');
    const s = await f.summary();
    await checkpoint('MEXP-013 TDS');
    await f.discard();
    expect(s, 'Amount / Tax / Total with TDS 2%').to.deep.equal({ amount: expenseData.amount, tax: -20, total: expenseData.tdsTotal });
  });
});
