// More > INVENTORY > Stock Receipts: the list (search by receipt number), a receipt's detail (summary, items, total,
// notes, the purchase order it was received against), its actions menu and the New stock receipt form with its line
// sheet. Live app on the phone, 2026-11-20.
//
// Read only: Create, Reverse stock, Delete and the PDF actions are never tapped; the new-receipt form is discarded.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage, money, type SalesAction } from './SalesDocumentPages.js';
import { screenTexts } from './PurchaseOrdersPage.js';

export interface ReceiptRow { supplier: string; date: string; number: string; warehouse: string; status: string; label: string }
export interface ReceiptLine { name: string; quantity: number; cost: number; total: number }

export const RECEIPT_ACTIONS = ['Reverse stock', 'View PDF', 'Save PDF', 'Delete'] as const;

export const RECEIPT_TEXTS = {
  searchHint: 'Search receipt number',
  noReceipts: 'No stock receipts found',
  noReceiptsHint: 'Try another search or status.',
  newButton: 'New stock receipt',
  formInfo: 'The stock goes into the warehouse when you save.',
  noSupplier: 'Supplier: Choose a supplier',
  noWarehouse: 'Warehouse: Choose a warehouse',
  discardTitle: 'Discard this receipt?',
  discardMessage: 'This receipt is not saved yet.',
};

const xq = (s: string) => JSON.stringify(s);
const QTY = /^([0-9.]+) x (₹[0-9,.]+)$/;

class ReceiptListPage extends SalesListPage {
  /** Rows: supplier, date, "GRN-n, warehouse" and status. */
  async rows(): Promise<ReceiptRow[]> {
    const out: ReceiptRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push(await t.getText());
      if (texts.length < 4) continue;
      const [supplier, date, where, status] = texts as [string, string, string, string];
      const [number, ...warehouse] = where.split(', ');
      out.push({ supplier, date, number: number!, warehouse: warehouse.join(', '), status, label });
    }
    return out;
  }

  async endOfListText(): Promise<string> {
    return $(by.textStartsWith('End of list')).getText().catch(() => '');
  }
}

export const stockReceiptsPage = new ReceiptListPage({
  title: 'Stock receipts',
  searchHint: RECEIPT_TEXTS.searchHint,
  statuses: [],
  noResults: RECEIPT_TEXTS.noReceipts,
  noResultsHint: RECEIPT_TEXTS.noReceiptsHint,
  newButton: RECEIPT_TEXTS.newButton,
  minRowTexts: 4,
});
// The More entry is "Stock Receipts"; the screen title is "Stock receipts".
Object.assign(stockReceiptsPage.selectors, { moreEntry: by.a11y('Stock Receipts') });

class StockReceiptDetailPage extends SalesDetailPage {
  readonly receipt = {
    field: (label: string) => by.descStartsWith(`${label}, `),        // "Warehouse, Central Warehouse 10"
    itemCount: '//android.view.View[@text="ITEMS"]/following-sibling::android.widget.TextView[1]',
    notes: '//android.view.View[@text="NOTES"]/following::android.widget.TextView[1]',
    footerHint: by.text('Reverse the stock, then delete it.'),
    deleteButton: '(//android.widget.Button[@content-desc="Delete"])[last()]',
    reverseButton: '(//android.widget.Button[@content-desc="Reverse stock"])[last()]',
  };

  async field(label: string): Promise<string> {
    const d = (await $(this.receipt.field(label)).getAttribute('content-desc').catch(() => '')) ?? '';
    return d.slice(label.length + 2);
  }

  /** Items and Total from the texts between ITEMS and Total. A line's total sits before or after its "n x ₹price"
   *  depending on how many lines the product name takes. */
  async items(): Promise<{ lines: ReceiptLine[]; total: number }> {
    const texts = await screenTexts();                 // TextViews only ("ITEMS" is a View)
    const end = texts.indexOf('Total');
    const block = texts.slice(0, end);
    const lines: ReceiptLine[] = [];
    for (let i = 0; i < block.length; i++) {
      const m = QTY.exec(block[i]!);
      if (!m) continue;
      const after = block[i + 1] && /^₹/.test(block[i + 1]!) && !QTY.test(block[i + 1]!);
      const totalText = after ? block[i + 1]! : block[i - 1]!;
      const name = after ? block[i - 1]! : block[i - 2]!;
      lines.push({ name, quantity: Number(m[1]), cost: money(m[2]!), total: money(totalText) });
    }
    return { lines, total: money(texts[end + 1] ?? '') };
  }

  async buttonEnabled(selector: string): Promise<boolean> {
    return (await $(selector).getAttribute('enabled')) === 'true';
  }

  async menu(): Promise<SalesAction[]> {
    return this.actionOptions(RECEIPT_ACTIONS);
  }
}

export const stockReceiptDetailPage = new StockReceiptDetailPage({
  title: 'Stock receipt',
  summary: 'Stock receipt summary',
  numberPrefixes: ['GRN-'],
  menuTitle: 'Stock receipt actions',
});

export interface ReceiptForm { info: boolean; supplier: string; warehouse: string; date: string; lines: number; notes: string; create: boolean }

class NewStockReceiptPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="New stock receipt"]';
  readonly selectors = {
    cancel: '(//android.widget.Button[@content-desc="Cancel"])[1]',
    create: by.a11y('Create'),                                       // never tapped
    info: by.text(RECEIPT_TEXTS.formInfo),
    supplier: by.descStartsWith('Supplier: '),
    warehouse: by.descStartsWith('Warehouse: '),
    date: by.descStartsWith('Received date: '),
    notes: '//android.widget.EditText[@content-desc="Notes"]',
    addProduct: by.a11y('Add product'),
    lineRows: '//android.widget.Button[contains(@content-desc, " x ₹")]',
    linesTotal: '//android.widget.TextView[@text="Lines total"]/following-sibling::android.widget.TextView[1]',
    pickerTitle: (title: string) => `//android.view.View[@text=${xq(title)}]`,
    pickerSearch: by.a11y('Search products'),
    option: (start: string) => `(//android.widget.Button[starts-with(@content-desc, ${xq(start)})])[last()]`,
    lineTitle: by.text('New line'),
    input: (label: string) => `//android.widget.EditText[@content-desc=${xq(label)}]`,
    lineProduct: by.descStartsWith('Product: '),
    addLine: by.a11y('Add line'),
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
    discardTitle: by.text(RECEIPT_TEXTS.discardTitle),
    discardMessage: by.text(RECEIPT_TEXTS.discardMessage),
    dialogCancel: '//android.widget.Button[@content-desc="Cancel" and following-sibling::android.widget.Button[@content-desc="Discard"]]',
    discard: by.a11y('Discard'),
  };

  private async desc(selector: string): Promise<string> {
    return (await $(selector).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  async read(): Promise<ReceiptForm> {
    const s = this.selectors;
    return { info: await $(s.info).isExisting(), supplier: await this.desc(s.supplier), warehouse: await this.desc(s.warehouse),
      date: await this.desc(s.date), lines: (await $$(s.lineRows)).length, notes: await $(s.notes).getText().catch(() => ''), create: await $(s.create).isExisting() };
  }

  /** Opens the Supplier or Warehouse picker, returns its options (names only: supplier rows can carry an e-mail) and closes it. */
  async pickerOptions(field: 'Supplier' | 'Warehouse'): Promise<string[]> {
    await this.tap(field === 'Supplier' ? this.selectors.supplier : this.selectors.warehouse);
    await this.waitForVisible(this.selectors.pickerTitle(field), 10_000, field);
    await driver.pause(1_500);
    const out: string[] = [];
    for (const el of await $$('//android.widget.Button')) {
      const d = (await el.getAttribute('content-desc')) ?? '';
      if (!d || d === 'Close') continue;
      out.push(field === 'Supplier' ? d.split(', ').filter((p) => !p.includes('@')).join(', ') : d);
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.pickerTitle(field), 5_000, field);
    return out;
  }

  /** Add product > search > choose: opens the New line sheet. */
  async chooseProduct(search: string, start: string): Promise<void> {
    const s = this.selectors;
    await this.tap(s.addProduct);
    await this.waitForVisible(s.pickerTitle('Choose a product'), 10_000, 'Choose a product');
    const field = $(s.pickerSearch);
    await field.click();
    await field.setValue(search);
    // No hideKeyboard: its BACK closes the picker sheet. The option sits above the keyboard.
    await $(s.option(start)).waitForDisplayed({ timeout: 60_000, timeoutMsg: `"${start}" not offered` });
    await $(s.option(start)).click();
    await this.waitForVisible(s.lineTitle, 10_000, 'New line');
  }

  async readLine(): Promise<{ product: string; name: string; qty: string; cost: string }> {
    const s = this.selectors;
    const txt = (sel: string) => $(sel).getText().catch(() => '');
    return { product: await this.desc(s.lineProduct), name: await txt(s.input('Name')), qty: await txt(s.input('Qty')), cost: await txt(s.input('Unit cost')) };
  }

  async setQuantity(qty: string): Promise<void> {
    const el = $(this.selectors.input('Qty'));
    await el.click();
    await el.setValue(qty);
    // The keyboard's Done closes it; hideKeyboard (BACK) would close the whole New line sheet.
    await driver.execute('mobile: performEditorAction', { action: 'done' });
    await driver.pause(500);
  }

  async addLine(): Promise<void> {
    await this.tap(this.selectors.addLine);
    await this.waitForGone(this.selectors.lineTitle, 10_000, 'New line');
  }

  async lineRows(): Promise<{ rows: string[]; total: string }> {
    const rows: string[] = [];
    for (const el of await $$(this.selectors.lineRows)) rows.push((await el.getAttribute('content-desc')) ?? '');
    return { rows, total: await $(this.selectors.linesTotal).getText().catch(() => '') };
  }

  async cancel(): Promise<boolean> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await driver.pause(1_500);
    return $(this.selectors.discardTitle).isExisting();
  }

  async cancelThenKeep(): Promise<{ message: boolean }> {
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, RECEIPT_TEXTS.discardTitle);
    const message = await $(this.selectors.discardMessage).isExisting();
    await this.tap(this.selectors.dialogCancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, RECEIPT_TEXTS.discardTitle);
    return { message };
  }

  async discard(): Promise<{ message: boolean }> {
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, RECEIPT_TEXTS.discardTitle);
    const message = await $(this.selectors.discardMessage).isExisting();
    await this.tap(this.selectors.discard);
    await this.waitForGone(this.marker, 10_000, 'New stock receipt');
    return { message };
  }
}

export const newStockReceiptPage = new NewStockReceiptPage();
