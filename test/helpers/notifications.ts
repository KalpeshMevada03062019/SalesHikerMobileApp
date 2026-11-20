// Navigation shared by the Notification specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { notificationsPage, notificationSettingsPage, devicesPage } from '../../src/pages/NotificationsPage.js';
import { by } from '../../src/pages/BasePage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

const MORE_SETTINGS = by.a11y('Settings');
// The More screen has two "Notifications" buttons: the list entry (WORKSPACE) and the bell in the header (last in the tree).
const MORE_LIST_ENTRY = '(//android.widget.Button[@content-desc="Notifications"])[1]';
const MORE_BELL = '(//android.widget.Button[@content-desc="Notifications"])[last()]';

async function openMore(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
}

/** Restarts the app signed in and opens More > Notifications (the list entry, or the bell in the header). */
export async function openNotifications(via: 'list' | 'bell' = 'list'): Promise<void> {
  await openMore();
  if (via === 'bell') await $(MORE_BELL).click();
  else await morePage.openEntry(MORE_LIST_ENTRY);
  await notificationsPage.waitForDisplayed(20_000);
  await notificationsPage.waitForLoaded();
}

/** Restarts the app signed in and opens More > Settings. */
export async function openSettings(): Promise<void> {
  await openMore();
  await morePage.openEntry(MORE_SETTINGS);
  await $(notificationSettingsPage.selectors.settingsEntry).waitForDisplayed({ timeout: 15_000 });
}

/** More > Settings > Notifications. */
export async function openNotificationSettings(): Promise<void> {
  await openSettings();
  await $(notificationSettingsPage.selectors.settingsEntry).click();
  await notificationSettingsPage.waitForDisplayed(15_000);
}

/** More > Settings > Devices. */
export async function openDevices(): Promise<void> {
  await openSettings();
  await $(devicesPage.selectors.settingsEntry).click();
  await devicesPage.waitForDisplayed(15_000);
}
