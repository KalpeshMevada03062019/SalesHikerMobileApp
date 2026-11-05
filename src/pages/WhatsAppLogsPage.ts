// More > WhatsApp Logs: every WhatsApp message in and out of the workspace, with direction / status / date
// filters and search, and a message's log (Overview, Message Data, Details). Live app on the phone,
// 2026-11-03. Read only: nothing is sent from these screens.
import { BasePage, by } from './BasePage.js';

export const LOG_FILTERS = ['All', 'Outbound', 'Inbound', 'Sent', 'Delivered', 'Read', 'Failed', 'Template', 'Today'] as const;
export type LogFilter = (typeof LOG_FILTERS)[number];
export const LOG_STATUS_FILTERS = ['Sent', 'Delivered', 'Read', 'Failed'] as const;
export type LogStatus = (typeof LOG_STATUS_FILTERS)[number];
export const LOG_TABS = ['Overview', 'Message Data', 'Details'] as const;
export const LOG_DETAIL_FIELDS = ['Direction', 'Type', 'Phone', 'Business number', 'Meta ID', 'Created', 'Updated'] as const;

export const LOG_TEXTS = {
  noMessages: 'No messages found',
  noMessagesHint: 'No message matches this search or filter.',
  noResponse: 'No response saved.',
};

/** List row: content-desc "<Outgoing|Incoming> message, <contact>, <status>"; texts name, status, message, phone, time. */
export interface LogRow { direction: 'Outgoing' | 'Incoming'; contact: string; status: string; phone: string; time: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

export class WhatsAppLogsPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ messages?');

  readonly selectors = {
    moreEntry: by.a11y('WhatsApp Logs'),                     // More > WHATSAPP > WhatsApp Logs
    count: this.marker,
    search: '//android.widget.EditText',                     // hint "Search by phone or template"
    clearSearch: by.a11y('Clear search'),
    clearSearchButton: by.a11y('Clear Search'),             // on the empty state
    filter: (name: LogFilter) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    rows: '//android.widget.Button[starts-with(@content-desc, "Outgoing message, ") or starts-with(@content-desc, "Incoming message, ")]',
    noMessages: by.text(LOG_TEXTS.noMessages),
    noMessagesHint: by.text(LOG_TEXTS.noMessagesHint),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noMessages).isExisting(), {
      timeout, timeoutMsg: `WhatsApp logs did not load within ${timeout} ms`,
    });
  }

  /** Chips scroll sideways (Delivered onwards start off-screen). */
  private async chipInView(name: LogFilter): Promise<WebdriverIO.Element> {
    const chip = this.el(this.selectors.filter(name));
    const { width } = await driver.getWindowSize();
    const later = LOG_FILTERS.indexOf(name) >= 4;
    for (let i = 0; i < 6; i++) {
      if (await chip.isExisting()) {
        const { x } = await chip.getLocation();
        const { width: w } = await chip.getSize();
        if (x > 2 && x + w < width - 2) return chip.getElement();
      }
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: 262, width: width * 0.8, height: 84, direction: later ? 'left' : 'right', percent: 0.5 });
    }
    return chip.getElement();
  }

  /** Taps a filter and waits for the list to reload; returns the "N messages" count. */
  async selectFilter(name: LogFilter): Promise<number> {
    const chip = await this.chipInView(name);
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(2_000);
    await this.waitForLoaded();
    return this.count();
  }

  /** Fully visible rows (a row cut off at the bottom has no phone or time yet). */
  async visibleRows(): Promise<LogRow[]> {
    const rows: LogRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const m = label.match(/^(Outgoing|Incoming) message, (.*), ([^,]+)$/);
      const phone = await el.$('.//android.widget.TextView[starts-with(@text, "+")]').getText().catch(() => '');
      const time = await el.$('.//android.widget.TextView[last()]').getText().catch(() => '');
      if (!m || !phone) continue;
      rows.push({ direction: m[1] as LogRow['direction'], contact: m[2]!, status: m[3]!, phone, time, label });
    }
    return rows;
  }

  async search(text: string): Promise<void> {
    const field = this.el(this.selectors.search);
    await field.waitForDisplayed();
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(2_000);
  }

  async isEmptyStateShown(timeout = 10_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noMessages, timeout); return true; } catch { return false; }
  }

  /** "Clear Search" on the empty state. */
  async clearFromEmptyState(): Promise<void> {
    await this.tap(this.selectors.clearSearchButton);
    await this.waitForLoaded();
    await driver.pause(1_000);
  }

  async openRow(label: string): Promise<void> {
    await this.tap(`(//android.widget.Button[@content-desc=${JSON.stringify(label)}])[1]`);
  }
}

export class MessageLogPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Message log"]';

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    status: '(//android.widget.TextView)[1]',               // header badge: Read, Received, Failed, ...
    direction: '(//android.widget.TextView[@text="Outbound" or @text="Inbound"])[1]',
    date: '(//android.widget.TextView[@text="Outbound" or @text="Inbound"])[1]/following-sibling::android.widget.TextView[1]',
    contact: (name: string) => by.a11y(`Open chat with ${name}`),
    tab: (name: (typeof LOG_TABS)[number]) => `//android.view.View[@content-desc=${JSON.stringify(name)}]`,
    tabLabel: (name: (typeof LOG_TABS)[number]) => `//android.widget.TextView[@text=${JSON.stringify(name)}]`,
    // MESSAGE: the text is a sibling TextView; REQUEST / RESPONSE: the JSON sits inside the next ViewGroup.
    message: '//android.view.View[@text="MESSAGE"]/following-sibling::android.widget.TextView[1]',
    timelineSteps: 'android=new UiSelector().className("android.view.ViewGroup").descriptionMatches("^(Queued|Sent|Delivered|Read|Failed|Received) [0-9:]+$")',
    request: '//android.view.View[@text="REQUEST"]/following-sibling::android.view.ViewGroup[1]//android.widget.TextView[1]',
    response: '//android.view.View[@text="RESPONSE"]/following-sibling::android.view.ViewGroup[1]//android.widget.TextView[1]',
    field: (name: string) => `//android.view.ViewGroup[@content-desc="Log details"]//android.widget.TextView[@text=${JSON.stringify(name)}]/following-sibling::android.widget.TextView[1]`,
    openConversation: by.a11y('Open Conversation'),
  };

  async text(selector: string): Promise<string> {
    return this.el(selector).getText().catch(() => '');
  }

  /** Status timeline steps in order, e.g. ["Queued", "Sent", "Read"]. */
  async timeline(): Promise<string[]> {
    const steps: string[] = [];
    for (const el of await $$(this.selectors.timelineSteps)) steps.push(((await el.getAttribute('content-desc')) ?? '').split(' ')[0]!);
    return steps;
  }

  async openTab(name: (typeof LOG_TABS)[number]): Promise<void> {
    await this.tap(this.selectors.tab(name));
    await driver.waitUntil(async () => (await $(this.selectors.tabLabel(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Tab "${name}" not selected` });
  }

  async field(name: string): Promise<string> {
    return this.text(this.selectors.field(name));
  }

  /** Opens the contact's chat in Inbox (nothing is typed there). */
  async openConversation(): Promise<void> {
    await this.tap(this.selectors.openConversation);
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const whatsAppLogsPage = new WhatsAppLogsPage();
export const messageLogPage = new MessageLogPage();
