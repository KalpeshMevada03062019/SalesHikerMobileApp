// Navigation shared by the Document specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { documentsPage, documentDetailPage, type DocumentRow } from '../../src/pages/DocumentsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Documents. */
export async function openDocuments(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(documentsPage.selectors.moreEntry);
  await documentsPage.waitForDisplayed(20_000);
  await documentsPage.waitForLoaded();
}

/** Opens the first listed document's detail through Actions > Details; skips when there is none. */
export async function openFirstDocument(ctx: Mocha.Context): Promise<DocumentRow> {
  await openDocuments();
  const row = (await documentsPage.visibleRows())[0];
  if (!row) skipBecause(ctx, 'no documents');
  await documentsPage.openDetails(row.name);
  await documentDetailPage.waitForDisplayed(15_000);
  return row;
}
