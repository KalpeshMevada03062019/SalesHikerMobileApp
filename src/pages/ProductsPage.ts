// More > INVENTORY > Products: the list (count "N products", search by name / SKU / barcode, Active / Inactive
// chips and a Category picker chip), a product's detail (photo, name, SKU, status button, price, the tabs Summary,
// Stock, Variants, Details, Related and Activity), its actions menu and status picker, and the New product form.
// Live app on the phone, 2026-11-17: 3,332 products; QA reference QA-TEST Gadget R3 (PRD-6040).
//
// Read only: Save, Scan barcode, Adjust stock and every menu action and status are never chosen; the form is
// filled and discarded; menus and pickers are opened and closed.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage } from './SalesDocumentPages.js';

export const PRODUCT_STATUSES = ['Active', 'Inactive'] as const;
export const PRODUCT_ACTIONS = ['Edit', 'Mark inactive', 'Adjust stock', 'View PDF', 'Save PDF', 'Delete'] as const;
export const PRODUCT_TABS = ['Summary', 'Stock', 'Variants', 'Details', 'Related', 'Activity'] as const;
export type ProductTab = typeof PRODUCT_TABS[number];

export const PRODUCT_TEXTS = {
  searchHint: 'Search name, SKU or barcode',
  noResults: 'No products found',
  noResultsHint: 'Try another search or filter.',
  deleteBlocked: 'It has stock in a warehouse. Mark it inactive instead.',
  reorderWarning: (level: number) => `Stock is at or below the reorder level (${level}).`,
  noVariants: 'This product has no variants.',
  barcodeHint: 'Digits only',
  discardTitle: 'Discard this product?',
  discardMessage: 'This product is not saved yet.',
};

/** List row: name, price, optional SKU (or category), then "N in stock" or "Inactive". */
export interface ProductRow { name: string; price: string; code: string; stock: string; label: string }

class ProductListPage extends SalesListPage {
  readonly product = {
    scanBarcode: by.a11y('Scan barcode'),                     // never tapped (camera)
    categoryChip: '//android.widget.Button[@content-desc="Category" and contains(@bounds, ",260]")]',
    categoryTitle: '//android.view.View[@text="Category"]',
    categorySearch: by.a11y('Search categories'),
    categoryOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    clearCategory: (name: string) => by.a11y(`Clear ${name}`),
    selectedCategory: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and contains(@bounds, ",260]")]`,
  };

  async productRows(): Promise<ProductRow[]> {
    const rows: ProductRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      const stock = texts[texts.length - 1] ?? '';
      // A row cut off at the bottom of the screen lacks its stock: leave it out.
      if (!/^(-?[0-9,]+ in stock|Inactive)$/.test(stock)) continue;
      rows.push({ name: texts[0] ?? '', price: texts[1] ?? '', code: texts.length > 3 ? texts[2]! : '', stock, label });
    }
    return rows;
  }

  /** Category chip > picker > option; returns the count. */
  async selectCategory(name: string): Promise<number> {
    await this.tap(this.product.categoryChip);
    await this.waitForVisible(this.product.categoryTitle, 10_000, 'Category');
    await this.tap(this.product.categoryOption(name));
    await this.waitForVisible(this.product.clearCategory(name), 10_000, `Clear ${name}`);
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  async clearCategory(name: string): Promise<number> {
    await this.tap(this.product.clearCategory(name));
    await this.waitForVisible(this.product.categoryChip, 10_000, 'Category chip');
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }
}

export const productsPage = new ProductListPage({
  title: 'Products',
  searchHint: PRODUCT_TEXTS.searchHint,
  statuses: PRODUCT_STATUSES,
  noResults: PRODUCT_TEXTS.noResults,
  noResultsHint: PRODUCT_TEXTS.noResultsHint,
  newButton: 'New product',
  minRowTexts: 3,
});

const status = by.descStartsWith('Status: ');                 // "Status: Active. Change status"

class ProductDetailPage extends SalesDetailPage {
  readonly product = {
    statusButton: status,
    name: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/preceding-sibling::android.view.View[1]`,
    sku: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/preceding-sibling::android.widget.TextView[1]`,
    price: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/following-sibling::android.widget.TextView[1]`,
    tab: (name: ProductTab) => (name === 'Stock' ? by.descStartsWith('Stock') : by.a11y(name)),   // "Stock, 2"
    figure: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/preceding-sibling::android.widget.TextView[1]`,   // 5 / On hand
    reorderWarning: by.textStartsWith('Stock is at or below the reorder level'),
    field: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    section: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
    sectionCount: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[1]`,
    adjustStock: '//android.widget.Button[@content-desc="Adjust stock"]',   // never tapped
    // Stock tab: "Central Warehouse 10, 5"; Activity tab: "QA-TEST-R9 Warehouse, -4, GRN-0005, 12 Oct, Outbound"
    // (below STOCK MOVEMENTS a log follows: "Stock +4 (GRN-0005), 12 Oct, Yash"; callers filter by format).
    described: '//android.widget.TextView[string-length(@content-desc) > 0]',
    purchaseOrders: by.descStartsWith('PO-'),                // "PO-0005, ₹2,242.69, Qty 10, 12 Oct, Partially Received"
    noVariants: by.text(PRODUCT_TEXTS.noVariants),
    statusTitle: '//android.view.View[@text="Status"]',
    statusOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
  };

  async openTab(name: ProductTab): Promise<void> {
    await this.scrollTo(this.product.tab(name));
    await this.tap(this.product.tab(name));
    await driver.pause(1_500);
  }

  async figure(label: 'On hand' | 'Reserved' | 'Available' | 'Committed'): Promise<number> {
    return Number((await this.text(this.product.figure(label))).replace(/[^0-9-]/g, ''));
  }

  async field(label: string): Promise<string> {
    await this.scrollTo(this.product.field(label));
    return this.text(this.product.field(label));
  }

  /** Content-desc rows on the open tab, scrolling down until no new ones appear. */
  async describedRows(max = 8): Promise<string[]> {
    const seen: string[] = [];
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < max; i++) {
      let added = 0;
      for (const el of await $$(this.product.described)) {
        const d = (await el.getAttribute('content-desc')) ?? '';
        if (d && !seen.includes(d)) { seen.push(d); added++; }
      }
      if (!added && i > 0) break;
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.45, width: width * 0.8, height: height * 0.35, direction: 'down', percent: 0.7 });
    }
    return seen;
  }

  /** Opens the status picker, reads each status and the selected one, closes it. */
  async statusOptions(): Promise<{ label: string; selected: boolean }[]> {
    await this.scrollTo(this.product.statusButton);
    await this.tap(this.product.statusButton);
    await this.waitForVisible(this.product.statusTitle, 10_000, 'Status');
    const out: { label: string; selected: boolean }[] = [];
    for (const s of PRODUCT_STATUSES) {
      const el = await $$(this.product.statusOption(s));
      if (el.length) out.push({ label: s, selected: (await el[0]!.getAttribute('selected')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.product.statusTitle, 5_000, 'Status');
    return out;
  }

  /** Scrolls up to the top of the detail. */
  async toTop(): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 3; i++) await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.25, width: width * 0.8, height: height * 0.5, direction: 'up', percent: 1 });
  }
}

export const productDetailPage = new ProductDetailPage({
  title: 'Product',
  summary: 'Product summary',
  numberPrefixes: ['PRD-'],
  menuTitle: 'Product actions',
});

const formSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),                                   // never tapped
  name: by.a11y('Product name'),
  sku: by.a11y('SKU'),
  brand: by.a11y('Brand'),
  barcode: by.a11y('Barcode'),
  barcodeHint: by.text(PRODUCT_TEXTS.barcodeHint),
  scanBarcode: '//android.widget.Button[@content-desc="Scan barcode"]',   // never tapped
  category: by.descStartsWith('Category: '),              // "Category: No category"
  price: by.a11y('Price'),
  costPrice: by.a11y('Cost price'),
  taxRate: by.a11y('Tax rate %'),
  openingStock: by.a11y('Opening stock'),
  warehouse: by.descStartsWith('Warehouse: '),            // "Warehouse: No warehouse"
  supplier: by.descStartsWith('Supplier: '),              // "Supplier: No supplier"
  assignedTo: by.descStartsWith('Assigned to: '),         // "Assigned to: Me"
  weightUnit: by.a11y('Weight unit'),                     // "kg"
  unitOfMeasurement: by.a11y('Unit of measurement'),      // "Units"
  section: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
  sheetTitle: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
  sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  discardTitle: by.text(PRODUCT_TEXTS.discardTitle),
  discardMessage: by.text(PRODUCT_TEXTS.discardMessage),
  discard: by.a11y('Discard'),
};

class NewProductPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="New product"]';
  readonly selectors = formSelectors;

  /** Scrolls the form with UiAutomator's own UiScrollable until the match is on screen and returns it.
   *  `ui` is a UiSelector call such as `description("Weight unit")` or `text("PHYSICAL")`. Swipe gestures
   *  scroll this long form erratically (runs 20261117-130216, -130909, -131420). */
  async intoView(ui: string): Promise<WebdriverIO.Element> {
    return $(`android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).setMaxSearchSwipes(25).scrollIntoView(new UiSelector().${ui})`).getElement();
  }

  /** Brings a match fully on screen: UiScrollable can stop with it clipped at the bottom edge, where its text
   *  reads empty; a short nudge up the page then shows it whole. */
  private async fullyInView(ui: string, plain: string): Promise<void> {
    await this.intoView(ui);
    if (await $(plain).isDisplayed().catch(() => false)) {
      const { y, height: h } = { ...(await $(plain).getLocation()), ...(await $(plain).getSize()) };
      if (y + h < (await driver.getWindowSize()).height * 0.85) return;
    }
    const { width, height } = await driver.getWindowSize();
    await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction: 'down', percent: 0.4 });
    await driver.pause(500);
  }

  /** Text of an input by its label (content-desc), e.g. "Weight unit" -> "kg". */
  async inputText(label: string): Promise<string> {
    await this.fullyInView(`description(${JSON.stringify(label)})`, by.a11y(label));
    return $(by.a11y(label)).getText().catch(() => '');
  }

  /** Content-desc of a picker field by its prefix, e.g. "Warehouse: " -> "Warehouse: No warehouse". */
  async pickerText(prefix: string): Promise<string> {
    await this.fullyInView(`descriptionStartsWith(${JSON.stringify(prefix)})`, by.descStartsWith(prefix));
    return ((await $(by.descStartsWith(prefix)).getAttribute('content-desc').catch(() => '')) ?? '');
  }

  /** Whether a text (a section heading or hint) can be scrolled into view. */
  async hasText(text: string): Promise<boolean> {
    return (await this.intoView(`text(${JSON.stringify(text)})`)).isExisting().catch(() => false);
  }

  async desc(selector: string): Promise<string> {
    await this.scrollTo(selector);
    return (await $(selector).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  async value(selector: string): Promise<string> {
    await this.scrollTo(selector);
    return $(selector).getText().catch(() => '');
  }

  /** Scrolls down, then up, until the element is on screen. Keyboard must be closed: a swipe types on it. */
  async scrollTo(selector: string, until: 'displayed' | 'exists' = 'displayed'): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    const found = () => (until === 'exists' ? $(selector).isExisting() : $(selector).isDisplayed()).catch(() => false);
    for (const direction of ['down', 'up'] as const) {
      for (let i = 0; i < 8 && !(await found()); i++) {
        await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.45, direction, percent: 0.6 });
      }
    }
  }

  async typeInto(selector: string, value: string): Promise<void> {
    await this.scrollTo(selector);
    const el = $(selector);
    await el.click();
    await el.setValue(value);
    await this.hideKeyboard();
  }

  /** Opens a picker field, returns the option labels on its first screen, closes it. */
  async pickerOptions(field: string, title: string): Promise<string[]> {
    await this.scrollTo(field);
    await this.tap(field);
    await this.waitForVisible(this.selectors.sheetTitle(title), 10_000, title);
    const out: string[] = [];
    for (const el of await $$('//android.widget.Button')) {
      const d = (await el.getAttribute('content-desc')) ?? '';
      if (d && d !== 'Close' && d !== 'Cancel' && d !== 'Save' && !d.includes(': ')) out.push(d);
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle(title), 5_000, title);
    return out;
  }

  /** Cancel; reads the discard dialog; Discard. */
  async discard(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, PRODUCT_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.discard);
    return seen;
  }
}

export const newProductPage = new NewProductPage();
