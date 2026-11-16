// More > SALES > Delivery Notes: the list (status chips, search, "End of list. N delivery notes."), a delivery
// note's detail (summary, ITEMS with Total quantity, SHIPPING, NOTES, ACTIVITY), its actions menu and Change
// status sheet, and the New delivery note form. Live app on the phone, 2026-11-16: beta holds 7 delivery notes.
//
// Read only: Save, Download PDF, Share, every menu action and every status are never tapped. The form is filled
// and discarded (Cancel > Discard); the actions menu and the status sheet are opened and closed.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage } from './SalesDocumentPages.js';

export const DELIVERY_STATUSES = ['Draft', 'Dispatched', 'Delivered', 'Cancelled'] as const;
export const DELIVERY_ACTIONS = ['Change status', 'Edit', 'Share link', 'Notes', 'Add task', 'Delete'] as const;

export const DELIVERY_TEXTS = {
  searchHint: 'Search delivery notes',
  noNotes: 'No delivery notes found',
  noNotesHint: 'Try another search or status.',
  endOfList: (n: number) => `End of list. ${n} delivery notes.`,
  discardTitle: 'Discard this note?',
  discardMessage: 'This note is not saved yet.',
  carrierHint: 'BlueDart, FedEx',
};

/** List row: subject (or the number when there is none), optional "Dispatched 15 Sep", number, date, status. */
export interface DeliveryRow { title: string; number: string; date: string; status: string; dispatched: string; label: string }
export interface DeliveryItem { name: string; price: string; quantity: number; serial: string }

const DATE = /^[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?$/;

class DeliveryListPage extends SalesListPage {
  /** More > SALES entry; its label is capitalised differently from the screen title. */
  readonly moreEntry = by.a11y('Delivery Notes');
  readonly endOfList = by.textStartsWith('End of list.');

  async deliveryRows(): Promise<DeliveryRow[]> {
    const rows: DeliveryRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      const status = texts[texts.length - 1] ?? '';
      const number = texts.find((t) => /^DN-[0-9]+$/.test(t)) ?? '';
      const date = [...texts].reverse().find((t) => DATE.test(t)) ?? '';
      const dispatched = texts.find((t) => /^(Dispatched|Delivered) [0-9]/.test(t)) ?? '';
      // A row cut off at the bottom of the screen lacks its status: leave it out.
      if (!(DELIVERY_STATUSES as readonly string[]).includes(status)) continue;
      rows.push({ title: texts[0] ?? '', number, date, status, dispatched, label });
    }
    return rows;
  }

  /** "End of list. 7 delivery notes." -> 7; scrolls down to it. -1 when it is not shown. */
  async endOfListCount(): Promise<number> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 5 && !(await $(this.endOfList).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.4, width: width * 0.8, height: height * 0.4, direction: 'down', percent: 0.8 });
    }
    const text = await $(this.endOfList).getText().catch(() => '');
    return text ? Number(text.replace(/[^0-9]/g, '')) : -1;
  }
}

class DeliveryDetailPage extends SalesDetailPage {
  readonly note = {
    // Only before ITEMS: without a subject the next TextView is the ITEMS count.
    subject: `${this.selectors.number}/following-sibling::android.widget.TextView[2][following-sibling::android.view.View[@text="ITEMS"] and not(starts-with(@text, "Dispatched ")) and not(starts-with(@text, "Delivered "))]`,
    dispatched: `${this.selectors.number}/following-sibling::android.widget.TextView[starts-with(@text, "Dispatched ")]`,
    itemCount: '//android.view.View[@text="ITEMS"]/following-sibling::android.widget.TextView[1]',
    quantities: by.textMatches('x [0-9.]+'),                 // "x 2"; name and price before it, serial after
    totalQuantity: '//android.widget.TextView[@text="Total quantity"]/following-sibling::android.widget.TextView[1]',
    field: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    notes: '(//android.view.View[@text="NOTES"]/following-sibling::*[1]//android.widget.TextView)[1]',
    activityCount: '//android.view.View[@text="ACTIVITY"]/following-sibling::android.widget.TextView[1]',
    activity: '//android.widget.TextView[contains(@content-desc, ", ") and string-length(@content-desc) > 0]',
    statusSheetTitle: '//android.view.View[@text="Change status"]',   // sheet title (the menu entry is a TextView)
    statusOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
  };

  async items(): Promise<DeliveryItem[]> {
    const out: DeliveryItem[] = [];
    // Absolute XPaths per item: a relative XPath from a found element returns nothing on UiAutomator2 here.
    const seen: Record<string, number> = {};
    for (const el of await $$(this.note.quantities)) {
      const q = await el.getText();
      seen[q] = (seen[q] ?? 0) + 1;
      const at = `(//android.widget.TextView[@text=${JSON.stringify(q)}])[${seen[q]}]`;
      const text = (path: string) => $(`${at}/${path}`).getText().catch(() => '');
      const [name, price, after] = [await text('preceding-sibling::android.widget.TextView[2]'), await text('preceding-sibling::android.widget.TextView[1]'), await text('following-sibling::android.widget.TextView[1]')];
      out.push({ name, price, quantity: Number(q.replace(/[^0-9.]/g, '')), serial: after.startsWith('Serial') ? after : '' });
    }
    return out;
  }

  /** Activity entries on screen, from their content-desc ("<text>, <date>"). */
  async activity(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.note.activity)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
  }

  /** Opens Change status (via the actions menu), reads each status and which one is selected, closes it. */
  async statusOptions(): Promise<{ label: string; selected: boolean }[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, this.config.menuTitle);
    await this.tap(this.selectors.action('Change status'));
    await this.waitForVisible(this.note.statusSheetTitle, 10_000, 'Change status');
    const out: { label: string; selected: boolean }[] = [];
    for (const s of DELIVERY_STATUSES) {
      const el = await $$(this.note.statusOption(s));
      if (el.length) out.push({ label: s, selected: (await el[0]!.getAttribute('selected')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.note.statusSheetTitle, 5_000, 'Change status');
    return out;
  }
}

export const deliveryNotesPage = new DeliveryListPage({
  title: 'Delivery notes',
  searchHint: DELIVERY_TEXTS.searchHint,
  statuses: DELIVERY_STATUSES,
  noResults: DELIVERY_TEXTS.noNotes,
  noResultsHint: DELIVERY_TEXTS.noNotesHint,
  newButton: 'New delivery note',
  minRowTexts: 3,
});

export const deliveryNoteDetailPage = new DeliveryDetailPage({
  title: 'Delivery note',
  summary: 'Delivery note summary',
  numberPrefixes: ['DN-'],
  menuTitle: 'Delivery note actions',
});

const newNoteSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),                                  // never tapped
  status: by.descStartsWith('Status: '),                  // "Status: Draft"
  statusSheetTitle: '//android.view.View[@text="Status"]',   // sheet title; the form label is a TextView
  dispatchDate: by.descStartsWith('Dispatch date: '),     // "Dispatch date: No date"
  deliveryDate: by.descStartsWith('Delivery date: '),
  subject: by.a11y('Subject'),
  customer: by.descStartsWith('Customer: '),              // "Customer: Link a contact"
  owner: by.descStartsWith('Owner: '),                    // "Owner: Me"
  addProduct: by.a11y('Add product'),
  addService: by.a11y('Add service'),
  service: (name: string) => `${by.descStartsWith(`${name},`)}.instance(0)`,   // "test service,  , ₹140"
  lineSheet: by.text('New line'),
  quantity: by.a11y('Qty'),
  unitPrice: by.a11y('Unit price'),
  addLine: by.a11y('Add line'),
  lineCount: '//android.view.View[@text="LINE ITEMS"]/following-sibling::android.widget.TextView[1]',
  lines: '//android.widget.Button[contains(@content-desc, " x ₹")]',   // "test service, 3 x ₹140, ₹420"
  linesTotal: '//android.widget.TextView[@text="Lines total"]/following-sibling::android.widget.TextView[1]',
  carrier: by.a11y('Carrier'),
  tracking: by.a11y('Tracking number'),
  shippingAddress: by.a11y('Shipping address'),
  notes: by.a11y('Notes'),
  sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  discardTitle: by.text(DELIVERY_TEXTS.discardTitle),
  discardMessage: by.text(DELIVERY_TEXTS.discardMessage),
  discard: by.a11y('Discard'),
};

class NewDeliveryNotePage extends BasePage {
  protected readonly marker = by.text('New delivery note');
  readonly selectors = newNoteSelectors;

  async desc(selector: string): Promise<string> {
    return (await $(selector).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  /** Scrolls the form until the element is on screen. Call with the keyboard closed: a swipe types on it. */
  async scrollTo(selector: string, direction: 'down' | 'up' = 'down'): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 6 && !(await $(selector).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.45, direction, percent: 0.6 });
    }
  }

  /** Opens the form's Status picker, reads the options and the selected one, closes it. */
  async statusOptions(): Promise<{ label: string; selected: boolean }[]> {
    await this.scrollTo(this.selectors.status, 'up');
    await this.tap(this.selectors.status);
    await this.waitForVisible(this.selectors.statusSheetTitle, 10_000, 'Status');
    const out: { label: string; selected: boolean }[] = [];
    for (const s of DELIVERY_STATUSES) {
      const el = await $$(`//android.widget.Button[@content-desc=${JSON.stringify(s)}]`);
      if (el.length) out.push({ label: s, selected: (await el[0]!.getAttribute('selected')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.statusSheetTitle, 5_000, 'Status');
    return out;
  }

  /** Add service > pick > Qty > Add line. The keyboard is closed once the sheet is gone (Back in the sheet closes it). */
  async addService(name: string, quantity: number): Promise<void> {
    await this.scrollTo(this.selectors.addService);
    await this.tap(this.selectors.addService);
    await this.tap(this.selectors.service(name), 30_000);
    await this.waitForVisible(this.selectors.lineSheet, 10_000, 'New line');
    const qty = $(this.selectors.quantity);
    await qty.click();
    await qty.setValue(String(quantity));
    await this.tap(this.selectors.addLine);
    await this.waitForGone(this.selectors.lineSheet, 10_000, 'New line');
    await this.hideKeyboard();
  }

  async lineLabels(): Promise<string[]> {
    await this.scrollTo(this.selectors.linesTotal);
    const out: string[] = [];
    for (const el of await $$(this.selectors.lines)) out.push(((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' '));
    return out;
  }

  /** Cancel; reads the discard dialog; Discard. */
  async discard(): Promise<{ title: boolean; message: boolean }> {
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, DELIVERY_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.discard);
    return seen;
  }
}

export const newDeliveryNotePage = new NewDeliveryNotePage();
