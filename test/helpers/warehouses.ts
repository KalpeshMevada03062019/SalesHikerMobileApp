// Navigation shared by the Warehouse specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { warehousesPage, warehouseDetailPage, type WarehouseRow } from '../../src/pages/WarehousesPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Warehouses. */
export async function openWarehouses(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(warehousesPage.selectors.moreEntry);
  await warehousesPage.waitForDisplayed(20_000);
  await warehousesPage.waitForLoaded();
}

/** Searches a warehouse by its exact name and opens it; skips when it is not listed. */
export async function openWarehouse(ctx: Mocha.Context, name: string): Promise<WarehouseRow> {
  await openWarehouses();
  await warehousesPage.search(name);
  const row = (await warehousesPage.rows()).find((r) => r.name === name);
  if (!row) skipBecause(ctx, `no warehouse ${name}`);
  await warehousesPage.open(row.label);
  await warehouseDetailPage.waitForDisplayed(15_000);
  return row;
}
