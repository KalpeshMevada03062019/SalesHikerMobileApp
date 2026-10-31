// Broadcasts tab: the list and a broadcast's detail screen. Live app on the phone, 2026-10-31.
import { BasePage, by } from './BasePage.js';

export const BROADCAST_FILTERS = ['All', 'Draft', 'Scheduled', 'Sending', 'Sent', 'Failed'] as const;
export type BroadcastFilter = (typeof BROADCAST_FILTERS)[number];

/** Recipient row on the detail screen: content-desc "<name>, <status>, <+phone>, <time>". */
export interface BroadcastRecipient { name: string; status: string; phone: string; label: string }

/** "+91 91734 49831" -> "+919173449831" */
export const e164 = (phone: string): string => (phone.trim().startsWith('+') ? '+' : '') + phone.replace(/\D/g, '');

export class BroadcastsPage extends BasePage {
  // The top bar also has a "Search broadcasts" button; the field is the EditText.
  protected readonly marker = by.descClass('Search broadcasts', 'android.widget.EditText');

  readonly selectors = {
    tab: by.a11y('Broadcasts'),                       // bottom navigation
    headerCount: by.textMatches('[0-9,]+ broadcasts?'),
    search: this.marker,
    newBroadcast: by.a11y('New Broadcast'),
    chip: (filter: BroadcastFilter) => `android=new UiSelector().descriptionMatches(${JSON.stringify(`${filter}, [0-9]+`)})`,
    rows: '//android.widget.Button[contains(@content-desc, "recipient") or contains(@content-desc, ", Draft, ")]',
    row: (name: string) => by.descStartsWith(`${name}, `),
  };

  async open(): Promise<void> {
    await this.tap(this.selectors.tab);
    await this.waitForDisplayed(20_000);
    await this.waitForLoaded();
  }

  /** The list shows grey placeholders first; "N broadcasts" appears once it has loaded. */
  async waitForLoaded(timeout = 60_000): Promise<void> {
    await this.waitForVisible(this.selectors.headerCount, timeout, 'Loaded broadcast list ("N broadcasts")');
  }

  async headerCount(): Promise<number> {
    return Number((await this.el(this.selectors.headerCount).getText()).split(' ')[0]!.replace(/,/g, ''));
  }

  async filterCount(filter: BroadcastFilter): Promise<number> {
    const label = (await this.el(this.selectors.chip(filter)).getAttribute('content-desc')) ?? '';
    return Number(label.split(', ').pop());
  }

  async rowLabels(): Promise<string[]> {
    const labels: string[] = [];
    for (const el of await $$(this.selectors.rows)) labels.push((await el.getAttribute('content-desc')) ?? '');
    return labels;
  }

  /** The list row of a broadcast by its exact name, or null when it is not listed. */
  async rowLabel(name: string, timeout = 15_000): Promise<string | null> {
    try {
      await this.waitForVisible(this.selectors.row(name), timeout, `Broadcast "${name}"`);
      return (await this.el(this.selectors.row(name)).getAttribute('content-desc')) ?? '';
    } catch {
      return null;
    }
  }

  async startNewBroadcast(): Promise<void> {
    await this.tap(this.selectors.newBroadcast);
  }

  async openBroadcast(name: string): Promise<void> {
    await this.tap(this.selectors.row(name));
  }
}

export class BroadcastDetailPage extends BasePage {
  protected readonly marker = by.a11y('Broadcast summary');

  readonly selectors = {
    back: by.a11y('Back'),
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    // Summary lines are siblings of the "Broadcast summary" group: status, time, audience, sender.
    status: '//*[@content-desc="Broadcast summary"]/following-sibling::android.widget.TextView[1]',
    audience: by.textMatches('.*[0-9,]+ contacts?'),           // "Tags: <tag>. 2 contacts"
    sender: by.textStartsWith('From '),
    progress: by.textMatches('[0-9,]+ of [0-9,]+ sent'),
    template: '//android.view.View[@text="TEMPLATE"]/following-sibling::android.widget.TextView[1]',
    recipients: '//android.widget.Button[contains(@content-desc, ", +")]',
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isDisplayed();
  }

  async status(): Promise<string> {
    return this.el(this.selectors.status).getText();
  }

  async audienceLine(): Promise<string> {
    return this.el(this.selectors.audience).getText();
  }

  async senderLine(): Promise<string> {
    return this.el(this.selectors.sender).getText();
  }

  async templateName(): Promise<string> {
    return this.el(this.selectors.template).getText();
  }

  /** "2 of 2 sent" -> { sent: 2, total: 2 } */
  async progress(): Promise<{ sent: number; total: number }> {
    const [sent, total] = (await this.el(this.selectors.progress).getText()).match(/[0-9,]+/g)!.map((n) => Number(n.replace(/,/g, '')));
    return { sent: sent!, total: total! };
  }

  /** Recipient rows, scrolling to the end of the list. */
  async recipients(): Promise<BroadcastRecipient[]> {
    await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("End of list"))').isExisting().catch(() => false);
    const list: BroadcastRecipient[] = [];
    for (const el of await $$(this.selectors.recipients)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const m = /^(.*), ([^,]+), (\+[\d ]+), ([^,]+)$/.exec(label);
      if (m) list.push({ name: m[1]!, status: m[2]!, phone: e164(m[3]!), label });
    }
    return list;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const broadcastsPage = new BroadcastsPage();
export const broadcastDetailPage = new BroadcastDetailPage();
