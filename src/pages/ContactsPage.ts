// Contacts tab: search and the contact profile's tags. Used to check a broadcast audience before sending.
// Live app on the phone, 2026-10-31.
import { BasePage, by } from './BasePage.js';
import { e164 } from './BroadcastsPage.js';

export class ContactsPage extends BasePage {
  protected readonly marker = by.a11y('Search contacts');

  readonly selectors = {
    tab: by.a11y('Contacts'),                       // bottom navigation
    search: this.marker,
    clearSearch: by.a11y('Clear search'),
    count: by.textMatches('[0-9,]+ contacts?'),
    // Rows: "<name>, <+phone> · <email>, <stage>"
    rows: '//android.widget.Button[contains(@content-desc, ", +")]',
    profileMarker: by.a11y('Add Task'),
  };

  async open(): Promise<void> {
    await this.tap(this.selectors.tab);
    await this.waitForDisplayed(20_000);
  }

  /** Contacts whose phone is exactly `phone` (E.164), searched by its digits. */
  async findByPhone(phone: string): Promise<Array<{ name: string; label: string }>> {
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    const field = this.el(this.selectors.search);
    await field.click();
    await field.setValue(phone.replace(/^\+91/, '').replace(/\D/g, ''));
    await this.hideKeyboard();
    // Results load after typing: wait for rows or the "0 contacts" header.
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || /^0 contacts$/.test(await this.el(this.selectors.count).getText().catch(() => '')), {
      timeout: 15_000, timeoutMsg: `Contact search for ${phone} did not finish`,
    });
    const hits: Array<{ name: string; label: string }> = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const m = /^(.*?), (\+[\d ]+)/.exec(label);
      if (m && e164(m[2]!) === phone) hits.push({ name: m[1]!, label });
    }
    return hits;
  }

  /** Opens a search hit and reports whether its profile lists `tag` under TAGS. Returns to the list. */
  async hasTag(rowLabel: string, tag: string): Promise<boolean> {
    await this.tap(by.a11y(rowLabel));
    await this.waitForVisible(this.selectors.profileMarker, 15_000, 'Contact profile');
    const found = await $(`android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text(${JSON.stringify(tag)}))`)
      .isExisting().catch(() => false);
    await driver.back();
    await this.waitForDisplayed();
    return found;
  }
}

export const contactsPage = new ContactsPage();
