// More > SALES > Expenses: the list (status and payment chips, search, empty state) and the New expense form
// (date, category, reference, vendor, owner, description, amount with tax rate and "Amount includes tax", the
// live Amount / Tax / Total, paid through, payment status, links, billable, tags). Live app on the phone,
// 2026-11-16: beta held no expenses; MEXP-020 saves one QA expense (EXPENSE_CREATE=1), approved and kept.
//
// Read only otherwise: the form is filled and discarded; menus and pickers are opened and closed.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage, money } from './SalesDocumentPages.js';

export const EXPENSE_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'] as const;
export const EXPENSE_PAYMENT_FILTERS = ['Payment: Unpaid', 'Payment: Paid'] as const;
export const EXPENSE_CATEGORIES = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Rent', 'Utilities', 'Marketing', 'Freight', 'Professional Fees', 'Other'] as const;
export const EXPENSE_PAID_THROUGH = ['Cash', 'Bank Transfer', 'UPI', 'Card', 'Petty Cash', 'Credit Card', 'Cheque'] as const;
export const EXPENSE_TAXES = ['No tax', 'VAT 4.5%', 'Sales 10%', 'Service 12.5%', 'TDS 2%'] as const;

export const EXPENSE_TEXTS = {
  searchHint: 'Search expenses',
  empty: 'No expenses yet',
  emptyHint: 'Log a bill or receipt as an expense.',
  noResults: 'No expenses found',
  noResultsHint: 'Try another search or status.',
  referenceHint: 'Bill or receipt number',
  vendorNameHint: 'Or type the vendor name',
  discardTitle: 'Discard this expense?',
  discardMessage: 'This expense is not saved yet.',
};

export interface ExpenseRow { title: string; amount: string; number: string; date: string; status: string; label: string }

class ExpenseListPage extends SalesListPage {
  readonly expense = {
    empty: by.text(EXPENSE_TEXTS.empty),
    emptyHint: by.text(EXPENSE_TEXTS.emptyHint),
    headerNew: '(//android.widget.Button[@content-desc="New expense"])[1]',
    // The empty state has its own New expense button under the message (the header one is first).
    emptyNewButton: '(//android.widget.Button[@content-desc="New expense"])[2]',
    endOfList: by.textStartsWith('End of list.'),          // "End of list. 1 expense." / "... 2 expenses."
  };

  /** Rows: vendor (or the description), amount, EXP- number, date, status. */
  async expenseRows(): Promise<ExpenseRow[]> {
    const rows: ExpenseRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      const status = texts[texts.length - 1] ?? '';
      // A row cut off at the bottom of the screen lacks its status: leave it out.
      if (!(EXPENSE_STATUSES as readonly string[]).includes(status)) continue;
      rows.push({ title: texts[0] ?? '', amount: texts.find((t) => /^₹/.test(t)) ?? '', number: texts.find((t) => /^EXP-[0-9]+$/.test(t)) ?? '',
        date: texts.find((t) => /^[0-9]{1,2} [A-Z][a-z]{2} [0-9]{4}$/.test(t)) ?? '', status, label });
    }
    return rows;
  }

  /** "End of list. 1 expense." -> 1. -1 when it is not shown. */
  async endOfListCount(): Promise<number> {
    const text = await $(this.expense.endOfList).getText().catch(() => '');
    return text ? Number(text.replace(/[^0-9]/g, '')) : -1;
  }

  /** Rows, the empty list ("No expenses yet") or no results, with the count back under the title. */
  override async waitForLoaded(timeout = 60_000): Promise<void> {
    await driver.waitUntil(async () => ((await $$(this.selectors.rows).length) > 0 || (await $(this.selectors.noResults).isExisting())
      || (await $(this.expense.empty).isExisting())) && $(this.selectors.count).isExisting(),
    { timeout, timeoutMsg: `Expenses did not load within ${timeout} ms` });
  }
}

export const expensesPage = new ExpenseListPage({
  title: 'Expenses',
  searchHint: EXPENSE_TEXTS.searchHint,
  statuses: [...EXPENSE_STATUSES, ...EXPENSE_PAYMENT_FILTERS],
  noResults: EXPENSE_TEXTS.noResults,
  noResultsHint: EXPENSE_TEXTS.noResultsHint,
  newButton: 'New expense',
  minRowTexts: 3,
});

class ExpenseDetailPage extends SalesDetailPage {
  readonly expense = {
    // Summary siblings after the number: status, amount, date, category, vendor.
    summaryText: (i: number) => `${this.selectors.number}/following-sibling::android.widget.TextView[${i}]`,
    field: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    section: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
    description: '(//android.view.View[@text="DESCRIPTION"]/following::android.widget.TextView)[1]',
    receiptCount: '//android.view.View[@text="RECEIPTS"]/following-sibling::android.widget.TextView[1]',
    noReceipts: by.text('No receipts yet. Attach a photo or PDF of the bill.'),
    attach: by.a11y('Attach'),                            // never tapped
    submit: '//android.widget.Button[@content-desc="Submit"]',   // never tapped (changes the status)
  };

  async summary(): Promise<{ status: string; amount: string; date: string; category: string; vendor: string }> {
    const t = (i: number) => this.text(this.expense.summaryText(i));
    return { status: await t(1), amount: await t(2), date: await t(3), category: await t(4), vendor: await t(5) };
  }

  /** Opens the actions menu and taps one entry (only Edit is used: it opens a form that is cancelled). */
  async openAction(name: 'Edit'): Promise<void> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, this.config.menuTitle);
    await this.tap(this.selectors.action(name));
  }

  async field(label: string): Promise<string> {
    await this.scrollTo(this.expense.field(label));
    return this.text(this.expense.field(label));
  }
}

export const expenseDetailPage = new ExpenseDetailPage({
  title: 'Expense',
  summary: 'Expense summary',
  numberPrefixes: ['EXP-'],
  menuTitle: 'Expense actions',
});
export const EXPENSE_ACTIONS = ['Edit', 'Notes', 'Add task', 'Delete'] as const;

const formSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),
  date: by.descStartsWith('Date: '),                       // "Date: 16 Nov 2026" (today)
  category: by.descStartsWith('Category: '),               // "Category: No category"
  reference: by.a11y('Reference no'),
  referenceHint: by.text(EXPENSE_TEXTS.referenceHint),
  vendor: by.descStartsWith('Vendor: '),                   // "Vendor: Choose a supplier"
  vendorName: by.a11y('Vendor name'),                      // hint "Or type the vendor name"
  owner: by.descStartsWith('Owner: '),
  description: by.a11y('Description'),
  amount: by.a11y('Amount (before tax)'),
  taxRate: by.descStartsWith('Tax rate: '),                // "Tax rate: No tax"
  includesTax: by.a11y('Amount includes tax'),             // Switch
  // Live summary under the amount: label / value pairs.
  summary: (label: 'Amount' | 'Tax' | 'Total') => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
  paidThrough: by.descStartsWith('Paid through: '),        // "Paid through: Not set"
  unpaid: by.a11y('Unpaid'),                               // RadioButton
  paid: '//android.widget.RadioButton[@content-desc="Paid"]',
  salesOrder: by.descStartsWith('Sales order: '),
  invoice: by.descStartsWith('Invoice: '),
  billable: by.a11y('Billable to a customer'),             // Switch
  tags: by.a11y('Add tag'),
  sheetTitle: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
  option: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
  sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  discardTitle: by.text(EXPENSE_TEXTS.discardTitle),
  discardMessage: by.text(EXPENSE_TEXTS.discardMessage),
  discard: by.a11y('Discard'),
  // Shown when Save is refused.
  saveError: by.textMatches('.*(required|must|invalid|greater).*'),
};

export interface ExpenseInput {
  description: string; reference?: string; vendorName?: string; category?: string;
  amount: number; tax?: string; includesTax?: boolean;
}

/** The expense form: "New expense" or "Edit expense" (same fields). */
class ExpenseFormPage extends BasePage {
  protected readonly marker: string;
  constructor(title: string) { super(); this.marker = `//android.view.View[@text=${JSON.stringify(title)}]`; }
  readonly selectors = formSelectors;

  async desc(selector: string): Promise<string> {
    return (await $(selector).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  /** Whether a switch or radio is on; scrolls it into view first (UiAutomator only sees on-screen elements). */
  async isChecked(selector: string): Promise<boolean> {
    await this.scrollTo(selector);
    if (!(await $(selector).isDisplayed().catch(() => false))) await this.scrollTo(selector, 'up');
    return (await $(selector).getAttribute('checked').catch(() => 'false')) === 'true';
  }

  /** Scrolls until the element is on screen. Call with the keyboard closed: a swipe types on it. */
  async scrollTo(selector: string, direction: 'down' | 'up' = 'down'): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 8 && !(await $(selector).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.45, direction, percent: 0.6 });
    }
  }

  async typeInto(selector: string, value: string): Promise<void> {
    await this.scrollTo(selector);
    const el = $(selector);
    await el.click();
    await el.setValue(value);
    await this.hideKeyboard();
  }

  /** Opens a picker, returns its options (and which is selected), and chooses one when asked; else closes it. */
  async picker(field: string, title: string, expected: readonly string[], choose?: string): Promise<{ label: string; selected: boolean }[]> {
    await this.scrollTo(field);
    await this.tap(field);
    await this.waitForVisible(this.selectors.sheetTitle(title), 10_000, title);
    const out: { label: string; selected: boolean }[] = [];
    for (const o of expected) {
      const el = await $$(this.selectors.option(o));
      if (el.length) out.push({ label: o, selected: (await el[0]!.getAttribute('selected')) === 'true' });
    }
    await this.tap(choose ? this.selectors.option(choose) : this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle(title), 5_000, title);
    return out;
  }

  async setAmount(amount: number): Promise<void> {
    await this.typeInto(this.selectors.amount, String(amount));
  }

  async setTax(tax: string): Promise<void> {
    await this.picker(this.selectors.taxRate, 'Tax', EXPENSE_TAXES, tax);
  }

  async setIncludesTax(on: boolean): Promise<void> {
    await this.scrollTo(this.selectors.includesTax);
    if ((await this.isChecked(this.selectors.includesTax)) !== on) await this.tap(this.selectors.includesTax);
  }

  /** The live Amount / Tax / Total under the amount. */
  async summary(): Promise<{ amount: number; tax: number; total: number }> {
    await this.scrollTo(this.selectors.summary('Total'));
    const read = async (l: 'Amount' | 'Tax' | 'Total') => money(await $(this.selectors.summary(l)).getText());
    return { amount: await read('Amount'), tax: await read('Tax'), total: await read('Total') };
  }

  async fill(e: ExpenseInput): Promise<void> {
    if (e.category) await this.picker(this.selectors.category, 'Category', EXPENSE_CATEGORIES, e.category);
    if (e.reference) await this.typeInto(this.selectors.reference, e.reference);
    if (e.vendorName) await this.typeInto(this.selectors.vendorName, e.vendorName);
    await this.typeInto(this.selectors.description, e.description);
    await this.setAmount(e.amount);
    if (e.tax) await this.setTax(e.tax);
    if (e.includesTax !== undefined) await this.setIncludesTax(e.includesTax);
  }

  async save(): Promise<void> {
    await this.tap(this.selectors.save);
  }

  /** Cancel with nothing changed: leaves the form directly (no dialog). */
  async cancel(): Promise<void> {
    await this.tap(this.selectors.cancel);
    await this.waitForGone(this.marker, 10_000, 'expense form');
  }

  /** Cancel; reads the discard dialog; Discard. */
  async discard(): Promise<{ title: boolean; message: boolean }> {
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, EXPENSE_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.discard);
    return seen;
  }
}

export const newExpensePage = new ExpenseFormPage('New expense');
export const editExpensePage = new ExpenseFormPage('Edit expense');
