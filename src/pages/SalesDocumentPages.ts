// Shared screens of the SALES documents (quotations, sales orders): a list with status chips and search, and
// a detail with its summary, LINE ITEMS and totals, RELATED records and an actions menu. Each module page
// (QuotationsPage, SalesOrdersPage) configures these with its own labels. Live app on the phone, 2026-11-05.
//
// Beta holds about 3 lakh of each document: a search can take 10-20 s, so lists wait up to a minute.
import { BasePage, by } from './BasePage.js';

/** List row: content-desc "<title>, <amount>, <number>, <date>, <status>". */
export interface SalesRow { title: string; amount: string; number: string; date: string; status: string; label: string }
export interface SalesLine { quantity: number; price: number; total: number }
export interface SalesAction { label: string; enabled: boolean }

export interface SalesListConfig {
  title: string;              // screen title, e.g. "Quotations"
  searchHint: string;
  statuses: readonly string[];
  noResults: string;          // empty state, e.g. "No quotations found"
  noResultsHint: string;
  newButton?: string;         // header button to create one, e.g. "New sales order" (never tapped)
}

export interface SalesDetailConfig {
  title: string;              // screen title, e.g. "Quotation"
  summary: string;            // content-desc of the (empty) summary group, e.g. "Quotation summary"
  numberPrefixes: readonly string[];
  menuTitle: string;          // e.g. "Quotation actions"
}

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));
/** "₹29,310.53" -> 29310.53, "-₹3.84" -> -3.84. */
export const money = (t: string): number => (t.trim().startsWith('-') ? -1 : 1) * Number(t.replace(/[^\d.]/g, ''));
const CHIP_TOP = 260;
const SEARCH_TIMEOUT = 60_000;

const listSelectors = (config: SalesListConfig) => ({
  moreEntry: by.a11y(config.title),                       // More > SALES > <title>
  count: `//android.view.View[@text=${JSON.stringify(config.title)}]/following-sibling::android.widget.TextView[1]`,   // gone while loading
  search: by.a11y(config.searchHint),                     // EditText; its text is the hint or the query
  clearSearch: by.a11y('Clear search'),
  clearFilters: by.a11y('Clear filters'),                 // on the empty state
  filter: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and contains(@bounds, ",${CHIP_TOP}]")]`,
  selectedFilters: `//android.widget.Button[@selected="true" and contains(@bounds, ",${CHIP_TOP}]")]`,
  rows: '//android.widget.Button[count(.//android.widget.TextView) >= 5]',
  row: (label: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(label)}])[1]`,
  noResults: by.text(config.noResults),
  noResultsHint: by.text(config.noResultsHint),
  newButton: config.newButton ? by.a11y(config.newButton) : '',
});

export class SalesListPage extends BasePage {
  protected readonly marker: string;
  readonly filters: readonly string[];
  readonly selectors: ReturnType<typeof listSelectors>;

  constructor(readonly config: SalesListConfig) {
    super();
    this.marker = by.a11y(config.searchHint);
    this.filters = ['All', ...config.statuses];
    this.selectors = listSelectors(config);
  }

  async count(): Promise<number> {
    return num(await $(this.selectors.count).getText());
  }

  /** Rows or the empty state, with the count back under the title (it is hidden while loading). */
  async waitForLoaded(timeout = SEARCH_TIMEOUT): Promise<void> {
    await driver.waitUntil(async () => ((await $$(this.selectors.rows).length) > 0 || (await $(this.selectors.noResults).isExisting()))
      && $(this.selectors.count).isExisting(), { timeout, timeoutMsg: `${this.config.title} did not load within ${timeout} ms` });
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

  private isLate(name: string): boolean {
    return this.filters.indexOf(name) >= 4;
  }

  /** Taps a status chip and waits for the list to reload; returns the count. */
  async selectFilter(name: string): Promise<number> {
    const chip = await this.chipInView(this.selectors.filter(name), this.isLate(name));
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  /** Whether a status chip is selected (brings it on screen first). */
  async isFilterSelected(name: string): Promise<boolean> {
    const chip = await this.chipInView(this.selectors.filter(name), this.isLate(name));
    return (await chip.getAttribute('selected')) === 'true';
  }

  /** Selected status chips among those at the start of the row (scrolls back there first). */
  async selectedFilters(): Promise<string[]> {
    await this.chipInView(this.selectors.filter('All'), false);
    const out: string[] = [];
    for (const el of await $$(this.selectors.selectedFilters)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      if (this.filters.includes(label)) out.push(label);
    }
    return out;
  }

  async visibleRows(): Promise<SalesRow[]> {
    const rows: SalesRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (texts.length < 5) continue;
      const [title, amount, number, date, status] = texts as [string, string, string, string, string];
      rows.push({ title, amount, number, date, status, label });
    }
    return rows;
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
    try { await this.waitForVisible(this.selectors.noResults, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.clearFilters);
    await this.waitForGone(this.selectors.noResults, SEARCH_TIMEOUT, this.config.noResults);
    await this.waitForLoaded();
  }

  async open(label: string): Promise<void> {
    await this.tap(this.selectors.row(label));
  }
}

const detailSelectors = (config: SalesDetailConfig) => {
  // The summary group is empty: the number (View), status, amount and title are its siblings.
  const number = `(//android.view.View[${config.numberPrefixes.map((p) => `starts-with(@text, ${JSON.stringify(p)})`).join(' or ')}])[1]`;
  return {
    back: by.descClass('Back', 'android.widget.Button'),
    number,
    status: `${number}/following-sibling::android.widget.TextView[1]`,
    amount: `${number}/following-sibling::android.widget.TextView[2]`,
    title: `${number}/following-sibling::android.widget.TextView[3]`,
    lineCount: '//android.view.View[@text="LINE ITEMS"]/following-sibling::android.widget.TextView[1]',
    quantities: by.textMatches('[0-9.]+ x -?₹[0-9,.]+'),     // "2 x ₹96"
    lineTotal: (quantity: string) => `//android.widget.TextView[@text=${JSON.stringify(quantity)}]/preceding-sibling::android.widget.TextView[1]`,
    texts: '//android.widget.TextView',
    related: (label: string) => by.descStartsWith(`${label}, `),   // "Assigned to, Yash", "Quotation, QT-301006"
    text: (text: string) => by.text(text),
    button: (name: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(name)}])[1]`,   // bottom bar; never tapped
    actions: by.a11y('More actions'),
    menuTitle: by.text(config.menuTitle),
    action: (name: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(name)})]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };
};

export class SalesDetailPage extends BasePage {
  protected readonly marker: string;
  readonly selectors: ReturnType<typeof detailSelectors>;

  constructor(readonly config: SalesDetailConfig) {
    super();
    this.marker = by.a11y(config.summary);
    this.selectors = detailSelectors(config);
  }

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  async relatedLabel(label: string): Promise<string> {
    return (await $(this.selectors.related(label)).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  /** Each line item as quantity x unit price and its line total. */
  async lineItems(): Promise<SalesLine[]> {
    const out: SalesLine[] = [];
    for (const el of await $$(this.selectors.quantities)) {
      const q = await el.getText();
      const [quantity, price] = q.split(' x ');
      out.push({ quantity: Number(quantity), price: money(price!), total: money(await this.text(this.selectors.lineTotal(q))) });
    }
    return out;
  }

  /** The totals block, label -> amount, from Subtotal to Total (taxes and deductions in between). */
  async totals(): Promise<{ label: string; amount: number }[]> {
    const texts: string[] = [];
    for (const el of await $$(this.selectors.texts)) texts.push(await el.getText());
    const start = texts.indexOf('Subtotal');
    const out: { label: string; amount: number }[] = [];
    for (let i = start; i >= 0 && i + 1 < texts.length; i += 2) {
      out.push({ label: texts[i]!, amount: money(texts[i + 1]!) });
      if (texts[i] === 'Total') break;
    }
    return out;
  }

  /** Scrolls down until the element is on screen. */
  async scrollTo(selector: string): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 4 && !(await $(selector).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.35, width: width * 0.8, height: height * 0.4, direction: 'down', percent: 0.6 });
    }
  }

  /** Opens the actions menu, reads each expected option (label and enabled) and closes it without choosing. */
  async actionOptions(expected: readonly string[]): Promise<SalesAction[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, this.config.menuTitle);
    const found: SalesAction[] = [];
    for (const a of expected) {
      const el = await $$(this.selectors.action(a));
      if (el.length) found.push({ label: (await el[0]!.getAttribute('content-desc')) ?? a, enabled: (await el[0]!.getAttribute('enabled')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, this.config.menuTitle);
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}
