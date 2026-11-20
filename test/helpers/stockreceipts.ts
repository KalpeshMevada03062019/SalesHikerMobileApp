// Navigation shared by the Stock receipt specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { stockReceiptsPage, stockReceiptDetailPage, newStockReceiptPage, type ReceiptRow } from '../../src/pages/StockReceiptsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Stock Receipts. */
export async function openStockReceipts(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(stockReceiptsPage.selectors.moreEntry);
  await stockReceiptsPage.waitForDisplayed(20_000);
  await stockReceiptsPage.waitForLoaded();
}

/** Opens a receipt from the list (all receipts fit on one screen); skips when it is not listed. */
export async function openStockReceipt(ctx: Mocha.Context, number: string, reopen = true): Promise<ReceiptRow> {
  if (reopen) await openStockReceipts();
  const row = (await stockReceiptsPage.rows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no stock receipt ${number}`);
  await stockReceiptsPage.open(row.label);
  await stockReceiptDetailPage.waitForDisplayed(15_000);
  return row;
}

/** Opens the New stock receipt form (it is only ever discarded). */
export async function openNewStockReceipt(): Promise<void> {
  await openStockReceipts();
  await $(stockReceiptsPage.selectors.newButton).click();
  await newStockReceiptPage.waitForDisplayed(15_000);
}
