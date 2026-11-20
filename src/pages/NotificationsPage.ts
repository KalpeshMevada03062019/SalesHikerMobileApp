// Notifications: the in-app list (More > WORKSPACE > Notifications, or the bell on the More screen), Settings >
// Notifications (push on this phone, link to Android's app settings), Settings > Devices, and the Android notification
// shade for incoming pushes. Live app on the phone, 2026-11-20.
//
// Read only: nothing is changed in the app or in Android settings (Force stop, Uninstall and Sign out are never tapped).
import { BasePage, by } from './BasePage.js';
import { adb } from '../utils/adb.js';

export interface NotificationRow { title: string; date: string; text: string; label: string }

export const NOTIFICATION_TEXTS = {
  title: 'Notifications',
  thisPhone: 'THIS PHONE',
  pushRow: 'Push notifications, ',                  // "Push notifications, On"
  openSystem: 'Open system settings',
  appInfo: 'App info',
  manage: 'Manage notifications',
};

const xq = (s: string) => JSON.stringify(s);

class NotificationListPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Notifications"]';
  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    rows: '//android.widget.Button[count(.//android.widget.TextView) >= 2]',
    row: (start: string) => `(//android.widget.Button[starts-with(@content-desc, ${xq(start)})])[1]`,
    endOfList: by.textStartsWith('End of list'),
  };

  /** Rows on screen: title, date and text. */
  async rows(): Promise<NotificationRow[]> {
    const out: NotificationRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push(await t.getText());
      const [title, date, ...rest] = texts;
      out.push({ title: title ?? '', date: date ?? '', text: rest.join(' '), label: (await el.getAttribute('content-desc')) ?? '' });
    }
    return out;
  }

  /** Waits for the rows (or the end of the list) after the screen opens. */
  async waitForLoaded(timeout = 20_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || $(this.selectors.endOfList).isExisting(),
      { timeout, timeoutMsg: `Notifications did not load within ${timeout} ms` });
  }

  async open(start: string): Promise<void> {
    await this.tap(this.selectors.row(start));
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const notificationsPage = new NotificationListPage();

class NotificationSettingsPage extends BasePage {
  protected readonly marker = by.text(NOTIFICATION_TEXTS.thisPhone);
  readonly selectors = {
    settingsEntry: by.a11y('Notifications'),                    // Settings > ACCOUNT section
    push: by.descStartsWith(NOTIFICATION_TEXTS.pushRow),
    openSystem: by.a11y(NOTIFICATION_TEXTS.openSystem),
    text: (t: string) => by.text(t),
    // Android's App info screen (com.android.settings)
    appInfo: by.text(NOTIFICATION_TEXTS.appInfo),
    manage: by.text(NOTIFICATION_TEXTS.manage),
    // Android settings: the value ("Allow") follows the container of its label.
    manageValue: `//android.widget.TextView[@text=${xq(NOTIFICATION_TEXTS.manage)}]/../following-sibling::android.widget.TextView[1]`,
  };

  /** "Push notifications, On" -> "On". */
  async pushState(): Promise<string> {
    const d = (await $(this.selectors.push).getAttribute('content-desc').catch(() => '')) ?? '';
    return d.slice(NOTIFICATION_TEXTS.pushRow.length);
  }

  /** Opens Android's App info for the app, reads it and goes back. Nothing there is tapped. */
  async readSystemSettings(): Promise<{ pkg: string; appInfo: boolean; appName: boolean; manage: string }> {
    await this.tap(this.selectors.openSystem);
    await $(this.selectors.appInfo).waitForDisplayed({ timeout: 15_000, timeoutMsg: 'Android App info not shown' });
    const result = {
      pkg: await driver.getCurrentPackage(),
      appInfo: true,
      appName: await $(by.textMatches('(?i)saleshiker')).isExisting(),
      // Android can wrap the value in invisible direction marks: keep the visible characters only.
      manage: (await $(this.selectors.manageValue).getText().catch(() => '')).replace(/[^ -~]/g, '').trim(),
    };
    await driver.back();
    await this.waitForDisplayed(15_000);
    return result;
  }
}

export const notificationSettingsPage = new NotificationSettingsPage();

class DevicesPage extends BasePage {
  protected readonly marker = by.text('SIGNED IN');
  readonly selectors = {
    settingsEntry: by.descStartsWith('Devices, '),
    thisDevice: by.text('This device'),
    // The device name sits before "This device" in the same row.
    thisDeviceName: '//android.widget.TextView[@text="This device"]/preceding-sibling::android.widget.TextView[2]',
  };

  async thisDevice(): Promise<string> {
    return $(this.selectors.thisDeviceName).getText().catch(() => '');
  }
}

export const devicesPage = new DevicesPage();

export interface PostedNotification { key: string; channel: string; title: string; text: string }

/** Notifications Android currently holds for the app, from `dumpsys notification` (adb on the host, no UI).
 *  Phone numbers in the title or text are masked so they never reach the reports. */
export function postedNotifications(serial: string, appId: string): PostedNotification[] {
  const dump = adb(['shell', 'dumpsys', 'notification', '--noredact'], serial);
  const out: PostedNotification[] = [];
  const mask = (t: string) => t.replace(/\+?\d[\d ]{8,}\d/g, '<number>');
  for (const block of dump.split(/\n\s*NotificationRecord\(/).slice(1)) {
    if (!block.includes(`pkg=${appId}`)) continue;
    const pick = (re: RegExp) => mask((re.exec(block)?.[1] ?? '').trim());
    out.push({
      key: pick(/key=(\S+)/), channel: pick(/channel=(\S+)/),
      title: pick(/android\.title=String \((.*)\)/), text: pick(/android\.text=String \((.*)\)/),
    });
  }
  return out;
}
