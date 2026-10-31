// Campaign detail (Campaigns > tap a row) and the contact profile its recipients open.
// Read-only: the note at the bottom sends edits to the web app. Live app, 2026-10-30.
import { BasePage, by } from './BasePage.js';

export const CAMPAIGN_DETAIL_TEXTS = {
  readOnlyNote: 'Edit steps, pause or resume campaigns on the web app.',
  noRecipients: 'No recipients yet',
  sections: { delivery: 'DELIVERY', steps: 'STEPS', recipients: 'RECENT RECIPIENTS' },
};

export const DELIVERY_METRICS = ['Sent', 'Delivered', 'Read', 'Failed'] as const;
export type DeliveryMetric = (typeof DELIVERY_METRICS)[number];
export interface DeliveryTile { count: number; percent: number | null }

/** Recipient row content-desc: "<name>, <status>, <phone>, <date>". */
export interface Recipient { name: string; status: string; date: string; label: string }

// The summary lines are siblings of the "Campaign summary" group, not its children.
const SUMMARY = '//*[@content-desc="Campaign summary"]/following-sibling::android.widget.TextView';
const section = (title: string) => `//android.view.View[@text="${title}"]`;

export class CampaignDetailPage extends BasePage {
  protected readonly marker = by.a11y('Campaign summary');

  readonly selectors = {
    back: by.a11y('Back'),
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    statusPill: `${SUMMARY}[1]`,          // "Active" / "Paused"
    typeLine: `${SUMMARY}[2]`,            // "<type>, started <date>"
    enrolmentLine: `${SUMMARY}[3]`,       // "<n> enrolled: <n> active, <n> done[. From <sender>]"
    deliverySection: by.text(CAMPAIGN_DETAIL_TEXTS.sections.delivery),
    tile: (metric: DeliveryMetric) => `android=new UiSelector().descriptionMatches(${JSON.stringify(`${metric} [0-9]+(, [0-9]+%)?`)})`,
    stepsSection: by.text(CAMPAIGN_DETAIL_TEXTS.sections.steps),
    stepNumbers: `${section(CAMPAIGN_DETAIL_TEXTS.sections.steps)}/following-sibling::android.view.ViewGroup[1]//android.widget.TextView[string-length(@text) > 0 and translate(@text, "0123456789", "") = ""]`,
    recipientsSection: by.text(CAMPAIGN_DETAIL_TEXTS.sections.recipients),
    recipients: `${section(CAMPAIGN_DETAIL_TEXTS.sections.recipients)}/following-sibling::android.view.ViewGroup[1]//android.widget.Button`,
    noRecipients: by.text(CAMPAIGN_DETAIL_TEXTS.noRecipients),
    readOnlyNote: by.text(CAMPAIGN_DETAIL_TEXTS.readOnlyNote),
  };

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isDisplayed();
  }

  async status(): Promise<string> {
    return this.el(this.selectors.statusPill).getText();
  }

  /** "Retarget, started 19 Aug" -> { type: 'Retarget', started: '19 Aug' } */
  async typeAndStart(): Promise<{ type: string; started: string }> {
    const text = await this.el(this.selectors.typeLine).getText();
    const m = /^(.+), started (.+)$/.exec(text);
    if (!m) throw new Error(`Type line not in the expected format: "${text}"`);
    return { type: m[1]!, started: m[2]! };
  }

  /** "1 enrolled: 0 active, 1 done. From ..." -> counts (the sender number is not returned). */
  async enrolment(): Promise<{ enrolled: number; active: number; done: number }> {
    const text = await this.el(this.selectors.enrolmentLine).getText();
    const m = /^(\d+) enrolled: (\d+) active, (\d+) done/.exec(text);
    if (!m) throw new Error('Enrolment line not in the expected format');
    return { enrolled: Number(m[1]), active: Number(m[2]), done: Number(m[3]) };
  }

  async hasDeliverySection(): Promise<boolean> {
    return this.el(this.selectors.deliverySection).isExisting();
  }

  /** Tile "Delivered 0, 0%" -> { count: 0, percent: 0 }; "Sent 1" -> { count: 1, percent: null }. */
  async deliveryTile(metric: DeliveryMetric): Promise<DeliveryTile> {
    const label = (await this.el(this.selectors.tile(metric)).getAttribute('content-desc')) ?? '';
    const m = /^\w+ (\d+)(?:, (\d+)%)?$/.exec(label)!;
    return { count: Number(m[1]), percent: m[2] === undefined ? null : Number(m[2]) };
  }

  async delivery(): Promise<Record<DeliveryMetric, DeliveryTile>> {
    const tiles = {} as Record<DeliveryMetric, DeliveryTile>;
    for (const metric of DELIVERY_METRICS) tiles[metric] = await this.deliveryTile(metric);
    return tiles;
  }

  /** Scrolls the detail list so a section is on screen (small phones cut off the lower sections). */
  async scrollTo(text: string): Promise<void> {
    await $(`android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text(${JSON.stringify(text)}))`).isExisting().catch(() => false);
  }

  async stepCount(): Promise<number> {
    await this.scrollTo(CAMPAIGN_DETAIL_TEXTS.sections.steps);
    return (await $$(this.selectors.stepNumbers)).length;
  }

  async recipients(): Promise<Recipient[]> {
    await this.scrollTo(CAMPAIGN_DETAIL_TEXTS.sections.recipients);
    const list: Recipient[] = [];
    for (const el of await $$(this.selectors.recipients)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const parts = label.split(', ');
      // name may contain commas; status is second, then phone, then date.
      list.push({ name: parts.slice(0, parts.length - 3).join(', '), status: parts[parts.length - 3]!, date: parts[parts.length - 1]!, label });
    }
    return list;
  }

  async isNoRecipientsShown(): Promise<boolean> {
    await this.scrollTo(CAMPAIGN_DETAIL_TEXTS.noRecipients);
    return this.isVisible(this.selectors.noRecipients);
  }

  async isReadOnlyNoteShown(): Promise<boolean> {
    await this.scrollTo(CAMPAIGN_DETAIL_TEXTS.readOnlyNote);
    return this.isVisible(this.selectors.readOnlyNote);
  }

  async openRecipient(index = 0): Promise<Recipient> {
    const recipient = (await this.recipients())[index];
    if (!recipient) throw new Error(`No recipient at position ${index}`);
    await this.tap(`(${this.selectors.recipients})[${index + 1}]`);
    return recipient;
  }
}

/** Contact profile opened from a campaign recipient. Only used to check navigation; no action buttons are tapped. */
export class ContactProfilePage extends BasePage {
  protected readonly marker = by.a11y('Add Task');

  readonly selectors = {
    name: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    actions: ['WhatsApp', 'Call', 'Add Task', 'Edit'].map(by.a11y),
  };

  async isFor(name: string): Promise<boolean> {
    return this.el(this.selectors.name(name)).isDisplayed();
  }
}

export const campaignDetailPage = new CampaignDetailPage();
export const contactProfilePage = new ContactProfilePage();
