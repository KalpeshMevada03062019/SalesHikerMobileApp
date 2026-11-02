// Navigation shared by the Inbox specs.
import { inboxPage, chatPage } from '../../src/pages/InboxPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { settings } from '../../src/config/settings.js';

/** Restarts the app signed in and opens the Inbox tab. */
export async function openInbox(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await inboxPage.open();
}

/**
 * Opens the chat of INBOX_RECIPIENT and checks the header shows exactly that number, so nothing can be
 * sent to anyone else. Throws (fails the test) when it does not.
 */
export async function openRecipientChat(): Promise<{ name: string; phone: string }> {
  const phone = settings.inbox.recipient;
  if (!phone) throw new Error('INBOX_RECIPIENT is not configured');
  await openInbox();
  await inboxPage.openChatByPhone(phone);
  await chatPage.waitForDisplayed(20_000);
  const who = await chatPage.recipient();
  if (who.phone !== phone) throw new Error(`Opened the chat of ${who.phone}, not ${phone}; nothing is sent`);
  return who;
}

/** afterEach safety net: never leave the template sheet open. */
export async function closeSheetIfOpen(): Promise<void> {
  if (await $(chatPage.selectors.sheetTitle).isExisting().catch(() => false)) await chatPage.closeTemplateSheet().catch(() => undefined);
}
