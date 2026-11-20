// Notifications: the in-app list (from More and from the bell), opening a mention, Settings > Notifications with the
// link to Android's app settings, Settings > Devices, and (only with NOTIFY_WAIT=1) an incoming push while the app is in
// the background. Nothing is changed in the app or in Android settings.
import { expect } from 'chai';
import { notificationsPage, notificationSettingsPage, devicesPage, postedNotifications, NOTIFICATION_TEXTS } from '../../../src/pages/NotificationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { settings } from '../../../src/config/settings.js';
import { adb, resolveDevice } from '../../../src/utils/adb.js';
import { openInbox } from '../../helpers/inbox.js';
import { notificationData as nt } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { skipBecause } from '../../helpers/campaigns.js';
import { openDevices, openNotificationSettings, openNotifications } from '../../helpers/notifications.js';

/** Minute of the day of the newest chat in the Inbox ("Name, 16:08, ..." rows show today's time), or null. */
async function latestInboxMinute(): Promise<number | null> {
  await openInbox();
  await driver.pause(3_000);
  // The chat rows start below the "Next up" card.
  const { width, height } = await driver.getWindowSize();
  await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.35, width: width * 0.8, height: height * 0.45, direction: 'down', percent: 0.8 });
  await driver.pause(1_500);
  const src = await driver.getPageSource();
  const times = [...src.matchAll(/content-desc=(?:"[^"]*?, ([0-9]{1,2}):([0-9]{2}), [^"]*"|'[^']*?, ([0-9]{1,2}):([0-9]{2}), [^']*')/g)]
    .map((x) => Number(x[1] ?? x[3]) * 60 + Number(x[2] ?? x[4]));
  return times.length ? Math.max(...times) : null;
}

describe('Notifications: list, settings and incoming push (nothing is changed)', () => {
  requiresAccount();

  it('MNTF-002 The bell on the More screen opens the same notifications as the More entry', async () => {
    await openNotifications('list');
    const fromList = (await notificationsPage.rows()).map((r) => r.label);
    await openNotifications('bell');
    const fromBell = (await notificationsPage.rows()).map((r) => r.label);
    await checkpoint('MNTF-002 from the bell');
    expect(fromBell, 'notifications from the bell vs from the More entry').to.deep.equal(fromList);
  });

  it('MNTF-003 A mention notification opens the chat where the note was written and Back returns to the list', async function () {
    await openNotifications('list');
    const mention = (await notificationsPage.rows()).find((r) => r.title === nt.mention);
    if (!mention) skipBecause(this, `no "${nt.mention}" notification`);
    await notificationsPage.open(mention.label);
    await $('~Back to Inbox').waitForDisplayed({ timeout: 20_000, timeoutMsg: 'the chat did not open' });
    await checkpoint('MNTF-003 chat');
    // The composer depends on the chat's 24-hour window; the contact header is always there.
    expect(await $('android=new UiSelector().descriptionContains(". Open contact")').waitForExist({ timeout: 15_000 }).then(() => true, () => false), 'chat contact header').to.equal(true);
    await $('~Back to Inbox').click();
    await notificationsPage.waitForDisplayed(15_000);
    expect((await notificationsPage.rows()).map((r) => r.label), 'list after Back').to.include(mention.label);
  });

  it('MNTF-004 Notification settings show push on for this phone and what it covers', async () => {
    await openNotificationSettings();
    const s = notificationSettingsPage;
    await checkpoint('MNTF-004 settings');
    expect(await s.pushState(), 'Push notifications').to.equal('On');
    expect(await $(s.selectors.openSystem).isExisting(), NOTIFICATION_TEXTS.openSystem).to.equal(true);
    expect(await $(s.selectors.text(nt.pushIntro)).isExisting(), `"${nt.pushIntro}"`).to.equal(true);
    expect(await $(s.selectors.text(nt.webNote)).isExisting(), `"${nt.webNote}"`).to.equal(true);
  });

  it('MNTF-005 Open system settings shows the Android notification setting of the app and Back returns to the app', async () => {
    await openNotificationSettings();
    const s = notificationSettingsPage;
    const system = await s.readSystemSettings();
    await checkpoint('MNTF-005 back in the app');
    expect(system.pkg, 'Android settings in front').to.equal('com.android.settings');
    expect(system.appName, 'App info of Saleshiker').to.equal(true);
    expect(system.manage, `Manage notifications (${JSON.stringify(system.manage)})`).to.match(/^Allow/);
    expect(await driver.getCurrentPackage(), 'back in the app').to.equal(settings.appId);
    expect(await s.pushState(), 'Push notifications after returning').to.equal('On');
  });

  it('MNTF-006 Devices lists this phone as signed in', async () => {
    await openDevices();
    await checkpoint('MNTF-006 devices');
    expect(await $(devicesPage.selectors.thisDevice).isExisting(), '"This device"').to.equal(true);
    expect(await devicesPage.thisDevice(), 'this device').to.equal(nt.device);
  });

  it('MNTF-007 An incoming WhatsApp message raises a push while the app is in the background', async function () {
    if (!settings.notify.wait) skipBecause(this, 'NOTIFY_WAIT is not 1: nobody sends a message during the run');
    const minutes = settings.notify.minutes;
    this.timeout((minutes + 3) * 60_000);
    const serial = resolveDevice(settings.deviceSerial);
    await openNotifications('list');
    const before = new Set(postedNotifications(serial, settings.appId).map((n) => n.key));
    const [h, m] = adb(['shell', 'date', '+%H:%M'], serial).trim().split(':').map(Number);
    const startMinute = h! * 60 + m!;                           // phone time; Inbox rows show "HH:MM" for today
    await driver.execute('mobile: pressKey', { keycode: 3 });   // HOME: background, not stopped (a stopped app gets no push)
    console.log(`[MNTF-007] Waiting up to ${minutes} min: send one WhatsApp message from an allowlisted phone to the workspace number now.`);
    let arrived: ReturnType<typeof postedNotifications> = [];
    const deadline = Date.now() + minutes * 60_000;
    while (Date.now() < deadline && !arrived.length) {
      await driver.pause(5_000);
      // A cheap command each round: Appium ends a session idle for newCommandTimeout (300 s) during a long wait.
      await driver.getCurrentPackage();
      arrived = postedNotifications(serial, settings.appId).filter((n) => !before.has(n.key));
    }
    await checkpoint('MNTF-007 after the wait');
    if (!arrived.length) {
      // No push: only a defect if a message really arrived during the wait. Check the Inbox for a chat newer than the start.
      const latest = await latestInboxMinute();
      if (latest === null || latest < startMinute) skipBecause(this, `no new message reached the Inbox during the ${minutes} min wait (nobody sent one)`);
      console.log(`[MNTF-007] A message reached the Inbox at ${String(Math.floor(latest / 60)).padStart(2, '0')}:${String(latest % 60).padStart(2, '0')} but no push was posted.`);
    }
    expect(arrived.map((n) => `${n.title}: ${n.text}`), `SalesHiker pushes within ${minutes} min`).to.not.deep.equal([]);
    expect(arrived[0]!.channel, 'channel').to.equal('messages');
  });
});
