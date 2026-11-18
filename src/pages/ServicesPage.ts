// More > INVENTORY > Services: the list (count "N services", search by name or service number, Active / Inactive
// chips and a Category picker chip), a service's detail (name, number, status button, price, category, the tabs
// Summary, Related and Activity), its actions menu and status picker, and the New / Edit service forms.
// Live app on the phone, 2026-11-17: 1 service on beta, "test service" (SER-0001).
//
// Read only: Save and every menu action except Edit (opened and cancelled unchanged) and every status are never
// chosen; the new form is filled and discarded; menus and pickers are opened and closed.
import { BasePage, by } from './BasePage.js';
import { SalesListPage, SalesDetailPage } from './SalesDocumentPages.js';

export const SERVICE_STATUSES = ['Active', 'Inactive'] as const;
export const SERVICE_ACTIONS = ['Edit', 'Mark inactive', 'View PDF', 'Save PDF', 'Delete'] as const;
export const SERVICE_TABS = ['Summary', 'Related', 'Activity'] as const;
export type ServiceTab = typeof SERVICE_TABS[number];
export const SERVICE_USAGE_UNITS = ['None', 'Hours', 'Days', 'Incidents', 'Months', 'Years', 'Units'] as const;
export const SERVICE_FORM_SECTIONS = ['SERVICE', 'PRICE', 'DATES', 'STATUS', 'DESCRIPTION'] as const;

export const SERVICE_TEXTS = {
  searchHint: 'Search name or service number',
  noResults: 'No services found',
  noResultsHint: 'Try another search or filter.',
  pickDate: 'Pick a date',
  discardTitle: 'Discard this service?',
  discardMessage: 'This service is not saved yet.',
};

/** List row: name, price, then "number, usage unit" ("SER-0001, Days"). */
export interface ServiceRow { name: string; price: string; code: string; label: string }

class ServiceListPage extends SalesListPage {
  readonly service = {
    categoryChip: '//android.widget.Button[@content-desc="Category" and contains(@bounds, ",260]")]',
    categoryTitle: '//android.view.View[@text="Category"]',
    categoryOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    clearCategory: (name: string) => by.a11y(`Clear ${name}`),
    selectedCategory: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)} and contains(@bounds, ",260]")]`,
    endOfList: by.textStartsWith('End of list.'),             // "End of list. 1 service."
  };

  async serviceRows(): Promise<ServiceRow[]> {
    const rows: ServiceRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (!texts[1]?.startsWith('₹')) continue;                  // not a service row (or cut off)
      rows.push({ name: texts[0] ?? '', price: texts[1] ?? '', code: texts[2] ?? '', label });
    }
    return rows;
  }

  async endOfListText(): Promise<string> {
    return $(this.service.endOfList).getText().catch(() => '');
  }

  /** Category chip > picker > option; returns the count. */
  async selectCategory(name: string): Promise<number> {
    await this.tap(this.service.categoryChip);
    await this.waitForVisible(this.service.categoryTitle, 10_000, 'Category');
    await this.tap(this.service.categoryOption(name));
    await this.waitForVisible(this.service.clearCategory(name), 10_000, `Clear ${name}`);
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }

  async clearCategory(name: string): Promise<number> {
    await this.tap(this.service.clearCategory(name));
    await this.waitForVisible(this.service.categoryChip, 10_000, 'Category chip');
    await driver.pause(2_500);
    await this.waitForLoaded();
    return this.count();
  }
}

export const servicesPage = new ServiceListPage({
  title: 'Services',
  searchHint: SERVICE_TEXTS.searchHint,
  statuses: SERVICE_STATUSES,
  noResults: SERVICE_TEXTS.noResults,
  noResultsHint: SERVICE_TEXTS.noResultsHint,
  newButton: 'New service',
  minRowTexts: 3,
});

const status = by.descStartsWith('Status: ');                 // "Status: Active. Change status"

class ServiceDetailPage extends SalesDetailPage {
  readonly service = {
    statusButton: status,
    name: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/preceding-sibling::android.view.View[1]`,
    number: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/preceding-sibling::android.widget.TextView[1]`,
    price: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/following-sibling::android.widget.TextView[1]`,
    category: `//android.widget.Button[starts-with(@content-desc, "Status: ")]/following-sibling::android.widget.TextView[2]`,
    tab: (name: ServiceTab) => by.a11y(name),
    field: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    section: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
    sectionCount: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[1]`,
    description: '//android.view.View[@text="DESCRIPTION"]/following::android.widget.TextView[1]',   // inside the next container
    invoices: by.descStartsWith('INV-'),                       // "INV-300013, ₹413.88, Qty 2, Yesterday, Draft"
    activity: '//android.widget.TextView[string-length(@content-desc) > 0]',   // 'Service "test service" created, 12 Oct, Yash'
    statusTitle: '//android.view.View[@text="Status"]',
    statusOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
  };

  async openTab(name: ServiceTab): Promise<void> {
    await this.tap(this.service.tab(name));
    await driver.pause(1_500);
  }

  async field(label: string): Promise<string> {
    await this.scrollTo(this.service.field(label));
    return this.text(this.service.field(label));
  }

  /** Content-desc of every match on the open tab. */
  async labels(selector: string): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(selector)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
  }

  /** Opens the status picker, reads each status and the selected one, closes it. */
  async statusOptions(): Promise<{ label: string; selected: boolean }[]> {
    await this.tap(this.service.statusButton);
    await this.waitForVisible(this.service.statusTitle, 10_000, 'Status');
    const out: { label: string; selected: boolean }[] = [];
    for (const s of SERVICE_STATUSES) {
      const el = await $$(this.service.statusOption(s));
      if (el.length) out.push({ label: s, selected: (await el[0]!.getAttribute('selected')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.service.statusTitle, 5_000, 'Status');
    return out;
  }

  /** Related tab: opens the first invoice row with that number (read only). */
  async openInvoice(number: string): Promise<void> {
    await this.tap(`(//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${number}, `)})])[1]`);
  }

  /** More actions > Edit (opens the form; nothing is saved). */
  async openEdit(): Promise<void> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, this.config.menuTitle);
    await this.tap('//android.widget.Button[@content-desc="Edit"]');
  }
}

export const serviceDetailPage = new ServiceDetailPage({
  title: 'Service',
  summary: 'Service summary',
  numberPrefixes: ['SER-'],
  menuTitle: 'Service actions',
});

const formSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),                                   // never tapped
  name: by.a11y('Service name'),
  usageUnit: by.descStartsWith('Usage unit: '),            // "Usage unit: Hours"
  sheetTitle: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]`,
  sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  option: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
  active: '//android.widget.Switch[@content-desc="Active"]',
  discardTitle: by.text(SERVICE_TEXTS.discardTitle),
  discardMessage: by.text(SERVICE_TEXTS.discardMessage),
  discard: by.a11y('Discard'),
  dialogCancel: '//android.widget.Button[@content-desc="Cancel" and following-sibling::android.widget.Button[@content-desc="Discard"]]',
};

/** The New service and Edit service forms (same fields; the edit form holds the saved values). */
class ServiceFormPage extends BasePage {
  protected readonly marker: string;
  readonly selectors = formSelectors;

  constructor(title: string) {
    super();
    this.marker = `//android.view.View[@text=${JSON.stringify(title)}]`;
  }

  /** Scrolls the form with UiScrollable until the match is on screen (swipes scroll long forms erratically). */
  async intoView(ui: string): Promise<WebdriverIO.Element> {
    return $(`android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).setMaxSearchSwipes(25).scrollIntoView(new UiSelector().${ui})`).getElement();
  }

  /** Brings a match fully on screen: UiScrollable can stop with it clipped at the bottom edge. */
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

  /** Text of an input by its label (content-desc), e.g. "Price" -> "140". */
  async inputText(label: string): Promise<string> {
    await this.fullyInView(`description(${JSON.stringify(label)})`, by.a11y(label));
    return $(by.a11y(label)).getText().catch(() => '');
  }

  /** Content-desc of a picker field by its prefix, e.g. "Usage unit: " -> "Usage unit: Hours". */
  async pickerText(prefix: string): Promise<string> {
    await this.fullyInView(`descriptionStartsWith(${JSON.stringify(prefix)})`, by.descStartsWith(prefix));
    return ((await $(by.descStartsWith(prefix)).getAttribute('content-desc').catch(() => '')) ?? '');
  }

  /** Whether a text (a section heading) can be scrolled into view. */
  async hasText(text: string): Promise<boolean> {
    return (await this.intoView(`text(${JSON.stringify(text)})`)).isExisting().catch(() => false);
  }

  async isActive(): Promise<boolean> {
    await this.fullyInView('className("android.widget.Switch")', this.selectors.active);
    return (await $(this.selectors.active).getAttribute('checked')) === 'true';
  }

  async setName(value: string): Promise<void> {
    const el = await this.intoView('description("Service name")');
    await el.click();
    await el.setValue(value);
    await this.hideKeyboard();
  }

  /** Opens the Usage unit picker, returns its options and the selected one, then chooses `choose` or closes. */
  async usageUnits(choose?: string): Promise<{ options: string[]; selected: string }> {
    await this.intoView('descriptionStartsWith("Usage unit: ")');
    await this.tap(this.selectors.usageUnit);
    await this.waitForVisible(this.selectors.sheetTitle('Usage unit'), 10_000, 'Usage unit');
    const options: string[] = [];
    let selected = '';
    for (const el of await $$('//android.widget.Button')) {
      const d = (await el.getAttribute('content-desc')) ?? '';
      if (!d || d === 'Close' || d === 'Cancel' || d === 'Save' || d.includes(': ')) continue;
      options.push(d);
      if ((await el.getAttribute('selected')) === 'true') selected = d;
    }
    await this.tap(choose ? this.selectors.option(choose) : this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle('Usage unit'), 5_000, 'Usage unit');
    return { options, selected };
  }

  /** Cancel on an unchanged form: closes it without a dialog; returns whether a dialog appeared. */
  async cancel(): Promise<boolean> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await driver.pause(1_500);
    return $(this.selectors.discardTitle).isExisting();
  }

  /** Cancel; reads the discard dialog; Cancel on the dialog keeps the form; returns what was seen. */
  async cancelThenKeep(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, SERVICE_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.dialogCancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, SERVICE_TEXTS.discardTitle);
    return seen;
  }

  /** Cancel; reads the discard dialog; Discard. */
  async discard(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, SERVICE_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.discard);
    return seen;
  }
}

export const newServicePage = new ServiceFormPage('New service');
export const editServicePage = new ServiceFormPage('Edit service');
