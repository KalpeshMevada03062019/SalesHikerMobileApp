// New expense: saves one QA expense on beta, kept for the detail and actions tests. Only with EXPENSE_CREATE=1
// (approved 2026-11-16); saved once, never retried.
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { newExpensePage } from '../../../src/pages/ExpensesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { settings } from '../../../src/config/settings.js';
import { expenseData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openNewExpense } from '../../helpers/expenses.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Expenses: create the QA expense (only with EXPENSE_CREATE=1)', () => {
  requiresAccount();

  it('MEXP-020 A new expense saves with its amount, tax and total', async function () {
    if (!settings.expense.create) skipBecause(this, 'EXPENSE_CREATE is not 1: no expense is saved');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const description = `${expenseData.descriptionPrefix} ${stamp}`;
    await openNewExpense();
    const f = newExpensePage;
    await f.fill({ description, reference: expenseData.reference, vendorName: expenseData.vendorName, category: expenseData.category, amount: expenseData.amount, tax: expenseData.tax });
    const summary = await f.summary();
    await checkpoint('MEXP-020 before save');
    expect(summary, 'Amount / Tax / Total before saving').to.deep.equal({ amount: expenseData.amount, tax: expenseData.total - expenseData.amount, total: expenseData.total });
    await f.save();
    // Saved once; never retried. Record what was saved for the detail tests.
    const left = await driver.waitUntil(async () => !(await $(f.selectors.save).isExisting()), { timeout: 30_000 }).then(() => true, () => false);
    await checkpoint('MEXP-020 after save');
    if (!left) {
      const refused = await $(f.selectors.saveError).getText().catch(() => '');
      expect.fail(`Save did not leave the form (nothing saved)${refused ? `: ${refused}` : ''}`);
    }
    fs.writeFileSync(path.join(settings.runDir, 'created-expense.json'), JSON.stringify({ description, savedAt: new Date().toISOString() }, null, 2));
    console.log(`Created expense "${description}"`);
  });
});
