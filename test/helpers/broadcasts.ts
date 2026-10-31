// Navigation shared by the Broadcast specs.
import { broadcastsPage } from '../../src/pages/BroadcastsPage.js';
import { newBroadcastPage } from '../../src/pages/NewBroadcastPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

/** Restarts the app signed in and opens the Broadcasts tab. */
export async function openBroadcastList(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await broadcastsPage.open();
}

/** From a fresh list, opens New Broadcast on step 1 (Audience). */
export async function openNewBroadcast(): Promise<void> {
  await openBroadcastList();
  await broadcastsPage.startNewBroadcast();
  await newBroadcastPage.waitForStep('Audience', 15_000);
}

/** Leaves the wizard without saving, if it is open (afterEach safety net: never leave a half-made broadcast). */
export async function discardIfOpen(): Promise<void> {
  const p = newBroadcastPage;
  // Up to 4 rounds: cancel the send confirmation, close a picker sheet, then Close > Discard the wizard.
  for (let i = 0; i < 4; i++) {
    if (await $(p.selectors.discardTitle).isExisting().catch(() => false)) { await p.discard(); return; }
    if (await $(p.selectors.confirmTitle).isExisting().catch(() => false)) { await p.cancelConfirmation(); continue; }
    if (!(await $(p.selectors.step).isExisting().catch(() => false))) {
      // No step label: either the wizard is gone or a sheet covers it.
      const sheetClose = await $$('//android.widget.Button[@content-desc="Close"]');
      if (!sheetClose.length) return;
      await sheetClose[sheetClose.length - 1]!.click();
      continue;
    }
    await p.hideKeyboard();
    await $(p.selectors.close).click();
    await driver.pause(1_000);
  }
}
