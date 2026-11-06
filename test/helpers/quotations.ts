// Navigation shared by the Quotation specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { quotationsPage, quotationDetailPage, type QuotationRow } from '../../src/pages/QuotationsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Quotations. */
export async function openQuotations(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(quotationsPage.selectors.moreEntry);
  await quotationsPage.waitForDisplayed(20_000);
  await quotationsPage.waitForLoaded();
}

/** Searches a quotation number and opens it; skips when it is not found. */
export async function openQuotation(ctx: Mocha.Context, number: string): Promise<QuotationRow> {
  await openQuotations();
  await quotationsPage.search(number);
  const row = (await quotationsPage.visibleRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no quotation ${number}`);
  await quotationsPage.open(row.label);
  await quotationDetailPage.waitForDisplayed(15_000);
  return row;
}
