// More > SALES > Invoices: the list (status chips, search, due date and paid amount on a row) and an invoice's
// detail with its PAYMENT block (Total, Paid, Balance due, progress, payment history), LINE ITEMS with
// discounts, totals with taxes, RELATED sales order and Invoice actions menu. Live app on the phone, 2026-11-06.
// The screens are the shared sales-document screens (SalesDocumentPages.ts) with invoice extras.
//
// New invoice: MINV-021 fills the form and discards it; only MINV-020 saves one (INVOICE_CREATE=1).
// Otherwise read only: Record payment, Share and every menu action (Change status, Record payment, View PDF,
// Download PDF, Share link, Create delivery note, Add expense, Notes, Add task, Edit, Delete) are never tapped.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage, money } from './SalesDocumentPages.js';

/** List row: title, amount, number, optional "Due 8 Jul", status, optional "Paid ₹40,381". */
export interface InvoiceRow { title: string; amount: string; number: string; due: string; paid: string; status: string; label: string }
/** Line item: "1 x ₹1,110, 1% off" or "1 x ₹96, ₹6 off, TDS 2%" and its line total. */
export interface InvoiceLine { quantity: number; price: number; discount: number; discountAmount: number; tax: string; total: number }
export interface InvoicePayment { amount: number; date: string; details: string }

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Approved', 'Paid', 'Partially Paid', 'Overdue', 'Void'] as const;
export const INVOICE_ACTIONS = ['Change status', 'Record payment', 'View PDF', 'Download PDF', 'Share link', 'Create delivery note', 'Add expense', 'Notes', 'Add task', 'Edit', 'Delete'] as const;

export const INVOICE_TEXTS = {
  searchHint: 'Search invoices',
  noInvoices: 'No invoices found',
  noInvoicesHint: 'Try another search or status.',
  shareHint: 'Share sends a link your customer can open and print.',
};

// "<qty> x ₹<price>[, <n>% off][, ₹<n> off][, <tax name>]"
const LINE = /^([0-9.]+) x (-?₹[0-9,.]+)(?:, ([0-9.]+)% off)?(?:, (₹[0-9,.]+) off)?(?:, (.+))?$/;
/** Parses a line's detail text; undefined when it is not one. */
export function parseLine(text: string, total: number): InvoiceLine | undefined {
  const m = LINE.exec(text);
  if (!m) return undefined;
  return { quantity: Number(m[1]), price: money(m[2]!), discount: Number(m[3] ?? 0), discountAmount: m[4] ? money(m[4]) : 0, tax: m[5] ?? '', total };
}

class InvoiceListPage extends SalesListPage {
  async invoiceRows(): Promise<InvoiceRow[]> {
    const rows: InvoiceRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (texts.length < 4) continue;
      const [title, amount, number, ...rest] = texts as [string, string, string, ...string[]];
      const due = rest.find((t) => t.startsWith('Due ')) ?? '';
      const paid = rest.find((t) => /^Paid ₹/.test(t)) ?? '';
      const status = rest.find((t) => t !== due && t !== paid) ?? '';
      // A row cut off at the bottom of the screen exposes only its first texts: leave it out.
      if (!status) continue;
      rows.push({ title, amount, number, due, paid, status, label });
    }
    return rows;
  }
}

class InvoiceDetailPage extends SalesDetailPage {
  readonly invoice = {
    due: `${this.selectors.number}/following-sibling::android.widget.TextView[starts-with(@text, "Due ")]`,
    balance: `${this.selectors.number}/following-sibling::android.widget.TextView[starts-with(@text, "Balance ₹")]`,
    // PAYMENT block: label / amount pairs in one group, then the progress bar and the payment history.
    paymentAmount: (label: string) => `//android.widget.TextView[@text="Balance due"]/../android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    progress: by.descStartsWith('Paid '),             // "Paid 41%"
    payments: '//android.widget.TextView[starts-with(@content-desc, "₹")]',   // "₹500, 20 Aug, Cash, UTR-VERIFY-196, Yash"
    // The Total under LINE ITEMS (PAYMENT has its own "Total" above it).
    grandTotal: '//android.widget.TextView[@text="Subtotal"]/following-sibling::android.widget.TextView[@text="Total"]',
    lines: by.textMatches('[0-9.]+ x -?₹[0-9,.]+(, .+)?'),
    // The line total sits after the detail text on a saved invoice and before it on the form.
    lineTotal: (text: string) => {
      const t = `//android.widget.TextView[@text=${JSON.stringify(text)}]`;
      return `(${t}/preceding-sibling::android.widget.TextView[1][contains(@text, "₹")] | ${t}/following-sibling::android.widget.TextView[1][contains(@text, "₹")])[1]`;
    },
    shareHint: by.text(INVOICE_TEXTS.shareHint),
    // Bottom bar: Record payment (only while a balance is due) and Share; never tapped.
    bottomButton: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and .//android.widget.TextView[@text=${JSON.stringify(name)}]]`,
    // On a sales order: INVOICES entry "Paid, INV-300005, ₹1,076.92".
    salesOrderInvoice: (number: string) => `(//android.view.View[contains(@content-desc, ${JSON.stringify(`, ${number}, `)})])[1]`,
  };

  async salesOrderInvoice(number: string): Promise<string> {
    await this.scrollTo(this.invoice.salesOrderInvoice(number));
    return (await $(this.invoice.salesOrderInvoice(number)).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  async payment(label: 'Total' | 'Paid' | 'Balance due'): Promise<number> {
    return money(await this.text(this.invoice.paymentAmount(label)));
  }

  /** "Paid 41%" -> 41. */
  async progress(): Promise<number> {
    return Number(((await $(this.invoice.progress).getAttribute('content-desc')) ?? '').replace(/[^0-9]/g, ''));
  }

  async payments(): Promise<InvoicePayment[]> {
    const out: InvoicePayment[] = [];
    // From the content-desc "₹1,076.92, 8 Sep, Cash, Yash": amounts have no space after their commas.
    for (const el of await $$(this.invoice.payments)) {
      const [amount = '', date = '', ...details] = ((await el.getAttribute('content-desc')) ?? '').split(', ');
      out.push({ amount: money(amount), date, details: details.join(', ') });
    }
    return out;
  }

  async invoiceLines(): Promise<InvoiceLine[]> {
    const out: InvoiceLine[] = [];
    for (const el of await $$(this.invoice.lines)) {
      const t = await el.getText();
      const line = parseLine(t, money(await this.text(this.invoice.lineTotal(t))));
      if (line) out.push(line);
    }
    return out;
  }
}

export const invoicesPage = new InvoiceListPage({
  title: 'Invoices',
  searchHint: INVOICE_TEXTS.searchHint,
  statuses: INVOICE_STATUSES,
  noResults: INVOICE_TEXTS.noInvoices,
  noResultsHint: INVOICE_TEXTS.noInvoicesHint,
  newButton: 'New invoice',
  minRowTexts: 4,
});

export const invoiceDetailPage = new InvoiceDetailPage({
  title: 'Invoice',
  summary: 'Invoice summary',
  numberPrefixes: ['INV-'],
  menuTitle: 'Invoice actions',
});

export { money };

/** One line to add on the New invoice form. Tax is an option of the Tax picker, e.g. "Sales 10%" or "TDS 2%". */
/** kind: Add product (search by "search") or Add service (services carry no stock). */
export interface NewLine { kind: 'product' | 'service'; product: string; search?: string; quantity: number; discountPercent?: number; discountAmount?: number; tax?: string }
export const INVOICE_TAXES = ['No tax', 'VAT 4.5%', 'Sales 10%', 'Service 12.5%', 'TDS 2%'] as const;
/** Rate of each tax in percent; TDS is deducted. */
export const INVOICE_TAX_RATES: Record<string, number> = { 'No tax': 0, 'VAT 4.5%': 4.5, 'Sales 10%': 10, 'Service 12.5%': 12.5, 'TDS 2%': -2 };

const newInvoiceSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),
  subject: by.a11y('Subject'),                              // EditText, hint "What the invoice is for"
  addProduct: by.a11y('Add product'),
  addService: by.a11y('Add service'),
  // Shown when Save is refused, e.g. "<product>: Out of stock".
  saveError: by.textMatches('.*: (Out of stock|.*required.*)'),
  productSearch: by.a11y('Search products'),
  // UiSelector, not XPath: product names carry double quotes, which XPath 1 cannot escape.
  product: (name: string) => `${by.descStartsWith(name)}.instance(0)`,
  lineSheet: by.text('New line'),
  quantity: by.a11y('Qty'),
  discountPercent: by.a11y('Discount %'),
  discountAmount: by.a11y('Discount amount'),
  taxField: by.descStartsWith('Tax: '),
  taxOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
  addLine: by.a11y('Add line'),
  // A line on the form: content-desc "<name>, <detail>, <total>"; texts name, total, detail.
  lines: '//android.widget.Button[contains(@content-desc, " x ₹")]',
  linesTotal: '//android.widget.TextView[@text="Lines total"]/following-sibling::android.widget.TextView[1]',
  discardTitle: by.textStartsWith('Discard this '),              // "Discard this invoice?" / "Discard this order?"
  discard: by.a11y('Discard'),
};

/** The New invoice form; the New sales order form has the same ORDER / LINE ITEMS layout and line sheet. */
class NewInvoicePage extends BasePage {
  protected readonly marker: string;
  constructor(readonly title = 'New invoice') { super(); this.marker = by.text(title); }
  readonly selectors = newInvoiceSelectors;

  private async field(selector: string, value: string): Promise<void> {
    const el = $(selector);
    await el.waitForDisplayed({ timeout: 10_000 });
    await el.click();
    await el.setValue(value);
  }

  async setSubject(subject: string): Promise<void> {
    await this.field(this.selectors.subject, subject);
    await this.hideKeyboard();
  }

  /** Scrolls the form down (or up) until the element is on screen. */
  async scrollTo(selector: string, direction: 'down' | 'up' = 'down'): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 6 && !(await $(selector).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.45, direction, percent: 0.6 });
    }
  }

  /** Add product > search > pick, fills quantity, discount and tax, then Add line. The keyboard stays open in
   *  the sheet (Add line sits above it): a Back there closes the sheet; it is closed only once the sheet is gone.
   *  An open keyboard must never be left under a scroll: the swipe types on it. */
  async addLine(line: NewLine): Promise<void> {
    const add = line.kind === 'service' ? this.selectors.addService : this.selectors.addProduct;
    await this.scrollTo(add);
    // Wait for the picker: a line already on the form starts with the same name, and tapping it opens "Edit line".
    // A tap while the form is still settling (keyboard closing) can be lost; opening the picker changes nothing, so retry it.
    for (let attempt = 1; ; attempt++) {
      await this.scrollTo(add);
      await this.tap(add);
      if (await $(by.descStartsWith('Search ')).waitForDisplayed({ timeout: 8_000 }).then(() => true, () => false)) break;
      if (attempt === 3) throw new Error('Product / service picker not shown after 3 taps');
    }
    if (line.search) await this.field(this.selectors.productSearch, line.search);
    await $(this.selectors.product(line.product)).waitForDisplayed({ timeout: 60_000, timeoutMsg: `"${line.product}" not offered` });
    // The picker sheet comes after the form in the hierarchy: its row is the last match.
    const matches = await $$(by.descStartsWith(line.product));
    await matches[matches.length - 1]!.click();
    await this.waitForVisible(this.selectors.lineSheet, 10_000, 'New line');
    // Tax first: once a number is typed the keyboard covers the Tax field.
    if (line.tax) {
      await this.tap(this.selectors.taxField);
      await this.tap(this.selectors.taxOption(line.tax));
      await $(this.selectors.taxField).waitForDisplayed({ timeout: 10_000 });
    }
    await this.field(this.selectors.quantity, String(line.quantity));
    if (line.discountPercent) await this.field(this.selectors.discountPercent, String(line.discountPercent));
    if (line.discountAmount) await this.field(this.selectors.discountAmount, String(line.discountAmount));
    await this.tap(this.selectors.addLine);
    await this.waitForGone(this.selectors.lineSheet, 10_000, 'New line');
    await this.hideKeyboard();
  }

  /** The lines on the form with the total each shows (tax included). */
  async formLines(): Promise<InvoiceLine[]> {
    await this.scrollTo(this.selectors.linesTotal);
    const out: InvoiceLine[] = [];
    for (const el of await $$(this.selectors.lines)) {
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push(await t.getText());
      const total = texts.find((t) => /^-?₹[0-9,.]+$/.test(t)) ?? '';
      const detail = texts.find((t) => LINE.test(t)) ?? '';
      const line = parseLine(detail, money(total));
      if (line) out.push(line);
    }
    return out;
  }

  async linesTotal(): Promise<number> {
    await this.scrollTo(this.selectors.linesTotal);
    return money(await $(this.selectors.linesTotal).getText());
  }

  async save(): Promise<void> {
    await this.tap(this.selectors.save);
  }

  /** Cancel > Discard: leaves the form without saving. */
  async discard(): Promise<void> {
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, 'Discard dialog');
    await this.tap(this.selectors.discard);
  }
}

export const newInvoicePage = new NewInvoicePage('New invoice');
export const newSalesOrderPage = new NewInvoicePage('New sales order');
