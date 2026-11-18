import { expect } from 'chai';
import { expensesPage, EXPENSE_STATUSES, EXPENSE_TEXTS } from '../../../src/pages/ExpensesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openExpenses } from '../../helpers/expenses.js';

describe('Smoke: expenses', () => {
  requiresAccount();

  it('MEXP-001 Expenses opens with the count, search, status and payment filters and expenses', async () => {
    await openExpenses();
    const p = expensesPage;
    const count = await p.count();
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(EXPENSE_TEXTS.searchHint);
    expect(await $(p.expense.headerNew).isExisting(), 'New expense (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    await checkpoint('MEXP-001 expenses');
    if (count === 0) {
      expect(await $(p.expense.empty).isExisting(), `"${EXPENSE_TEXTS.empty}"`).to.equal(true);
      expect(await $(p.expense.emptyHint).isExisting(), `"${EXPENSE_TEXTS.emptyHint}"`).to.equal(true);
      return;
    }
    const rows = await p.expenseRows();
    const bad = rows.filter((r) => !r.title || !/^₹[0-9,]+([.][0-9]{1,2})?$/.test(r.amount) || !r.number || !r.date || !(EXPENSE_STATUSES as readonly string[]).includes(r.status));
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(bad.map((r) => r.label), 'rows without vendor, amount, EXP- number, date or a known status').to.deep.equal([]);
    if (rows.length === count) expect(await p.endOfListCount(), 'End of list count').to.equal(count);
  });
});
