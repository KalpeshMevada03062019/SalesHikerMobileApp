// Navigation shared by the Product specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { productsPage, productDetailPage, type ProductRow } from '../../src/pages/ProductsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Products. */
export async function openProducts(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(productsPage.selectors.moreEntry);
  await productsPage.waitForDisplayed(20_000);
  await productsPage.waitForLoaded();
}

/** Searches a product by SKU and opens the one with that name; skips when it is not found. */
export async function openProduct(ctx: Mocha.Context, sku: string, name: string): Promise<ProductRow> {
  await openProducts();
  await productsPage.search(sku);
  const row = (await productsPage.productRows()).find((r) => r.name === name);
  if (!row) skipBecause(ctx, `no product ${name}`);
  await productsPage.open(row.label);
  await productDetailPage.waitForDisplayed(60_000);
  return row;
}
