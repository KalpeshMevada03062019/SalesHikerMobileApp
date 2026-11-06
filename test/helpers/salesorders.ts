// Navigation shared by the Sales order specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { salesOrdersPage, salesOrderDetailPage, type SalesOrderRow } from '../../src/pages/SalesOrdersPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Sales orders. */
export async function openSalesOrders(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(salesOrdersPage.selectors.moreEntry);
  await salesOrdersPage.waitForDisplayed(20_000);
  await salesOrdersPage.waitForLoaded();
}

/** Searches a sales order number and opens it; skips when it is not found. */
export async function openSalesOrder(ctx: Mocha.Context, number: string): Promise<SalesOrderRow> {
  await openSalesOrders();
  await salesOrdersPage.search(number);
  const row = (await salesOrdersPage.visibleRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no sales order ${number}`);
  await salesOrdersPage.open(row.label);
  await salesOrderDetailPage.waitForDisplayed(15_000);
  return row;
}
