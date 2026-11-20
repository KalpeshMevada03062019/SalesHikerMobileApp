// More > INVENTORY > Warehouses: the list (All / Active / Inactive chips, search by name, code or city), a warehouse's
// detail (stock figures, Summary, Stock, Movements and Activity tabs), its actions menu, the Adjust stock sheet and the
// New / Edit warehouse forms. Live app on the phone, 2026-11-18.
//
// Read only: Save, Adjust stock Save, Delete and the PDF actions are never tapped. Forms and sheets are closed unchanged
// or discarded.
import { BasePage, by } from './BasePage.js';
import { SalesListPage } from './SalesDocumentPages.js';

export interface WarehouseRow { name: string; code: string; location: string; label: string }
export interface StockRow { product: string; qty: number; label: string }
export interface Movement { product: string; qty: number; detail: string; direction: string; label: string }
export interface WarehouseAction { label: string; enabled: boolean }

export const WAREHOUSE_STATUSES = ['Active', 'Inactive'] as const;
export const WAREHOUSE_ACTIONS = ['Edit', 'Adjust stock', 'View PDF', 'Save PDF', 'Delete'] as const;
export const WAREHOUSE_TABS = ['Summary', 'Stock', 'Movements', 'Activity'] as const;
export const ADJUST_TYPES = ['Inbound (+)', 'Outbound (-)', 'Adjustment'] as const;

export const WAREHOUSE_TEXTS = {
  searchHint: 'Search warehouses',
  noWarehouses: 'No warehouses found',
  noWarehousesHint: 'Try another search or status.',
  newButton: 'New warehouse',
  noProducts: 'No products match.',
  nameHint: 'Main store',
  codeHint: 'WH-001',
  referenceHint: 'For example PO-123',
  discardTitle: 'Discard this warehouse?',
  discardMessage: 'This warehouse is not saved yet.',
};

const xq = (s: string) => JSON.stringify(s);
const unescape = (t: string) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const top = (bounds: string) => Number((/^\[\d+,(\d+)\]/.exec(bounds) ?? [])[1] ?? NaN);

async function scrollDown(percent = 0.6): Promise<void> {
  const { width, height } = await driver.getWindowSize();
  await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.4, width: width * 0.8, height: height * 0.4, direction: 'down', percent });
}

/** content-desc of every element on screen, in document order (one page-source round trip). */
async function screenDescs(): Promise<string[]> {
  const src = await driver.getPageSource();
  // A value holding double quotes is written in single quotes (content-desc='Warehouse "X" created, ...').
  return [...src.matchAll(/\scontent-desc=(?:"([^"]*)"|'([^']*)')/g)].map((m) => unescape(m[1] ?? m[2]!)).filter(Boolean);
}

class WarehouseListPage extends SalesListPage {
  /** Rows on screen: name, code and location (the code sits beside the name, the location under it). */
  async rows(): Promise<WarehouseRow[]> {
    const out: WarehouseRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const texts: { text: string; top: number }[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push({ text: await t.getText(), top: top((await t.getAttribute('bounds')) ?? '') });
      if (!texts.length) continue;
      const [name, ...rest] = texts;
      const code = rest.find((t) => Math.abs(t.top - name!.top) < 20)?.text ?? '';
      const location = rest.find((t) => t.top - name!.top >= 20)?.text ?? '';
      out.push({ name: name!.text, code, location, label });
    }
    return out;
  }

  async endOfListText(): Promise<string> {
    return $(by.textStartsWith('End of list')).getText().catch(() => '');
  }
}

export const warehousesPage = new WarehouseListPage({
  title: 'Warehouses',
  searchHint: WAREHOUSE_TEXTS.searchHint,
  statuses: WAREHOUSE_STATUSES,
  noResults: WAREHOUSE_TEXTS.noWarehouses,
  noResultsHint: WAREHOUSE_TEXTS.noWarehousesHint,
  newButton: WAREHOUSE_TEXTS.newButton,
  minRowTexts: 1,
});
// Rows hold 1 to 3 texts: leave out the status chips (top 260) and the empty state's Clear filters.
Object.assign(warehousesPage.selectors, {
  rows: '//android.widget.Button[count(.//android.widget.TextView) >= 1 and not(contains(@bounds, ",260]")) and @content-desc != "Clear filters"]',
});

const detailSelectors = {
  back: by.descClass('Back', 'android.widget.Button'),
  name: '//android.view.ViewGroup[@content-desc="Warehouse summary"]/following-sibling::android.view.View[1]',
  // Header texts (siblings of the empty summary group): status, then the code when there is one.
  status: '(//android.widget.TextView[@text="Active" or @text="Inactive"])[1]',
  code: '//android.view.ViewGroup[@content-desc="Warehouse summary"]/following-sibling::android.view.View[1]/following-sibling::android.widget.TextView[1][not(@text="Active" or @text="Inactive") and translate(@text, "0123456789", "") != ""]',
  stat: (label: string) => `//android.widget.TextView[@text=${xq(label)}]/preceding-sibling::android.widget.TextView[1]`,
  tab: (name: string) => `(//android.widget.Button[@content-desc=${xq(name)} or starts-with(@content-desc, ${xq(`${name}, `)})])[1]`,
  field: (label: string) => `//android.widget.TextView[@text=${xq(label)}]/following-sibling::android.widget.TextView[1]`,
  stockCount: '//android.view.View[@text="STOCK"]/following-sibling::android.widget.TextView[1]',
  stockSearch: by.a11y('Search products'),
  lowStockChip: '//android.widget.Button[@content-desc="Low stock"]',
  noProducts: by.text(WAREHOUSE_TEXTS.noProducts),
  endOfList: by.textStartsWith('End of list'),
  activityCount: '//android.view.View[@text="ACTIVITY"]/following-sibling::android.widget.TextView[1]',
  actions: by.a11y('More actions'),
  menuTitle: by.text('Warehouse actions'),
  action: (name: string) => `//android.widget.Button[@content-desc=${xq(name)} or starts-with(@content-desc, ${xq(`${name}, `)})]`,
  sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
};

class WarehouseDetailPage extends BasePage {
  protected readonly marker = by.a11y('Warehouse summary');
  readonly selectors = detailSelectors;

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  /** Header figure: "In stock", "Units on hand" or "Low stock". */
  async stat(label: 'In stock' | 'Units on hand' | 'Low stock'): Promise<number> {
    return Number((await this.text(this.selectors.stat(label))).replace(/[^\d-]/g, ''));
  }

  async field(label: string): Promise<string> {
    return this.text(this.selectors.field(label));
  }

  /** Tab labels in order ("Stock, 4" when it has rows). */
  async tabLabels(): Promise<string[]> {
    const out: string[] = [];
    for (const t of WAREHOUSE_TABS) out.push((await $(this.selectors.tab(t)).getAttribute('content-desc').catch(() => '')) ?? '');
    return out;
  }

  /** Scrolls back to the top (the tabs scroll away with a long list), then taps the tab. */
  async openTab(name: typeof WAREHOUSE_TABS[number]): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 8 && !(await $(this.selectors.tab(name)).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction: 'up', percent: 0.8 });
    }
    await this.tap(this.selectors.tab(name));
    await driver.pause(1_500);
  }

  /** Scrolls a tab's list to its end, calling `read` after each scroll (lists render only what is on screen). */
  private async collect<T>(read: (descs: string[]) => T[], key: (item: T) => string): Promise<T[]> {
    const seen = new Map<string, T>();
    for (let i = 0; i < 12; i++) {
      for (const item of read(await screenDescs())) if (!seen.has(key(item))) seen.set(key(item), item);
      if (await $(this.selectors.endOfList).isDisplayed().catch(() => false)) break;
      await scrollDown();
    }
    return [...seen.values()];
  }

  /** Stock tab rows: each product (named by its "Adjust stock of <product>" button) and its quantity. */
  async stockRows(): Promise<StockRow[]> {
    await $(this.selectors.stockCount).waitForDisplayed({ timeout: 15_000 });
    // The rows load after the STOCK header: wait for the first row (or the empty message) before scrolling.
    await driver.waitUntil(async () => (await $$(by.descStartsWith('Adjust stock of ')).length) > 0 || $(this.selectors.noProducts).isExisting(),
      { timeout: 20_000, timeoutMsg: 'Stock rows not loaded' });
    // A row's label and its Adjust button are not always on screen together while scrolling: collect both kinds,
    // then pair each product with the row label that starts with its name.
    const items = await this.collect((descs) => descs.filter((x) => x.startsWith('Adjust stock of ') || /, -?[0-9]+$/.test(x)), (x) => x);
    const products = items.filter((x) => x.startsWith('Adjust stock of ')).map((x) => x.slice('Adjust stock of '.length));
    const labels = items.filter((x) => !x.startsWith('Adjust stock of ') && !/^(Stock|Movements|Activity|Summary), /.test(x));
    const out: StockRow[] = [];
    for (const product of products) {
      const label = labels.find((x) => x.startsWith(`${product}, `));
      if (label) out.push({ product, qty: Number(label.slice(label.lastIndexOf(', ') + 2)), label });
    }
    return out;
  }

  /** Movements tab: "<product>, +4, GRN-0005, Stock receipt, 12 Oct, Inbound". Rows are unique by their full text. */
  async movements(): Promise<Movement[]> {
    await $(by.text('MOVEMENTS')).waitForDisplayed({ timeout: 15_000 });
    await $(by.descMatches('.*, (Inbound|Outbound|Adjustment)')).waitForExist({ timeout: 20_000 }).catch(() => undefined);
    const parse = (label: string): Movement | undefined => {
      const m = /^(.*), ([+-][0-9]+), (.*), (Inbound|Outbound|Adjustment)$/.exec(label);
      return m ? { product: m[1]!, qty: Number(m[2]), detail: m[3]!, direction: m[4]!, label } : undefined;
    };
    return this.collect((descs) => descs.map(parse).filter((x): x is Movement => !!x), (r) => r.label);
  }

  /** Activity tab entries ("Warehouse "X" created, 12 Oct, Yash") and the ACTIVITY count. */
  async activity(): Promise<{ count: number; entries: string[] }> {
    await $(this.selectors.activityCount).waitForDisplayed({ timeout: 15_000 });
    // The entries load after the ACTIVITY header.
    await driver.waitUntil(async () => (await $$(by.descStartsWith('Warehouse "')).length) > 0, { timeout: 20_000 }).catch(() => undefined);
    const entries = (await screenDescs()).filter((d) => /^Warehouse ".*"/.test(d));
    return { count: Number(await this.text(this.selectors.activityCount)), entries };
  }

  /** Taps the Low stock chip of the Stock tab; returns the rows it lists (0 shows "No products match."). */
  async lowStockRows(): Promise<{ count: number; empty: boolean }> {
    await this.tap(this.selectors.lowStockChip);
    await driver.pause(2_000);
    const result = { count: Number(await this.text(this.selectors.stockCount)), empty: await $(this.selectors.noProducts).isExisting() };
    await this.tap(this.selectors.lowStockChip);
    await driver.pause(1_500);
    return result;
  }

  /** Opens the actions menu, reads each option (label with its reason, enabled) and closes it without choosing. */
  async actionOptions(): Promise<WarehouseAction[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Warehouse actions');
    const out: WarehouseAction[] = [];
    for (const a of WAREHOUSE_ACTIONS) {
      const el = await $$(this.selectors.action(a));
      if (el.length) out.push({ label: (await el[0]!.getAttribute('content-desc')) ?? a, enabled: (await el[0]!.getAttribute('enabled')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Warehouse actions');
    return out;
  }

  /** More actions > Edit or Adjust stock. */
  async openAction(name: 'Edit' | 'Adjust stock'): Promise<void> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Warehouse actions');
    await this.tap(this.selectors.action(name));
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const warehouseDetailPage = new WarehouseDetailPage();

export interface AdjustSheet { product: string; stockNow: string; warehouse: string; types: Record<string, boolean>; quantity: string; reference: string; save: boolean }

class AdjustStockPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Adjust stock"]';
  readonly selectors = {
    pickerTitle: by.text('Choose a product'),
    pickerSearch: by.a11y('Search products'),
    option: (start: string) => `(//android.widget.Button[starts-with(@content-desc, ${xq(start)})])[last()]`,
    product: '//android.view.View[@text="Adjust stock"]/following-sibling::android.widget.TextView[1]',
    stockNow: by.textMatches('.* in stock now at .*'),
    warehouse: by.descStartsWith('Warehouse: '),
    type: (name: string) => `//android.widget.RadioButton[@content-desc=${xq(name)}]`,
    quantity: '//android.widget.EditText[@content-desc="Quantity"]',
    reference: '//android.widget.EditText[@content-desc="Reference"]',
    save: '//android.widget.Button[@content-desc="Save"]',            // never tapped
    close: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  /** In the product picker opened by the menu's Adjust stock: search and choose a product. */
  async chooseProduct(search: string, start: string): Promise<void> {
    await this.waitForVisible(this.selectors.pickerTitle, 10_000, 'Choose a product');
    const field = $(this.selectors.pickerSearch);
    await field.click();
    await field.setValue(search);
    // No hideKeyboard: its BACK closes the picker sheet. The option sits above the keyboard.
    await $(this.selectors.option(start)).waitForDisplayed({ timeout: 60_000, timeoutMsg: `"${start}" not offered` });
    await $(this.selectors.option(start)).click();
    await this.waitForDisplayed(10_000);
  }

  async read(): Promise<AdjustSheet> {
    const s = this.selectors;
    const txt = (sel: string) => $(sel).getText().catch(() => '');
    const types: Record<string, boolean> = {};
    for (const t of ADJUST_TYPES) types[t] = (await $(s.type(t)).getAttribute('checked').catch(() => '')) === 'true';
    return { product: await txt(s.product), stockNow: await txt(s.stockNow), warehouse: (await $(s.warehouse).getAttribute('content-desc').catch(() => '')) ?? '',
      types, quantity: await txt(s.quantity), reference: await txt(s.reference), save: await $(s.save).isExisting() };
  }

  /** Close on the unchanged sheet. */
  async close(): Promise<void> {
    await this.tap(this.selectors.close);
    await this.waitForGone(this.marker, 10_000, 'Adjust stock');
  }
}

export const adjustStockPage = new AdjustStockPage();

export interface WarehouseForm { name: string; code: string; owner: string; active: boolean; street: string; city: string; state: string; country: string; save: boolean }

class WarehouseFormPage extends BasePage {
  protected readonly marker: string;
  readonly selectors = {
    cancel: '(//android.widget.Button[@content-desc="Cancel"])[1]',
    save: by.a11y('Save'),                                            // never tapped
    input: (label: string) => `//android.widget.EditText[@content-desc=${xq(label)}]`,
    owner: by.descStartsWith('Assigned to: '),
    active: '//android.widget.Switch[@content-desc="Active"]',
    discardTitle: by.text(WAREHOUSE_TEXTS.discardTitle),
    discardMessage: by.text(WAREHOUSE_TEXTS.discardMessage),
    dialogCancel: '//android.widget.Button[@content-desc="Cancel" and following-sibling::android.widget.Button[@content-desc="Discard"]]',
    discard: by.a11y('Discard'),
  };

  constructor(readonly title: string) {
    super();
    this.marker = `//android.view.View[@text=${xq(title)}]`;
  }

  /** The fields as shown (an empty field shows its hint, e.g. "Main store"). */
  async read(): Promise<WarehouseForm> {
    const s = this.selectors;
    const txt = (label: string) => $(s.input(label)).getText().catch(() => '');
    return {
      name: await txt('Warehouse name'), code: await txt('Code'), owner: (await $(s.owner).getAttribute('content-desc').catch(() => '')) ?? '',
      active: (await $(s.active).getAttribute('checked').catch(() => '')) === 'true',
      street: await txt('Street address'), city: await txt('City'), state: await txt('State'), country: await txt('Country'),
      save: await $(s.save).isExisting(),
    };
  }

  async setName(value: string): Promise<void> {
    const el = $(this.selectors.input('Warehouse name'));
    await el.click();
    await el.setValue(value);
    await this.hideKeyboard();
  }

  /** Cancel; returns whether the discard dialog appeared (an unchanged form closes without one). */
  async cancel(): Promise<boolean> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await driver.pause(1_500);
    return $(this.selectors.discardTitle).isExisting();
  }

  async cancelThenKeep(): Promise<{ message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, WAREHOUSE_TEXTS.discardTitle);
    const message = await $(this.selectors.discardMessage).isExisting();
    await this.tap(this.selectors.dialogCancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, WAREHOUSE_TEXTS.discardTitle);
    return { message };
  }

  async discard(): Promise<{ message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, WAREHOUSE_TEXTS.discardTitle);
    const message = await $(this.selectors.discardMessage).isExisting();
    await this.tap(this.selectors.discard);
    await this.waitForGone(this.marker, 10_000, this.title);
    return { message };
  }
}

export const newWarehousePage = new WarehouseFormPage('New warehouse');
export const editWarehousePage = new WarehouseFormPage('Edit warehouse');
