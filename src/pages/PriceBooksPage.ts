// More > INVENTORY > Price Books: the list (count "N price books", search, chips "All, n" / "Active, n" /
// "Inactive, n" whose counts follow the search), a price book's detail (name, currency, status, the tabs Prices,
// Customers and Details), the Add price and Edit price sheets, the actions menu and the New / Edit price book forms.
// Live app on the phone, 2026-11-17: 5 price books on beta; reference "SalesHiker Pricebook 1" (USD, 1 price).
//
// Read only: Save, Remove price, Add organization, Add contact and every menu action except Edit (cancelled
// unchanged) are never chosen; sheets and pickers are opened and closed; the new form is discarded.
import { BasePage, by } from './BasePage.js';
import { SalesListPage } from './SalesDocumentPages.js';

export const PRICE_BOOK_STATUSES = ['Active', 'Inactive'] as const;
export const PRICE_BOOK_ACTIONS = ['Edit', 'Mark inactive', 'View PDF', 'Save PDF', 'Delete'] as const;

export const PRICE_BOOK_TEXTS = {
  searchHint: 'Search price books',
  noResults: 'No price books found',
  noResultsHint: 'Try another search or status.',
  noOrganizations: 'No organizations use this book.',
  noContacts: 'No contacts use this book.',
  nameHint: 'For example Wholesale',
  inactiveHint: 'An inactive book gives no prices.',
  defaultHint: 'Documents use this book when a customer has no book of their own.',
  chooseProduct: 'Product: Choose a product',
  qtyHint: '1 means every order. A higher number makes a bulk price.',
  discardTitle: 'Discard this price book?',
  discardMessage: 'This price book is not saved yet.',
};

/** List row: name, then "currency, n price(s)[, vendor]". */
export interface PriceBookRow { name: string; info: string; prices: number; label: string }

const CHIP = (name: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${name}, `)}) and contains(@bounds, ",260]")]`;

class PriceBookListPage extends SalesListPage {
  readonly book = {
    chip: CHIP,
    row: '//android.widget.Button[count(.//android.widget.TextView) = 2 and not(contains(@bounds, ",260]"))]',
    endOfList: by.textStartsWith('End of list.'),
  };

  async rowsOnScreen(): Promise<PriceBookRow[]> {
    const out: PriceBookRow[] = [];
    for (const el of await $$(this.book.row)) {
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push(await t.getText());
      const prices = /, ([0-9]+) prices?\b/.exec(`, ${texts[1] ?? ''}`);
      if (!prices) continue;
      out.push({ name: texts[0] ?? '', info: texts[1] ?? '', prices: Number(prices[1]), label: (await el.getAttribute('content-desc')) ?? '' });
    }
    return out;
  }

  /** Count on each chip, e.g. { All: 5, Active: 5, Inactive: 0 }. */
  async chipCounts(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const name of ['All', ...PRICE_BOOK_STATUSES]) {
      const d = (await $(CHIP(name)).getAttribute('content-desc').catch(() => '')) ?? '';
      out[name] = Number(d.split(', ')[1] ?? NaN);
    }
    return out;
  }

  async isChipSelected(name: string): Promise<boolean> {
    return (await $(CHIP(name)).getAttribute('selected')) === 'true';
  }

  async selectChip(name: string): Promise<number> {
    await $(CHIP(name)).click();
    await driver.waitUntil(async () => this.isChipSelected(name), { timeout: 5_000, timeoutMsg: `Chip "${name}" not selected` });
    await driver.pause(2_000);
    await this.waitForLoaded();
    return this.count();
  }

  async endOfListText(): Promise<string> {
    return $(this.book.endOfList).getText().catch(() => '');
  }
}

export const priceBooksPage = new PriceBookListPage({
  title: 'Price Books',
  searchHint: PRICE_BOOK_TEXTS.searchHint,
  statuses: PRICE_BOOK_STATUSES,
  noResults: PRICE_BOOK_TEXTS.noResults,
  noResultsHint: PRICE_BOOK_TEXTS.noResultsHint,
  newButton: 'New price book',
  minRowTexts: 2,
});

const STATUS = '(//android.widget.TextView[@text="Active" or @text="Inactive"])[1]';
const sheetClose = '(//android.widget.Button[@content-desc="Close"])[last()]';

export interface PriceSheet { title: string; subtitle: string; product: string; unitPrice: string; cost: string; save: boolean; remove: boolean }

class PriceBookDetailPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Price Book"]';
  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    name: `${STATUS}/preceding-sibling::android.view.View[1]`,
    currency: `${STATUS}/preceding-sibling::android.widget.TextView[1]`,
    status: STATUS,
    tab: (name: 'Prices' | 'Customers' | 'Details') => (name === 'Prices' ? by.descStartsWith('Prices') : by.a11y(name)),   // "Prices, 1"
    sectionCount: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[1]`,
    // Price rows sit in the container after the PRICES heading.
    priceRows: '//android.view.View[@text="PRICES"]/following-sibling::android.view.ViewGroup[1]/android.widget.Button',
    priceRow: (product: string) => `(//android.view.View[@text="PRICES"]/following-sibling::android.view.ViewGroup[1]/android.widget.Button[starts-with(@content-desc, ${JSON.stringify(product)})])[1]`,
    field: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    notes: '//android.view.View[@text="NOTES"]/following::android.widget.TextView[1]',
    addPrice: '//android.widget.Button[@content-desc="Add price"]',
    addOrganization: '//android.widget.Button[@content-desc="Add organization"]',   // never tapped
    addContact: '//android.widget.Button[@content-desc="Add contact"]',             // never tapped
    noOrganizations: by.text(PRICE_BOOK_TEXTS.noOrganizations),
    noContacts: by.text(PRICE_BOOK_TEXTS.noContacts),
    actions: by.a11y('More actions'),
    menuTitle: by.text('Price book actions'),
    action: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose,
    // Add price / Edit price sheets
    sheetTitle: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
    sheetSubtitle: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[1]`,
    product: by.descStartsWith('Product: '),
    unitPriceLabel: by.textStartsWith('Unit price ('),       // "Unit price (USD) *"
    unitPrice: by.descStartsWith('Unit price ('),           // EditText "Unit price (USD)"
    cost: by.a11y('Purchase cost'),
    qtyHint: by.text(PRICE_BOOK_TEXTS.qtyHint),
    save: '//android.widget.Button[@content-desc="Save"]',   // never tapped
    remove: '//android.widget.Button[@content-desc="Remove price"]',   // never tapped
    productTitle: '//android.view.View[@text="Product"]',
    productSearch: by.a11y('Search name or SKU'),
    option: '//android.widget.Button[@content-desc!="Close"]',
  };

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  async field(label: string): Promise<string> {
    return this.text(this.selectors.field(label));
  }

  async openTab(name: 'Prices' | 'Customers' | 'Details'): Promise<void> {
    await this.tap(this.selectors.tab(name));
    await driver.pause(1_500);
  }

  async tabLabel(name: 'Prices' | 'Customers' | 'Details'): Promise<string> {
    return (await $(this.selectors.tab(name)).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  /** Waits until the price rows match the PRICES count (the rows load after the header). */
  async waitForPrices(timeout = 20_000): Promise<void> {
    await driver.waitUntil(async () => {
      const count = Number(await this.text(this.selectors.sectionCount('PRICES')) || NaN);
      return !Number.isNaN(count) && (await $$(this.selectors.priceRows).length) === count;
    }, { timeout, interval: 500 }).catch(() => undefined);   // the test reports a mismatch itself
  }

  async priceLabels(): Promise<string[]> {
    await this.waitForPrices();
    const out: string[] = [];
    for (const el of await $$(this.selectors.priceRows)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }

  private async readSheet(title: string): Promise<PriceSheet> {
    const s = this.selectors;
    await this.waitForVisible(s.sheetTitle(title), 10_000, title);
    const product = title === 'Add price'
      ? ((await $(s.product).getAttribute('content-desc').catch(() => '')) ?? '')
      : await this.text('//android.widget.TextView[starts-with(@text, "Unit price (")]/preceding::android.widget.TextView[1]');   // just above the price label
    return { title, subtitle: await this.text(s.sheetSubtitle(title)), product, unitPrice: await this.text(s.unitPrice), cost: await this.text(s.cost),
      save: await $(s.save).isExisting(), remove: await $(s.remove).isExisting() };
  }

  private async closeSheet(title: string): Promise<void> {
    await this.hideKeyboard();
    if (await $(this.selectors.sheetTitle(title)).isExisting()) await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle(title), 5_000, title);
  }

  /** Taps a price row, reads the Edit price sheet and closes it without saving. */
  async readEditPrice(product: string): Promise<PriceSheet> {
    await this.tap(this.selectors.priceRow(product));
    const sheet = await this.readSheet('Edit price');
    await this.closeSheet('Edit price');
    return sheet;
  }

  /** Opens Add price, reads it; optionally searches the product picker; closes everything without saving. */
  async readAddPrice(search?: string): Promise<{ sheet: PriceSheet; qtyHint: boolean; options: string[] }> {
    await this.tap(this.selectors.addPrice);
    const sheet = await this.readSheet('Add price');
    const qtyHint = await $(this.selectors.qtyHint).isExisting();
    const options: string[] = [];
    if (search) {
      await this.tap(this.selectors.product);
      await this.waitForVisible(this.selectors.productTitle, 10_000, 'Product');
      const field = $(this.selectors.productSearch);
      await field.click();
      await field.setValue(search);
      await driver.pause(3_000);
      for (const el of await $$(this.selectors.option)) {
        const d = (await el.getAttribute('content-desc')) ?? '';
        if (d && !d.startsWith('Product: ') && d !== 'Save' && d !== 'Add price') options.push(d);
      }
      await this.tap(this.selectors.sheetClose);              // closes the picker (keyboard still up: Back would close it too)
      await this.waitForGone(this.selectors.productTitle, 5_000, 'Product');
    }
    await this.closeSheet('Add price');
    return { sheet, qtyHint, options };
  }

  /** Opens the actions menu, reads each expected option and closes it without choosing. */
  async actionOptions(expected: readonly string[]): Promise<{ label: string; enabled: boolean }[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Price book actions');
    const found: { label: string; enabled: boolean }[] = [];
    for (const a of expected) {
      const el = await $$(this.selectors.action(a));
      if (el.length) found.push({ label: a, enabled: (await el[0]!.getAttribute('enabled')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Price book actions');
    return found;
  }

  async openEdit(): Promise<void> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Price book actions');
    await this.tap(this.selectors.action('Edit'));
  }
}

export const priceBookDetailPage = new PriceBookDetailPage();

const formSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),                                   // never tapped
  name: by.a11y('Name'),
  currency: by.descStartsWith('Currency: '),               // "Currency: USD, US Dollar"
  vendor: by.descStartsWith('Vendor: '),                   // "Vendor: No supplier"
  notes: by.a11y('Notes'),
  active: '//android.widget.Switch[@content-desc="Active"]',
  workspaceDefault: '//android.widget.Switch[@content-desc="Workspace default"]',
  inactiveHint: by.text(PRICE_BOOK_TEXTS.inactiveHint),
  defaultHint: by.text(PRICE_BOOK_TEXTS.defaultHint),
  sheetTitle: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
  sheetClose,
  discardTitle: by.text(PRICE_BOOK_TEXTS.discardTitle),
  discardMessage: by.text(PRICE_BOOK_TEXTS.discardMessage),
  discard: by.a11y('Discard'),
  dialogCancel: '//android.widget.Button[@content-desc="Cancel" and following-sibling::android.widget.Button[@content-desc="Discard"]]',
};

export interface PriceBookForm { name: string; currency: string; vendor: string; notes: string; active: boolean; workspaceDefault: boolean; hints: boolean }

/** The New price book and Edit price book forms (one screen). */
class PriceBookFormPage extends BasePage {
  protected readonly marker: string;
  readonly selectors = formSelectors;

  constructor(title: string) {
    super();
    this.marker = `//android.view.View[@text=${JSON.stringify(title)}]`;
  }

  async read(): Promise<PriceBookForm> {
    const s = this.selectors;
    const txt = (sel: string) => $(sel).getText().catch(() => '');
    const desc = async (sel: string) => (await $(sel).getAttribute('content-desc').catch(() => '')) ?? '';
    const on = async (sel: string) => (await $(sel).getAttribute('checked')) === 'true';
    return { name: await txt(s.name), currency: await desc(s.currency), vendor: await desc(s.vendor), notes: await txt(s.notes),
      active: await on(s.active), workspaceDefault: await on(s.workspaceDefault),
      hints: (await $(s.inactiveHint).isExisting()) && (await $(s.defaultHint).isExisting()) };
  }

  /** Opens a picker (Currency or Vendor), returns its options on the first screen and closes it. */
  async pickerOptions(field: 'Currency' | 'Vendor'): Promise<string[]> {
    await this.tap(field === 'Currency' ? this.selectors.currency : this.selectors.vendor);
    await this.waitForVisible(this.selectors.sheetTitle(field), 10_000, field);
    const out: string[] = [];
    for (const el of await $$('//android.widget.Button')) {
      const d = (await el.getAttribute('content-desc')) ?? '';
      // Vendor rows add the supplier e-mail ("Name, e-mail"): keep the name only, so no address reaches the reports.
      if (d && d !== 'Close') out.push(field === 'Vendor' ? d.split(', ')[0]! : d);
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle(field), 5_000, field);
    return out;
  }

  async setName(value: string): Promise<void> {
    const el = $(this.selectors.name);
    await el.click();
    await el.setValue(value);
    await this.hideKeyboard();
  }

  /** Cancel on an unchanged form: closes it; returns whether a discard dialog appeared. */
  async cancel(): Promise<boolean> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await driver.pause(1_500);
    return $(this.selectors.discardTitle).isExisting();
  }

  async cancelThenKeep(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, PRICE_BOOK_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.dialogCancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, PRICE_BOOK_TEXTS.discardTitle);
    return seen;
  }

  async discard(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, PRICE_BOOK_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.discard);
    return seen;
  }
}

export const newPriceBookPage = new PriceBookFormPage('New price book');
export const editPriceBookPage = new PriceBookFormPage('Edit price book');
