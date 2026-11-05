// More > CRM > Leads: list with status chips, a Source filter sheet and search, and a lead's detail with its
// Overview / Activity / Notes tabs and actions menu. Live app on the phone, 2026-11-04.
//
// Read only: New Lead, the status button, WhatsApp, Call, Convert, Set (follow-up), Edit, Add Note,
// Convert Lead and every menu action (Edit, Change Status, Find duplicates, Delete Lead) are never tapped.
// New leads keep arriving on beta (Instagram bot), so totals can grow while a test runs.
import { BasePage, by } from './BasePage.js';

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'] as const;
export const LEAD_FILTERS = ['All', ...LEAD_STATUSES, 'Converted'] as const;
export type LeadFilter = (typeof LEAD_FILTERS)[number];
export const LEAD_TABS = ['Overview', 'Activity', 'Notes'] as const;
export type LeadTab = (typeof LEAD_TABS)[number];
export const LEAD_QUICK_ACTIONS = ['WhatsApp', 'Call', 'Convert'] as const;
export const LEAD_ACTIONS = ['Edit', 'Change Status', 'Find duplicates', 'Delete Lead'] as const;

export const LEAD_TEXTS = {
  noLeads: 'No leads found',
  noLeadsHint: 'Try another name, number or filter.',
  noContact: 'No contact linked. Edit the lead to link one.',
  noNotes: 'No notes yet',
  anySource: 'Any Source',
};

/** List row: content-desc "<name>, <age or date>, [<contact>, ]<source>, <status>". */
export interface LeadRow { name: string; contact: string; source: string; status: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));
const CHIP_TOP = 264;

export class LeadsPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ leads?');

  readonly selectors = {
    moreEntry: by.a11y('Leads'),                             // More > CRM > Leads
    count: this.marker,
    newLead: by.a11y('New Lead'),
    search: '//android.widget.EditText',                     // hint "Search leads"
    clearSearch: by.a11y('Clear search'),
    clearFilters: by.a11y('Clear Filters'),                 // on the empty state
    // Status chips share their labels with row statuses: anchor on the chip row.
    filter: (name: LeadFilter) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and contains(@bounds, ",${CHIP_TOP}]")]`,
    selectedFilters: `//android.widget.Button[@selected="true" and contains(@bounds, ",${CHIP_TOP}]")]`,
    sourceChip: `//android.widget.Button[@content-desc="Source" or starts-with(@content-desc, "Source")][contains(@bounds, ",${CHIP_TOP}]")]`,
    sourceSheet: by.text('Filter by Source'),
    sourceOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sourceClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
    rows: `//android.widget.Button[count(.//android.widget.TextView) >= 5]`,
    row: (label: string) => `//android.widget.Button[@content-desc=${JSON.stringify(label)}]`,
    noLeads: by.text(LEAD_TEXTS.noLeads),
    noLeadsHint: by.text(LEAD_TEXTS.noLeadsHint),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noLeads).isExisting(), {
      timeout, timeoutMsg: `Leads did not load within ${timeout} ms`,
    });
  }

  /** Brings a chip fully on screen (the chip row scrolls sideways) and returns it. */
  private async chipInView(selector: string, later: boolean): Promise<WebdriverIO.Element> {
    const { width } = await driver.getWindowSize();
    for (let i = 0; i < 6; i++) {
      const found = await $$(selector);
      if (found.length) {
        const { x } = await found[0]!.getLocation();
        const { width: w } = await found[0]!.getSize();
        if (x > 2 && x + w < width - 2) return found[0]!;
      }
      await driver.execute('mobile: scrollGesture', { left: width * 0.15, top: CHIP_TOP + 4, width: width * 0.7, height: 80, direction: later ? 'right' : 'left', percent: 0.6 });
    }
    return $(selector).getElement();
  }

  /** Taps a status chip and waits for the list to reload; returns "N leads". */
  async selectFilter(name: LeadFilter): Promise<number> {
    const chip = await this.chipInView(this.selectors.filter(name), LEAD_FILTERS.indexOf(name) >= 4);
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  async selectedFilters(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.selectors.selectedFilters)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
  }

  /** Opens the Source sheet and returns its options (the selected one first is not assumed). */
  async openSourceSheet(): Promise<{ options: string[]; selected: string }> {
    const chip = await this.chipInView(this.selectors.sourceChip, true);
    await chip.click();
    await this.waitForVisible(this.selectors.sourceSheet, 10_000, 'Filter by Source');
    const options: string[] = [];
    let selected = '';
    for (const el of await $$('//android.widget.Button[@content-desc!="Close"]')) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      options.push(label);
      if ((await el.getAttribute('selected')) === 'true') selected = label;
    }
    return { options, selected };
  }

  /** Picks a source in the open sheet and waits for the list to reload; returns "N leads". */
  async chooseSource(name: string): Promise<number> {
    await this.tap(this.selectors.sourceOption(name));
    await this.waitForGone(this.selectors.sourceSheet, 10_000, 'Filter by Source');
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  async closeSourceSheet(): Promise<void> {
    await this.tap(this.selectors.sourceClose);
    await this.waitForGone(this.selectors.sourceSheet, 5_000, 'Filter by Source');
  }

  /** Visible, fully drawn rows. */
  async visibleRows(): Promise<LeadRow[]> {
    const rows: LeadRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (texts.length < 5) continue;
      const [, name, , line, status] = texts as [string, string, string, string, string];
      const parts = line.split(', ');
      rows.push({ name, contact: parts.length > 1 ? parts.slice(0, -1).join(', ') : '', source: parts[parts.length - 1]!, status, label });
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
    try { await this.waitForVisible(this.selectors.noLeads, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.tap(this.selectors.clearFilters);
    await this.waitForLoaded();
    await driver.pause(1_000);
  }

  async openLead(label: string): Promise<void> {
    await this.tap(`(${this.selectors.row(label)})[1]`);
  }
}

export class LeadDetailPage extends BasePage {
  protected readonly marker = by.a11y('More actions');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    title: (name: string) => `(//android.view.View[@text=${JSON.stringify(name)}])[1]`,
    statusButton: by.descStartsWith('Status '),              // "Status Won. Change" (never tapped)
    progress: by.descStartsWith('Lead progress '),           // "Lead progress 100%"
    quickAction: (name: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(name)}])[1]`,
    noContact: by.text(LEAD_TEXTS.noContact),
    // Header card: the name (second View with it), then the amount or the linked contact.
    contact: (name: string) => `(//android.view.View[@text=${JSON.stringify(name)}])[2]/following-sibling::android.widget.TextView[1]`,
    tab: (name: LeadTab) => by.descClass(name, 'android.widget.Button'),
    value: (label: string) => `(//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1])[1]`,
    leadInfo: '//android.view.View[@text="LEAD INFO"]',
    enquiry: '//android.view.View[@text="ENQUIRY"]',
    convertLead: by.a11y('Convert Lead'),
    // Activity entries: "<what happened>, <date>, <by whom>".
    activity: 'android=new UiSelector().descriptionMatches("(?s).+, [0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?, .+")',
    noNotes: by.text(LEAD_TEXTS.noNotes),
    addNote: by.a11y('Add Note'),
    actions: by.a11y('More actions'),
    menuTitle: by.text('Lead Actions'),
    action: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isExisting();
  }

  /** "Status Won. Change" -> "Won". */
  async status(): Promise<string> {
    return ((await this.el(this.selectors.statusButton).getAttribute('content-desc')) ?? '').replace(/^Status (.*)\. Change$/, '$1');
  }

  /** "Lead progress 100%" -> 100. */
  async progress(): Promise<number> {
    return num((await this.el(this.selectors.progress).getAttribute('content-desc')) ?? '');
  }

  async text(selector: string): Promise<string> {
    return this.el(selector).getText().catch(() => '');
  }

  async value(label: string): Promise<string> {
    return this.text(this.selectors.value(label));
  }

  async isTabSelected(name: LeadTab): Promise<boolean> {
    return (await this.el(this.selectors.tab(name)).getAttribute('selected')) === 'true';
  }

  async openTab(name: LeadTab): Promise<void> {
    await this.tap(this.selectors.tab(name));
    await driver.waitUntil(async () => this.isTabSelected(name), { timeout: 5_000, timeoutMsg: `Tab "${name}" not selected` });
    await driver.pause(2_000);
  }

  /** Opens the actions menu, reads every option and closes it without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Lead Actions');
    const found: string[] = [];
    for (const a of LEAD_ACTIONS) if (await this.el(this.selectors.action(a)).isExisting()) found.push(a);
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Lead Actions');
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const leadsPage = new LeadsPage();
export const leadDetailPage = new LeadDetailPage();
