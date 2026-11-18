// Navigation shared by the Price Book specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { priceBooksPage, priceBookDetailPage, type PriceBookRow } from '../../src/pages/PriceBooksPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Price Books. */
export async function openPriceBooks(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(priceBooksPage.selectors.moreEntry);
  await priceBooksPage.waitForDisplayed(20_000);
  await priceBooksPage.waitForLoaded();
}

/** Opens a price book by name from the list; skips when it is not listed. */
export async function openPriceBook(ctx: Mocha.Context, name: string): Promise<PriceBookRow> {
  await openPriceBooks();
  await priceBooksPage.search(name);
  const row = (await priceBooksPage.rowsOnScreen()).find((r) => r.name === name);
  if (!row) skipBecause(ctx, `no price book ${name}`);
  await priceBooksPage.open(row.label);
  await priceBookDetailPage.waitForDisplayed(30_000);
  return row;
}
