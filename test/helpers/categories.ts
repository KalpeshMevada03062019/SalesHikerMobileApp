// Navigation shared by the Category specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { categoriesPage, categoryDetailPage } from '../../src/pages/CategoriesPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Categories. */
export async function openCategories(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(categoriesPage.selectors.moreEntry);
  await categoriesPage.waitForDisplayed(20_000);
  await categoriesPage.waitForLoaded();
}

/** Searches a category by name and opens it; skips when it is not found. */
export async function openCategory(ctx: Mocha.Context, name: string): Promise<void> {
  await openCategories();
  await categoriesPage.search(name);
  if (!(await categoriesPage.visibleNames()).includes(name)) skipBecause(ctx, `no category ${name}`);
  await categoriesPage.open(name);
  await categoryDetailPage.waitForDisplayed(30_000);
}
