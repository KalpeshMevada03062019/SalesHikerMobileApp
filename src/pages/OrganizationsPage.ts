// More > CRM > Organizations: list with search (name, domain, email or phone) and endless scrolling, and an
// organization's detail with its Overview / Contacts / Deals / Notes tabs and actions menu. Live app on the
// phone, 2026-11-03/04.
//
// Read only: New Organization, Call, Email, Website, Edit, Add Note and every menu action (Edit, Find
// duplicates, Delete Organization) are never tapped.
import { BasePage, by } from './BasePage.js';

export const ORG_TABS = ['Overview', 'Contacts', 'Deals', 'Notes'] as const;
export type OrgTab = (typeof ORG_TABS)[number];
export const ORG_ACTIONS = ['Edit', 'Find duplicates', 'Delete Organization'] as const;
export const ORG_QUICK_ACTIONS = ['Call', 'Email', 'Website', 'Edit'] as const;
export const ORG_INFO_FIELDS = ['Phone', 'Email', 'Website', 'Address', 'Industry', 'Employees'] as const;

export const ORG_TEXTS = {
  noOrgs: 'No organizations found',
  noOrgsHint: 'Try another name, domain, email or phone.',
  noContacts: 'No contacts yet',
  noContactsHint: 'Contacts linked to this organization show up here.',
};

/** List row: content-desc "<name>[, <revenue>][, <city/industry>], <date>". */
export interface OrgRow { name: string; revenue: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

/** Swipe the screen up/down, closing the keyboard first: swiping over Gboard glide-types into fields. */
async function scroll(direction: 'up' | 'down'): Promise<void> {
  if (await driver.isKeyboardShown()) await driver.hideKeyboard();
  const { width, height } = await driver.getWindowSize();
  await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.45, direction: direction === 'up' ? 'down' : 'up', percent: 0.9 });
}

export class OrganizationsPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ organizations?');

  readonly selectors = {
    moreEntry: by.a11y('Organizations'),                     // More > CRM > Organizations
    count: this.marker,
    newOrg: by.a11y('New Organization'),
    search: '//android.widget.EditText',                     // hint "Search organizations"
    clearSearch: by.a11y('Clear search'),
    clearSearchButton: by.a11y('Clear Search'),             // on the empty state
    showing: by.textMatches('Showing [0-9,]+ of [0-9,]+ organizations?'),
    // Rows have the avatar initials as their first TextView and the name as the second.
    rows: '//android.widget.Button[count(.//android.widget.TextView) >= 3 and @content-desc!="New Organization"]',
    row: (name: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${name}, `)})]`,
    noOrgs: by.text(ORG_TEXTS.noOrgs),
    noOrgsHint: by.text(ORG_TEXTS.noOrgsHint),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noOrgs).isExisting(), {
      timeout, timeoutMsg: `Organizations did not load within ${timeout} ms`,
    });
  }

  /** Visible rows: the name (second TextView) and the revenue ("₹4,00,000", empty when not set). */
  async visibleRows(): Promise<OrgRow[]> {
    const rows: OrgRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const name = await el.$('(.//android.widget.TextView)[2]').getText().catch(() => '');
      if (!name || !label.startsWith(`${name}, `)) continue;
      const revenue = await el.$('.//android.widget.TextView[starts-with(@text, "₹")]').getText().catch(() => '');
      rows.push({ name, revenue, label });
    }
    return rows;
  }

  /** Scrolls the list down and returns every distinct organization seen (names), loading further pages. */
  async scrollAndCollect(swipes: number): Promise<string[]> {
    const seen = new Set<string>();
    for (let i = 0; i <= swipes; i++) {
      for (const r of await this.visibleRows()) seen.add(r.label);
      if (i < swipes) await scroll('up');
    }
    return [...seen];
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
    try { await this.waitForVisible(this.selectors.noOrgs, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.tap(this.selectors.clearSearchButton);
    await this.waitForLoaded();
    await driver.pause(1_000);
  }

  async openOrganization(name: string): Promise<void> {
    await this.tap(`(${this.selectors.row(name)})[1]`);
  }
}

export class OrganizationDetailPage extends BasePage {
  protected readonly marker = by.a11y('More actions');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    // The name is shown twice (toolbar and header card); both are Views with the name.
    title: (name: string) => `(//android.view.View[@text=${JSON.stringify(name)}])[1]`,
    quickAction: (name: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(name)}])[1]`,
    tab: (name: OrgTab) => (name === 'Overview' ? by.descClass('Overview', 'android.widget.Button') : by.descStartsWith(`${name}, `)),
    value: (label: string) => `(//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1])[1]`,
    infoSection: '//android.view.View[@text="ORGANIZATION INFO"]',
    descriptionSection: '//android.view.View[@text="DESCRIPTION"]',
    tagsSection: '//android.view.View[@text="TAGS"]',
    noContacts: by.text(ORG_TEXTS.noContacts),
    dealRows: '//android.widget.Button[contains(@content-desc, ", DEAL-")]',
    addNote: by.a11y('Add Note'),
    noteBylines: by.textMatches('.+ · [0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?'),   // "Yash · 20 Aug"
    actions: by.a11y('More actions'),
    menuTitle: by.text('Organization Actions'),
    action: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isExisting();
  }

  /** Value next to a label, scrolling down until it is on screen. */
  async value(label: string): Promise<string> {
    for (let i = 0; i < 4 && !(await this.el(this.selectors.value(label)).isExisting()); i++) await scroll('up');
    return this.el(this.selectors.value(label)).getText().catch(() => '');
  }

  async scrollTo(selector: string): Promise<boolean> {
    for (let i = 0; i < 4 && !(await this.el(selector).isExisting()); i++) await scroll('up');
    return this.el(selector).isExisting();
  }

  /** Count shown on a tab ("Deals, 1" -> 1). */
  async tabCount(name: Exclude<OrgTab, 'Overview'>): Promise<number> {
    return Number(((await this.el(this.selectors.tab(name)).getAttribute('content-desc')) ?? '').split(', ').pop());
  }

  async isTabSelected(name: OrgTab): Promise<boolean> {
    return (await this.el(this.selectors.tab(name)).getAttribute('selected')) === 'true';
  }

  async openTab(name: OrgTab): Promise<void> {
    await this.tap(this.selectors.tab(name));
    await driver.waitUntil(async () => this.isTabSelected(name), { timeout: 5_000, timeoutMsg: `Tab "${name}" not selected` });
    await driver.pause(2_000);
  }

  /** Opens the actions menu, reads every option and closes it without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Organization Actions');
    const found: string[] = [];
    for (const a of ORG_ACTIONS) if (await this.el(this.selectors.action(a)).isExisting()) found.push(a);
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Organization Actions');
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const organizationsPage = new OrganizationsPage();
export const organizationDetailPage = new OrganizationDetailPage();
