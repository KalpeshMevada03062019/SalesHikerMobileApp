// More > CRM > Tickets: the list (status chips, a Priority sheet, search) and a ticket's detail with its
// Ticket Actions menu. Live app on the phone, 2026-11-05.
//
// Read only: New Ticket, Reopen, Add Note, the note box and every menu action (Change Status, Change
// Priority, Edit, Delete Ticket) are never tapped.
import { BasePage, by } from './BasePage.js';

export const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting', 'Closed'] as const;
export const TICKET_FILTERS = ['All', ...TICKET_STATUSES] as const;
export type TicketFilter = (typeof TICKET_FILTERS)[number];
export const TICKET_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export const TICKET_ACTIONS = ['Change Status', 'Change Priority', 'Edit', 'Delete Ticket'] as const;

export const TICKET_TEXTS = {
  searchHint: 'Search tickets',
  noTickets: 'No tickets found',
  noTicketsHint: 'Try another title, number or filter.',
  anyPriority: 'Any priority',
  prioritySheet: 'Filter by Priority',
};

/** List row: content-desc "<title>, <date>, <number>, <status>"; the status badge is the last text. */
export interface TicketRow { title: string; date: string; number: string; status: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));
const CHIP_TOP = 260;

export class TicketsPage extends BasePage {
  protected readonly marker = by.a11y(TICKET_TEXTS.searchHint);

  readonly selectors = {
    moreEntry: by.a11y('Tickets'),                            // More > CRM > Tickets
    count: by.textMatches('[0-9,]+ tickets?'),                // "1 ticket" under the title
    newTicket: by.a11y('New Ticket'),                         // never tapped
    search: by.a11y(TICKET_TEXTS.searchHint),                 // EditText; its text is the hint or the query
    clearSearch: by.a11y('Clear search'),
    clearFilters: by.a11y('Clear Filters'),                   // on the empty state: resets search, status and priority
    // Chips share labels with row statuses: anchor on the chip row.
    filter: (name: TicketFilter) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and contains(@bounds, ",${CHIP_TOP}]")]`,
    selectedFilters: `//android.widget.Button[@selected="true" and contains(@bounds, ",${CHIP_TOP}]")]`,
    priorityChip: `//android.widget.Button[(@content-desc="Priority" or starts-with(@content-desc, "Priority: ")) and contains(@bounds, ",${CHIP_TOP}]")]`,
    clearPriority: '//android.widget.Button[starts-with(@content-desc, "Clear Priority: ")]',
    sheetTitle: by.text(TICKET_TEXTS.prioritySheet),
    sheetOptions: '//android.widget.Button[@content-desc!="Close"]',
    sheetOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
    rows: '//android.widget.Button[count(.//android.widget.TextView) >= 4]',
    row: (label: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(label)}])[1]`,
    rowStatus: (label: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(label)}]//android.widget.TextView)[last()]`,
    footer: by.textMatches('Showing [0-9,]+ of [0-9,]+ tickets?'),
    noTickets: by.text(TICKET_TEXTS.noTickets),
    noTicketsHint: by.text(TICKET_TEXTS.noTicketsHint),
  };

  async count(): Promise<number> {
    return num(await $(this.selectors.count).getText());
  }

  /** "Showing 1 of 1 ticket" -> { shown: 1, total: 1 }. */
  async footer(): Promise<{ shown: number; total: number }> {
    const [shown, total] = ((await $(this.selectors.footer).getText()).match(/[0-9,]+/g) ?? []).map(num);
    return { shown: shown ?? NaN, total: total ?? NaN };
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || $(this.selectors.noTickets).isExisting(), {
      timeout, timeoutMsg: `Tickets did not load within ${timeout} ms`,
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

  /** Taps a status chip and waits for the list to reload; returns "N tickets". */
  async selectFilter(name: TicketFilter): Promise<number> {
    const chip = await this.chipInView(this.selectors.filter(name), TICKET_FILTERS.indexOf(name) >= 3);
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  /** Selected status chips (scrolls the chip row back to its start first). */
  async selectedFilters(): Promise<string[]> {
    await this.chipInView(this.selectors.filter('All'), false);
    const out: string[] = [];
    for (const el of await $$(this.selectors.selectedFilters)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      if ((TICKET_FILTERS as readonly string[]).includes(label)) out.push(label);
    }
    return out;
  }

  /** "Priority" -> "", "Priority: Normal" -> "Normal". */
  async priorityValue(): Promise<string> {
    const chip = await this.chipInView(this.selectors.priorityChip, true);
    return ((await chip.getAttribute('content-desc')) ?? '').replace(/^Priority(: )?/, '');
  }

  /** Opens the Priority sheet and returns its options and the selected one. */
  async openPrioritySheet(): Promise<{ options: string[]; selected: string }> {
    const chip = await this.chipInView(this.selectors.priorityChip, true);
    await chip.click();
    await this.waitForVisible(this.selectors.sheetTitle, 10_000, TICKET_TEXTS.prioritySheet);
    const options: string[] = [];
    let selected = '';
    for (const el of await $$(this.selectors.sheetOptions)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      options.push(label);
      if ((await el.getAttribute('selected')) === 'true') selected = label;
    }
    return { options, selected };
  }

  /** Picks a priority in the open sheet and waits for the list to reload; returns "N tickets". */
  async choosePriority(name: string): Promise<number> {
    await this.tap(this.selectors.sheetOption(name));
    await this.waitForGone(this.selectors.sheetTitle, 10_000, TICKET_TEXTS.prioritySheet);
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  async closePrioritySheet(): Promise<void> {
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle, 5_000, TICKET_TEXTS.prioritySheet);
  }

  /** Taps the X next to "Priority: <value>". */
  async clearPriority(): Promise<void> {
    const chip = await this.chipInView(this.selectors.clearPriority, true);
    await chip.click();
    await driver.pause(2_500);
    await this.waitForLoaded();
  }

  async visibleRows(): Promise<TicketRow[]> {
    const rows: TicketRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (texts.length < 4) continue;
      const [title, date, number, status] = texts as [string, string, string, string];
      rows.push({ title, date, number, status, label });
    }
    return rows;
  }

  /** Width in px of a row's status badge text. */
  async statusWidth(label: string): Promise<number> {
    return (await $(this.selectors.rowStatus(label)).getSize()).width;
  }

  async search(text: string): Promise<void> {
    const field = $(this.selectors.search);
    await field.waitForDisplayed();
    if (await $(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(2_500);
    await this.waitForLoaded();
  }

  async isEmptyStateShown(timeout = 10_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noTickets, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.clearFilters);
    await this.waitForGone(this.selectors.noTickets, 10_000, TICKET_TEXTS.noTickets);
    await this.waitForLoaded();
  }

  async openTicket(label: string): Promise<void> {
    await this.tap(this.selectors.row(label));
  }
}

export class TicketDetailPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Ticket"]';

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    number: (number: string) => `//android.widget.TextView[@text=${JSON.stringify(number)}]`,
    // Header: number, title (View), then status and priority badges.
    title: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
    status: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[1]`,
    priority: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[2]`,
    opened: by.textStartsWith('Opened by '),                  // "Opened by Yash, 7 Oct, 5:33 PM"
    reopen: by.a11y('Reopen'),                                // closed tickets; never tapped
    detail: (label: string) => by.descStartsWith(`${label}, `),   // "Assignee, Yash"
    section: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    sectionText: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]/following::android.widget.TextView[1]`,
    activityDates: by.textMatches('[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?, [0-9]{1,2}:[0-9]{2} [AP]M'),
    addNote: by.a11y('Add Note'),                             // never tapped
    noteBox: by.descClass('Note', 'android.widget.EditText'), // nothing typed
    actions: by.a11y('More actions'),
    menuTitle: by.text('Ticket Actions'),
    action: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  /** "Assignee, Yash" -> "Yash". */
  async detail(label: string): Promise<string> {
    return ((await $(this.selectors.detail(label)).getAttribute('content-desc').catch(() => '')) ?? '').slice(label.length + 2);
  }

  /** Scrolls down until the element is on screen. */
  async scrollTo(selector: string): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 4 && !(await $(selector).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.35, width: width * 0.8, height: height * 0.4, direction: 'down', percent: 0.6 });
    }
  }

  /** Opens Ticket Actions, reads every option and closes it without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Ticket Actions');
    const found: string[] = [];
    for (const a of TICKET_ACTIONS) if (await $(this.selectors.action(a)).isExisting()) found.push(a);
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Ticket Actions');
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const ticketsPage = new TicketsPage();
export const ticketDetailPage = new TicketDetailPage();
