// Navigation shared by the WhatsApp Logs specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { whatsAppLogsPage, messageLogPage, type LogRow } from '../../src/pages/WhatsAppLogsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > WhatsApp Logs. */
export async function openWhatsAppLogs(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await $(whatsAppLogsPage.selectors.moreEntry).click();
  await whatsAppLogsPage.waitForDisplayed(20_000);
  await whatsAppLogsPage.waitForLoaded();
}

/** Opens WhatsApp Logs and the newest message in a direction; skips when there is none. */
export async function openFirstLog(ctx: Mocha.Context, direction: LogRow['direction']): Promise<LogRow> {
  await openWhatsAppLogs();
  await whatsAppLogsPage.selectFilter(direction === 'Outgoing' ? 'Outbound' : 'Inbound');
  const row = (await whatsAppLogsPage.visibleRows()).find((r) => r.direction === direction);
  if (!row) skipBecause(ctx, `no ${direction.toLowerCase()} message in the log`);
  await whatsAppLogsPage.openRow(row.label);
  await messageLogPage.waitForDisplayed(15_000);
  return row;
}
