// More > INVENTORY > Purchase Orders: the list (status chips, search), a purchase order's detail (summary,
// ITEMS with received quantities, totals, receipts, tasks, notes), its actions menu, the Receive stock sheet and
// the New purchase order form with its line sheet. Live app on the phone, 2026-11-18.
//
// Read only: Save, Receive, Edit and every menu action are never tapped. The new-order form is filled and
// discarded; the Receive stock sheet is opened and cancelled unchanged.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage, money, type SalesRow, type SalesAction } from './SalesDocumentPages.js';

export type PurchaseOrderRow = SalesRow;
export interface PurchaseLine { name: string; quantity: number; cost: number; total: number; received: string }

export const PURCHASE_ORDER_STATUSES = ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'] as const;
export const PURCHASE_ORDER_ACTIONS = ['Edit', 'Receive stock', 'View PDF', 'Save PDF', 'Add task', 'Notes', 'Delete'] as const;

export const PURCHASE_ORDER_TEXTS = {
  searchHint: 'Search PO number or supplier',
  noOrders: 'No purchase orders found',
  noOrdersHint: 'Try another search or status.',
  newButton: 'New purchase order',
  cannotEdit: 'A received order cannot be edited.',
  deleteReason: 'Reverse the receipts, then delete it.',
  noStock: 'No stock received yet. Use Receive stock to add the goods to a warehouse.',
  receiveIntro: 'Enter the quantity received for each line. Saving creates a stock receipt and adds the goods to the warehouse.',
  discardTitle: 'Discard this order?',
  discardMessage: 'This order is not saved yet.',
  noSupplier: 'Supplier: Choose a supplier',
  noPriceBook: 'Price book: No price book',
  noWarehouse: 'Warehouse: Choose a warehouse',
  noDelivery: 'Expected delivery: No date',
};

const xq = (s: string) => JSON.stringify(s);
const SCROLL_TIMEOUT = 60_000;

/** Every TextView text on screen in document order, from the page source (one round trip). */
export async function screenTexts(): Promise<string[]> {
  const src = await driver.getPageSource();
  const out: string[] = [];
  const unescape = (t: string) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // A value holding double quotes is written in single quotes (text='"Zastolnye" Dumplings ...').
  for (const m of src.matchAll(/<android\.widget\.TextView\b[^>]*?\stext=(?:"([^"]*)"|'([^']*)')/g)) out.push(unescape(m[1] ?? m[2]!));
  return out;
}

async function scrollDown(times = 1): Promise<void> {
  const { width, height } = await driver.getWindowSize();
  for (let i = 0; i < times; i++) {
    await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.45, direction: 'down', percent: 0.7 });
  }
}

export const purchaseOrdersPage = new SalesListPage({
  title: 'Purchase orders',
  searchHint: PURCHASE_ORDER_TEXTS.searchHint,
  statuses: PURCHASE_ORDER_STATUSES,
  noResults: PURCHASE_ORDER_TEXTS.noOrders,
  noResultsHint: PURCHASE_ORDER_TEXTS.noOrdersHint,
  newButton: PURCHASE_ORDER_TEXTS.newButton,
});
// The More entry is "Purchase Orders" (capital O); the screen title is "Purchase orders".
Object.assign(purchaseOrdersPage.selectors, { moreEntry: by.a11y('Purchase Orders') });

class PurchaseOrderDetailPage extends SalesDetailPage {
  readonly po = {
    field: (label: string) => by.descStartsWith(`${label}, `),                 // "Vendor, QA-TEST-R9 Supplier"
    itemCount: '//android.view.View[@text="ITEMS"]/following-sibling::android.widget.TextView[1]',
    quantities: by.textMatches('[0-9.]+ x ₹[0-9,.]+'),                         // "10 x ₹100.12"
    lineName: (q: string) => `//android.widget.TextView[@text=${xq(q)}]/preceding-sibling::android.widget.TextView[1]`,
    lineTotal: (q: string) => `//android.widget.TextView[@text=${xq(q)}]/following-sibling::android.widget.TextView[1]`,
    lineReceived: (q: string) => `//android.widget.TextView[@text=${xq(q)}]/following-sibling::android.widget.TextView[2]`,
    balance: by.text('Balance'),
    receipts: by.descContains(', GRN-'),                                      // "Applied, GRN-0004, 9 Oct"
    noStock: by.text(PURCHASE_ORDER_TEXTS.noStock),
    footerHint: by.textStartsWith(PURCHASE_ORDER_TEXTS.cannotEdit),            // above Edit / Receive stock
    editButton: '(//android.widget.Button[@content-desc="Edit"])[last()]',
    receiveButton: '(//android.widget.Button[@content-desc="Receive stock"])[last()]',
  };

  async field(label: string): Promise<string> {
    const d = (await $(this.po.field(label)).getAttribute('content-desc').catch(() => '')) ?? '';
    return d.slice(label.length + 2);
  }

  /** Each item: name, quantity x unit cost, line total and "Received n of m". */
  async lines(): Promise<PurchaseLine[]> {
    const out: PurchaseLine[] = [];
    for (const el of await $$(this.po.quantities)) {
      const q = await el.getText();
      const [quantity, cost] = q.split(' x ');
      out.push({
        name: await this.text(this.po.lineName(q)), quantity: Number(quantity), cost: money(cost!),
        total: money(await this.text(this.po.lineTotal(q))), received: await this.text(this.po.lineReceived(q)),
      });
    }
    return out;
  }

  /** Scrolls to Balance and returns the totals block, label -> amount, from Items total (or Grand total) to Balance. */
  override async totals(): Promise<{ label: string; amount: number }[]> {
    for (let i = 0; i < 4 && !(await $(this.po.balance).isDisplayed().catch(() => false)); i++) await scrollDown();
    const texts = await screenTexts();
    let start = texts.indexOf('Items total');
    if (start < 0) start = texts.indexOf('Grand total');
    const out: { label: string; amount: number }[] = [];
    for (let i = start; i >= 0 && i + 1 < texts.length; i += 2) {
      out.push({ label: texts[i]!, amount: money(texts[i + 1]!) });
      if (texts[i] === 'Balance') break;
    }
    return out;
  }

  /** Receipt rows ("Applied, GRN-0004, 9 Oct") after scrolling to them; and whether "No stock received yet." shows. */
  async receipts(): Promise<{ rows: string[]; noStock: boolean }> {
    await scrollDown(2);
    const rows: string[] = [];
    for (const el of await $$(this.po.receipts)) rows.push((await el.getAttribute('content-desc')) ?? '');
    return { rows, noStock: await $(this.po.noStock).isExisting() };
  }

  async buttonEnabled(selector: string): Promise<boolean> {
    return (await $(selector).getAttribute('enabled')) === 'true';
  }

  /** Opens the actions menu, reads each option (full label with its reason, and enabled) and closes it. */
  async menu(): Promise<SalesAction[]> {
    return this.actionOptions(PURCHASE_ORDER_ACTIONS);
  }

  async openReceiveStock(): Promise<void> {
    await this.tap(this.po.receiveButton);
    await receiveStockPage.waitForDisplayed(15_000);
  }
}

export const purchaseOrderDetailPage = new PurchaseOrderDetailPage({
  title: 'Purchase order',
  summary: 'Purchase order summary',
  numberPrefixes: ['PO-'],
  menuTitle: 'Purchase order actions',
});

class ReceiveStockPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Receive stock"]';
  readonly selectors = {
    intro: by.textContains(PURCHASE_ORDER_TEXTS.receiveIntro),
    warehouse: by.descStartsWith('Warehouse: '),
    line: (product: string) => `//android.widget.EditText[@content-desc=${xq(product)}]`,
    lineInfo: by.textStartsWith('Ordered '),                                  // "Ordered 10 · received 4 · outstanding 6"
    receive: by.a11y('Receive'),                                              // never tapped
    cancel: by.a11y('Cancel'),
  };

  async read(product: string): Promise<{ intro: string; warehouse: string; quantity: string; info: string; receive: boolean }> {
    const s = this.selectors;
    return {
      intro: await $(s.intro).getText().catch(() => ''),
      warehouse: (await $(s.warehouse).getAttribute('content-desc').catch(() => '')) ?? '',
      quantity: await $(s.line(product)).getText().catch(() => ''),
      info: await $(s.lineInfo).getText().catch(() => ''),
      receive: await $(s.receive).isExisting(),
    };
  }

  /** Cancel on the unchanged sheet; returns whether a dialog appeared. */
  async cancel(): Promise<boolean> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForGone(this.marker, 10_000, 'Receive stock');
    return $(by.text(PURCHASE_ORDER_TEXTS.discardTitle)).isExisting();
  }
}

export const receiveStockPage = new ReceiveStockPage();

export interface PurchaseOrderForm {
  supplier: string; priceBook: string; warehouse: string; draft: boolean; ordered: boolean;
  orderDate: string; delivery: string; paid: string; terms: string; notes: string; addProduct: boolean; save: boolean;
}

class NewPurchaseOrderPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="New purchase order"]';
  readonly selectors = {
    cancel: '(//android.widget.Button[@content-desc="Cancel"])[1]',
    save: by.a11y('Save'),                                                     // never tapped
    supplier: by.descStartsWith('Supplier: '),
    priceBook: by.descStartsWith('Price book: '),
    warehouse: by.descStartsWith('Warehouse: '),
    status: (name: string) => `//android.widget.RadioButton[@content-desc=${xq(name)}]`,
    orderDate: by.descStartsWith('Order date: '),
    delivery: by.descStartsWith('Expected delivery: '),
    input: (label: string) => `//android.widget.EditText[@content-desc=${xq(label)}]`,
    addProduct: by.a11y('Add product'),
    lineRows: '//android.widget.Button[contains(@content-desc, " x ₹")]',
    linesTotal: '//android.widget.TextView[@text="Lines total"]/following-sibling::android.widget.TextView[1]',
    // Product picker
    pickerTitle: by.text('Choose a product'),
    pickerSearch: by.a11y('Search products'),
    option: (start: string) => `(//android.widget.Button[starts-with(@content-desc, ${xq(start)})])[1]`,
    // New line sheet
    lineTitle: by.text('New line'),
    lineProduct: by.descStartsWith('Product: '),
    tax: by.descStartsWith('Tax: '),
    taxTitle: '//android.view.View[@text="Tax"]',
    taxOption: (name: string) => `//android.widget.Button[@content-desc=${xq(name)}]`,
    addLine: by.a11y('Add line'),
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
    // Discard dialog
    discardTitle: by.text(PURCHASE_ORDER_TEXTS.discardTitle),
    discardMessage: by.text(PURCHASE_ORDER_TEXTS.discardMessage),
    dialogCancel: `//android.widget.Button[@content-desc="Cancel" and following-sibling::android.widget.Button[@content-desc="Discard"]]`,
    discard: by.a11y('Discard'),
  };

  private async desc(selector: string): Promise<string> {
    return (await $(selector).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  private async inView(selector: string): Promise<void> {
    for (let i = 0; i < 4 && !(await $(selector).isDisplayed().catch(() => false)); i++) await scrollDown();
  }

  async read(): Promise<PurchaseOrderForm> {
    const s = this.selectors;
    const checked = async (n: string) => (await $(s.status(n)).getAttribute('checked').catch(() => '')) === 'true';
    const head = {
      supplier: await this.desc(s.supplier), priceBook: await this.desc(s.priceBook), warehouse: await this.desc(s.warehouse),
      draft: await checked('Draft'), ordered: await checked('Ordered'),
      orderDate: await this.desc(s.orderDate), delivery: await this.desc(s.delivery),
      addProduct: await $(s.addProduct).isExisting(), save: await $(s.save).isExisting(),
    };
    await this.inView(s.input('Notes'));
    const txt = (sel: string) => $(sel).getText().catch(() => '');
    return { ...head, paid: await txt(s.input('Paid')), terms: await txt(s.input('Terms and conditions')), notes: await txt(s.input('Notes')) };
  }

  /** Add product > search > choose: opens the New line sheet with the product. Returns the picker option label. */
  async chooseProduct(search: string, start: string): Promise<string> {
    const s = this.selectors;
    await this.inView(s.addProduct);
    await this.tap(s.addProduct);
    await this.waitForVisible(s.pickerTitle, 10_000, 'Choose a product');
    const field = $(s.pickerSearch);
    await field.click();
    await field.setValue(search);
    // No hideKeyboard here: its BACK closes the whole picker sheet (run 20261118-124903). The option sits above the keyboard.
    await $(s.option(start)).waitForDisplayed({ timeout: SCROLL_TIMEOUT, timeoutMsg: `"${start}" not offered` });
    const label = await this.desc(s.option(start));
    await this.tap(s.option(start));
    await this.waitForVisible(s.lineTitle, 10_000, 'New line');
    return label;
  }

  async readLine(): Promise<{ product: string; name: string; qty: string; cost: string; tax: string }> {
    const s = this.selectors;
    const txt = (sel: string) => $(sel).getText().catch(() => '');
    return { product: await this.desc(s.lineProduct), name: await txt(s.input('Name')), qty: await txt(s.input('Qty')),
      cost: await txt(s.input('Unit cost')), tax: await this.desc(s.tax) };
  }

  /** Opens the tax picker, returns its options and closes it (or chooses one when given). */
  async taxOptions(choose?: string): Promise<string[]> {
    const s = this.selectors;
    await this.tap(s.tax);
    await this.waitForVisible(s.taxTitle, 10_000, 'Tax');
    const out: string[] = [];
    for (const el of await $$('//android.widget.Button')) {
      const d = (await el.getAttribute('content-desc')) ?? '';
      if (d && d !== 'Close') out.push(d);
    }
    await this.tap(choose ? s.taxOption(choose) : s.sheetClose);
    await this.waitForGone(s.taxTitle, 5_000, 'Tax');
    return out;
  }

  async setQuantity(qty: string): Promise<void> {
    const el = $(this.selectors.input('Qty'));
    await el.click();
    await el.setValue(qty);
    // The keyboard's Done closes it; hideKeyboard (BACK) would close the whole New line sheet (run 20261118-125114).
    await driver.execute('mobile: performEditorAction', { action: 'done' });
    await driver.pause(500);
  }

  /** Adds a line to the unsaved form: product, quantity and tax, then Add line. */
  async addLine(search: string, product: string, qty: string, tax: string): Promise<void> {
    await this.chooseProduct(search, product);
    await this.setQuantity(qty);
    await this.taxOptions(tax);
    await this.tap(this.selectors.addLine);
    await this.waitForGone(this.selectors.lineTitle, 10_000, 'New line');
  }

  async closeLineSheet(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.lineTitle, 5_000, 'New line');
  }

  /** The line rows ("QA-TEST Gadget R3, 3 x ₹100.12, Sales 10%, ₹330.40") and the Lines total. */
  async lineRows(): Promise<{ rows: string[]; total: string }> {
    await this.inView(this.selectors.linesTotal);
    const rows: string[] = [];
    for (const el of await $$(this.selectors.lineRows)) rows.push((await el.getAttribute('content-desc')) ?? '');
    return { rows, total: await $(this.selectors.linesTotal).getText().catch(() => '') };
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
    await this.waitForVisible(this.selectors.discardTitle, 10_000, PURCHASE_ORDER_TEXTS.discardTitle);
    const message = await $(this.selectors.discardMessage).isExisting();
    await this.tap(this.selectors.dialogCancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, PURCHASE_ORDER_TEXTS.discardTitle);
    return { message };
  }

  async discard(): Promise<{ message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, PURCHASE_ORDER_TEXTS.discardTitle);
    const message = await $(this.selectors.discardMessage).isExisting();
    await this.tap(this.selectors.discard);
    await this.waitForGone(this.marker, 10_000, 'New purchase order');
    return { message };
  }
}

export const newPurchaseOrderPage = new NewPurchaseOrderPage();
