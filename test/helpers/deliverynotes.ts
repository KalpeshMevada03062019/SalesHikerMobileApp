// Navigation shared by the Delivery note specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { deliveryNotesPage, deliveryNoteDetailPage, type DeliveryRow } from '../../src/pages/DeliveryNotesPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Delivery Notes. */
export async function openDeliveryNotes(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(deliveryNotesPage.moreEntry);
  await deliveryNotesPage.waitForDisplayed(20_000);
  await deliveryNotesPage.waitForLoaded();
}

/** Searches a delivery note number and opens it; skips when it is not found. */
export async function openDeliveryNote(ctx: Mocha.Context, number: string): Promise<DeliveryRow> {
  await openDeliveryNotes();
  await deliveryNotesPage.search(number);
  const row = (await deliveryNotesPage.deliveryRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no delivery note ${number}`);
  await deliveryNotesPage.open(row.label);
  await deliveryNoteDetailPage.waitForDisplayed(60_000);
  return row;
}
