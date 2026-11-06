// More > SALES > Invoices: the list (status chips, search, due date and paid amount on a row) and an invoice's
// detail with its PAYMENT block (Total, Paid, Balance due, progress, payment history), LINE ITEMS with
// discounts, totals with taxes, RELATED sales order and Invoice actions menu. Live app on the phone, 2026-11-06.
// The screens are the shared sales-document screens (SalesDocumentPages.ts) with invoice extras.
//
// Read only: New invoice, Record payment, Share and every menu action (Change status, Record payment, View PDF,
// Download PDF, Share link, Create delivery note, Add expense, Notes, Add task, Edit, Delete) are never tapped.
import { by } from './BasePage.js';
import { SalesListPage, SalesDetailPage, money } from './SalesDocumentPages.js';

/** List row: title, amount, number, optional "Due 8 Jul", status, optional "Paid ₹40,381". */
export interface InvoiceRow { title: string; amount: string; number: string; due: string; paid: string; status: string; label: string }
/** Line item: "1 x ₹1,110, 1% off" and its line total. */
export interface InvoiceLine { quantity: number; price: number; discount: number; total: number }
export interface InvoicePayment { amount: number; date: string; details: string }

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Approved', 'Paid', 'Partially Paid', 'Overdue', 'Void'] as const;
export const INVOICE_ACTIONS = ['Change status', 'Record payment', 'View PDF', 'Download PDF', 'Share link', 'Create delivery note', 'Add expense', 'Notes', 'Add task', 'Edit', 'Delete'] as const;

export const INVOICE_TEXTS = {
  searchHint: 'Search invoices',
  noInvoices: 'No invoices found',
  noInvoicesHint: 'Try another search or status.',
  shareHint: 'Share sends a link your customer can open and print.',
};

const LINE = /^([0-9.]+) x (-?₹[0-9,.]+)(?:, ([0-9.]+)% off)?$/;

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
    lines: by.textMatches('[0-9.]+ x -?₹[0-9,.]+(, [0-9.]+% off)?'),
    lineTotal: (text: string) => `//android.widget.TextView[@text=${JSON.stringify(text)}]/following-sibling::android.widget.TextView[1]`,
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
      const m = LINE.exec(t);
      if (!m) continue;
      out.push({ quantity: Number(m[1]), price: money(m[2]!), discount: Number(m[3] ?? 0), total: money(await this.text(this.invoice.lineTotal(t))) });
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
