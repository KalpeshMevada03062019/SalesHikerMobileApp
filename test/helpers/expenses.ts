// Navigation shared by the Expense specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { expensesPage, expenseDetailPage, newExpensePage, type ExpenseRow } from '../../src/pages/ExpensesPage.js';
import { skipBecause } from './campaigns.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

/** Restarts the app signed in and opens More > Expenses. */
export async function openExpenses(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(expensesPage.selectors.moreEntry);
  await expensesPage.waitForDisplayed(20_000);
  await expensesPage.waitForLoaded();
}

/** Opens Expenses and the New expense form from the header. */
export async function openNewExpense(): Promise<void> {
  await openExpenses();
  await $(expensesPage.expense.headerNew).click();
  await newExpensePage.waitForDisplayed(15_000);
}

/** Searches an expense number and opens it; skips when it is not found. */
export async function openExpense(ctx: Mocha.Context, number: string): Promise<ExpenseRow> {
  await openExpenses();
  await expensesPage.search(number);
  const row = (await expensesPage.expenseRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no expense ${number}`);
  await expensesPage.open(row.label);
  await expenseDetailPage.waitForDisplayed(60_000);
  return row;
}
