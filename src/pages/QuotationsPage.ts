// More > SALES > Quotations: the list (status chips, search) and a quotation's detail with its line items,
// totals, related records and Quotation actions menu. Live app on the phone, 2026-11-05.
//
// Read only: Change status, Convert to sales order, View PDF, Share link, Download PDF and Share are never
// tapped. Beta holds about 3 lakh quotations: a search can take 10-20 s.
import { BasePage, by } from './BasePage.js';

export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'] as const;
export const QUOTATION_FILTERS = ['All', ...QUOTATION_STATUSES] as const;
export type QuotationFilter = (typeof QUOTATION_FILTERS)[number];
export const QUOTATION_ACTIONS = ['Change status', 'Convert to sales order', 'View PDF', 'Share link'] as const;

export const QUOTATION_TEXTS = {
  searchHint: 'Search quotations',
  noQuotations: 'No quotations found',
  noQuotationsHint: 'Try another search or status.',
  shareHint: 'Share sends a link your customer can open and print.',
  hasSalesOrder: 'This quotation already has a sales order.',
};

/** List row: content-desc "<title>, <amount>, <number>, <date>, <status>". */
export interface QuotationRow { title: string; amount: string; number: string; date: string; status: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));
/** "₹29,310.53" -> 29310.53, "-₹3.84" -> -3.84. */
export const money = (t: string): number => (t.trim().startsWith('-') ? -1 : 1) * Number(t.replace(/[^\d.]/g, ''));
const CHIP_TOP = 260;
const SEARCH_TIMEOUT = 60_000;

export class QuotationsPage extends BasePage {
  protected readonly marker = by.a11y(QUOTATION_TEXTS.searchHint);

  readonly selectors = {
    moreEntry: by.a11y('Quotations'),                         // More > SALES > Quotations
    count: '//android.view.View[@text="Quotations"]/following-sibling::android.widget.TextView[1]',   // "3,01,003"; gone while loading
    search: by.a11y(QUOTATION_TEXTS.searchHint),              // EditText; its text is the hint or the query
    clearSearch: by.a11y('Clear search'),
    clearFilters: by.a11y('Clear filters'),                   // on the empty state
    filter: (name: QuotationFilter) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and contains(@bounds, ",${CHIP_TOP}]")]`,
    selectedFilters: `//android.widget.Button[@selected="true" and contains(@bounds, ",${CHIP_TOP}]")]`,
    rows: '//android.widget.Button[count(.//android.widget.TextView) >= 5]',
    row: (label: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(label)}])[1]`,
    noQuotations: by.text(QUOTATION_TEXTS.noQuotations),
    noQuotationsHint: by.text(QUOTATION_TEXTS.noQuotationsHint),
  };

  async count(): Promise<number> {
    return num(await $(this.selectors.count).getText());
  }

  /** Rows or the empty state, with the count back under the title (it is hidden while loading). */
  async waitForLoaded(timeout = SEARCH_TIMEOUT): Promise<void> {
    await driver.waitUntil(async () => ((await $$(this.selectors.rows).length) > 0 || (await $(this.selectors.noQuotations).isExisting()))
      && $(this.selectors.count).isExisting(), { timeout, timeoutMsg: `Quotations did not load within ${timeout} ms` });
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

  /** Taps a status chip and waits for the list to reload; returns the count. */
  async selectFilter(name: QuotationFilter): Promise<number> {
    const chip = await this.chipInView(this.selectors.filter(name), QUOTATION_FILTERS.indexOf(name) >= 4);
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  /** Whether a status chip is selected (brings it on screen first). */
  async isFilterSelected(name: QuotationFilter): Promise<boolean> {
    const chip = await this.chipInView(this.selectors.filter(name), QUOTATION_FILTERS.indexOf(name) >= 4);
    return (await chip.getAttribute('selected')) === 'true';
  }

  /** Selected status chips among those at the start of the row (All to Accepted; scrolls back there first). */
  async selectedFilters(): Promise<string[]> {
    await this.chipInView(this.selectors.filter('All'), false);
    const out: string[] = [];
    for (const el of await $$(this.selectors.selectedFilters)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      if ((QUOTATION_FILTERS as readonly string[]).includes(label)) out.push(label);
    }
    return out;
  }

  async visibleRows(): Promise<QuotationRow[]> {
    const rows: QuotationRow[] = [];
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
    try { await this.waitForVisible(this.selectors.noQuotations, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.clearFilters);
    await this.waitForGone(this.selectors.noQuotations, SEARCH_TIMEOUT, QUOTATION_TEXTS.noQuotations);
    await this.waitForLoaded();
  }

  async openQuotation(label: string): Promise<void> {
    await this.tap(this.selectors.row(label));
  }
}

/** A quotation: summary, LINE ITEMS with totals, RELATED and the actions menu. */
export class QuotationDetailPage extends BasePage {
  protected readonly marker = by.a11y('Quotation summary');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    // The summary group is empty: the number (View), status, amount and title are its siblings.
    number: '(//android.view.View[starts-with(@text, "QT-") or starts-with(@text, "QUO-")])[1]',
    status: '(//android.view.View[starts-with(@text, "QT-") or starts-with(@text, "QUO-")])[1]/following-sibling::android.widget.TextView[1]',
    amount: '(//android.view.View[starts-with(@text, "QT-") or starts-with(@text, "QUO-")])[1]/following-sibling::android.widget.TextView[2]',
    title: '(//android.view.View[starts-with(@text, "QT-") or starts-with(@text, "QUO-")])[1]/following-sibling::android.widget.TextView[3]',
    lineCount: '//android.view.View[@text="LINE ITEMS"]/following-sibling::android.widget.TextView[1]',
    quantities: by.textMatches('[0-9.]+ x -?₹[0-9,.]+'),       // "2 x ₹96"
    lineTotal: (quantity: string) => `//android.widget.TextView[@text=${JSON.stringify(quantity)}]/preceding-sibling::android.widget.TextView[1]`,
    texts: '//android.widget.TextView',
    assignedTo: by.descStartsWith('Assigned to, '),
    salesOrder: by.descStartsWith('Sales order, '),           // "Sales order, Draft, SO-300004, ₹240"
    shareHint: by.text(QUOTATION_TEXTS.shareHint),
    downloadPdf: by.a11y('Download PDF'),                     // never tapped
    share: '(//android.widget.Button[@content-desc="Share"])[1]',   // never tapped
    actions: by.a11y('More actions'),
    menuTitle: by.text('Quotation actions'),
    action: (name: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(name)})]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  /** Each line item as quantity x unit price and its line total. */
  async lineItems(): Promise<{ quantity: number; price: number; total: number }[]> {
    const out: { quantity: number; price: number; total: number }[] = [];
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

  /** Opens Quotation actions, reads each option (label and enabled) and closes it without choosing. */
  async actionOptions(): Promise<{ label: string; enabled: boolean }[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Quotation actions');
    const found: { label: string; enabled: boolean }[] = [];
    for (const a of QUOTATION_ACTIONS) {
      const el = await $$(this.selectors.action(a));
      if (el.length) found.push({ label: (await el[0]!.getAttribute('content-desc')) ?? a, enabled: (await el[0]!.getAttribute('enabled')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Quotation actions');
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const quotationsPage = new QuotationsPage();
export const quotationDetailPage = new QuotationDetailPage();
