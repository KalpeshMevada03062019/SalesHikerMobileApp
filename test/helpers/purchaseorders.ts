// Navigation shared by the Purchase order specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { purchaseOrdersPage, purchaseOrderDetailPage, newPurchaseOrderPage, type PurchaseOrderRow } from '../../src/pages/PurchaseOrdersPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Purchase Orders. */
export async function openPurchaseOrders(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(purchaseOrdersPage.selectors.moreEntry);
  await purchaseOrdersPage.waitForDisplayed(20_000);
  await purchaseOrdersPage.waitForLoaded();
}

/** Opens a purchase order from the list (all orders fit on one screen); skips when it is not listed. */
export async function openPurchaseOrder(ctx: Mocha.Context, number: string, reopen = true): Promise<PurchaseOrderRow> {
  if (reopen) await openPurchaseOrders();
  const row = (await purchaseOrdersPage.visibleRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no purchase order ${number}`);
  await purchaseOrdersPage.open(row.label);
  await purchaseOrderDetailPage.waitForDisplayed(15_000);
  return row;
}

/** Opens the New purchase order form (it is only ever discarded). */
export async function openNewPurchaseOrder(): Promise<void> {
  await openPurchaseOrders();
  await $(purchaseOrdersPage.selectors.newButton).click();
  await newPurchaseOrderPage.waitForDisplayed(15_000);
}
