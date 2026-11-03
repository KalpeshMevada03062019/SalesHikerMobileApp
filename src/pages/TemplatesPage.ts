// WhatsApp > Templates (More > Templates): the list with status/category filters, search and
// "Sync from Meta"; a template's detail; and the New template form (Basics / Header / Body / Buttons).
// Live app on the phone, 2026-11-02/03; the web Templates page (features/templates in the web project) is
// the reference. Nothing here saves or submits a template: the form is only filled with invalid or
// partial input and then discarded.
import { BasePage, by } from './BasePage.js';

export const TEMPLATE_FILTERS = ['All', 'Approved', 'Pending', 'Rejected', 'Marketing', 'Utility', 'Authentication'] as const;
export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];
export const TEMPLATE_STATUSES = ['Approved', 'Pending', 'Rejected'] as const;
export const TEMPLATE_CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;
export const HEADER_TYPES = ['None', 'Text', 'Image', 'Video', 'Document'] as const;
export const BUTTON_TYPES = ['Quick reply', 'Website', 'Call'] as const;

export const TEMPLATE_TEXTS = {
  syncHint: 'Get new and changed templates.',
  noTemplates: 'No templates found',
  enterName: 'Enter a name',
  nameFormat: 'Use only lowercase letters, digits and underscores',
  enterBody: 'Enter the message text',
  noButtons: 'No buttons. Up to 10.',
  discardTitle: 'Discard changes?',
  discardMessage: 'Your changes are not saved.',
};

/** List row: content-desc "<name>, <language>, <category>, <status>, <buttons or "No buttons">[, <reject reason>]". */
export interface TemplateRow { name: string; language: string; category: string; status: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

export class TemplatesPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ templates?');

  readonly selectors = {
    moreEntry: by.a11y('Templates'),                      // More > WHATSAPP > Templates
    title: '//android.view.View[@text="Templates"]',
    count: this.marker,
    back: by.descClass('Back', 'android.widget.Button'),
    newTemplate: by.a11y('New template'),
    search: by.descClass('Search templates', 'android.widget.EditText'),
    clearSearch: by.a11y('Clear search'),
    filter: (name: TemplateFilter) => by.descClass(name, 'android.widget.Button'),
    syncHint: by.text(TEMPLATE_TEXTS.syncHint),
    sync: by.a11y('Sync from Meta'),
    syncing: by.text('Syncing…'),
    synced: by.textStartsWith('Synced from Meta'),            // "Synced from Meta today, 10:39"
    rows: '//android.widget.Button[contains(@content-desc, ", English, ") or contains(@content-desc, ", Approved") or contains(@content-desc, ", Rejected") or contains(@content-desc, ", Pending")]',
    row: (name: string) => by.descStartsWith(`${name}, `),
    noTemplates: by.text(TEMPLATE_TEXTS.noTemplates),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  /** Waits until the count line shows a number and rows (or the empty state) have loaded. */
  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noTemplates).isExisting(), {
      timeout, timeoutMsg: `Templates did not load within ${timeout} ms`,
    });
  }

  /** Filter chips scroll sideways; brings one into view, taps it and waits for it to be selected. */
  async selectFilter(name: TemplateFilter): Promise<void> {
    const chip = this.el(this.selectors.filter(name));
    const { width } = await driver.getWindowSize();
    for (let i = 0; i < 6; i++) {
      if (await chip.isExisting()) {
        const { x } = await chip.getLocation();
        const { width: w } = await chip.getSize();
        if (x > 2 && x + w < width - 2) break;
      }
      const later = TEMPLATE_FILTERS.indexOf(name) >= 4;   // Marketing, Utility, Authentication start off-screen
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: 262, width: width * 0.8, height: 84, direction: later ? 'left' : 'right', percent: 0.5 });
    }
    await chip.click();
    await driver.waitUntil(async () => (await chip.getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(1_500);   // list reloads
  }

  async selectedFilter(): Promise<string | null> {
    for (const f of TEMPLATE_FILTERS) {
      const chip = this.el(this.selectors.filter(f));
      if ((await chip.isExisting()) && (await chip.getAttribute('selected')) === 'true') return f;
    }
    return null;
  }

  async visibleRows(): Promise<TemplateRow[]> {
    const rows: TemplateRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const [name, language, category, status] = label.split(', ');
      rows.push({ name: name!, language: language!, category: category!, status: status!, label });
    }
    return rows;
  }

  async search(text: string): Promise<void> {
    const field = this.el(this.selectors.search);
    await field.waitForDisplayed();
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(1_500);   // filters as you type
  }

  async clearSearch(): Promise<void> {
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
  }

  async isEmptyStateShown(timeout = 10_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noTemplates, timeout); return true; } catch { return false; }
  }

  /**
   * Sync from Meta (only pulls new and changed templates; nothing is sent to Meta). Returns what the
   * app shows while it runs and the result line ("Synced from Meta today, 10:39").
   */
  async syncFromMeta(timeout = 90_000): Promise<{ sawSyncing: boolean; result: string }> {
    await this.tap(this.selectors.sync);
    const sawSyncing = await this.el(this.selectors.syncing).waitForExist({ timeout: 5_000 }).then(() => true, () => false);
    await this.el(this.selectors.syncing).waitForExist({ timeout, reverse: true, timeoutMsg: `Still syncing after ${timeout} ms` });
    const result = (await this.el(this.selectors.synced).isExisting()) ? await this.el(this.selectors.synced).getText() : '';
    return { sawSyncing, result };
  }

  async openTemplate(name: string): Promise<void> {
    await this.search(name);
    await this.tap(this.selectors.row(name));
  }

  async openNewTemplate(): Promise<void> {
    await this.tap(this.selectors.newTemplate);
  }
}

export class TemplateDetailPage extends BasePage {
  protected readonly marker = by.a11y('Template actions');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    preview: by.a11y('WhatsApp preview'),
    previewText: (t: string) => by.textContains(t),
    detail: (label: string) => by.descStartsWith(`${label}, `),       // "Status, Approved", "Category, Marketing", ...
    useInBroadcast: by.a11y('Use in Broadcast'),
    sendTemplate: by.a11y('Send Template'),
    actions: by.a11y('Template actions'),
    actionsSheet: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]/following::android.widget.Button[@content-desc="Close"]`,
    edit: by.descStartsWith('Edit, '),
    delete: by.descClass('Delete', 'android.widget.Button'),
    sheetClose: '//android.widget.Button[@content-desc="Close"]',
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isExisting();
  }

  /** Value of a DETAILS row ("Status" -> "Approved"); scrolls the details into view first. */
  async detail(label: string): Promise<string | null> {
    const el = this.el(this.selectors.detail(label));
    for (let i = 0; i < 3 && !(await el.isExisting()); i++) {
      const { width, height } = await driver.getWindowSize();
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction: 'up', percent: 0.8 });
    }
    if (!(await el.isExisting())) return null;
    return ((await el.getAttribute('content-desc')) ?? '').slice(label.length + 2);
  }

  /** Opens the actions menu and returns its options; closes it again without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.edit, 10_000, 'Template actions menu');
    const options: string[] = [];
    if (await this.el(this.selectors.edit).isExisting()) options.push('Edit');
    if (await this.el(this.selectors.delete).isExisting()) options.push('Delete');
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.edit, 5_000, 'Template actions menu');
    return options;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export type FormTab = 'Basics' | 'Header' | 'Body' | 'Buttons';

export class NewTemplatePage extends BasePage {
  protected readonly marker = '//android.view.View[@text="New template"]';

  readonly selectors = {
    tab: (name: FormTab) => by.descClass(name, 'android.widget.Button'),
    cancel: by.descClass('Cancel', 'android.widget.Button'),
    save: by.descClass('Save', 'android.widget.Button'),
    saveAndSubmit: by.a11y('Save and send for review'),
    preview: by.a11y('WhatsApp preview'),
    type: (name: 'Meta-approved template' | 'Regular (quick reply)') => by.descClass(name, 'android.widget.Button'),
    name: by.descClass('Name', 'android.widget.EditText'),
    language: by.descClass('Language code', 'android.widget.EditText'),
    category: (name: string) => by.descClass(name, 'android.widget.Button'),
    headerType: (name: string) => by.descClass(name, 'android.widget.Button'),
    message: by.descClass('Message', 'android.widget.EditText'),
    footer: by.descClass('Footer', 'android.widget.EditText'),
    addButton: by.a11y('Add button'),
    buttonType: (name: string) => by.descClass(name, 'android.widget.Button'),
    buttonText: by.descClass('Button text', 'android.widget.EditText'),
    removeButton: (n: number) => by.a11y(`Remove button ${n}`),
    text: (t: string) => `(//*[@text=${JSON.stringify(t)}])[1]`,
    discardTitle: by.text(TEMPLATE_TEXTS.discardTitle),
    discardMessage: by.text(TEMPLATE_TEXTS.discardMessage),
    discard: by.a11y('Discard'),
    keepEditing: '//android.view.View[@text="Discard changes?"]/following::android.widget.Button[@content-desc="Cancel"]',
  };

  async openTab(name: FormTab): Promise<void> {
    await this.hideKeyboard();
    await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollToBeginning(5)').isExisting().catch(() => false);
    await this.tap(this.selectors.tab(name));
    await driver.pause(500);
  }

  async isSelected(selector: string): Promise<boolean> {
    return (await this.el(selector).getAttribute('selected')) === 'true';
  }

  async setText(selector: string, value: string): Promise<void> {
    const field = this.el(selector);
    await field.click();
    await field.clearValue();
    if (value) await field.setValue(value);
    await this.hideKeyboard();
  }

  async value(selector: string): Promise<string> {
    return this.el(selector).getText();
  }

  /** Tries to submit while the form is invalid. Only call it with invalid input: nothing may be saved. */
  async trySubmitInvalid(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.saveAndSubmit);
    await driver.pause(1_500);
  }

  async isTextShown(t: string): Promise<boolean> {
    return this.el(this.selectors.text(t)).isExisting();
  }

  /** The preview's text (a TextView); the same text is also in the Message field (an EditText). */
  async previewShows(t: string): Promise<boolean> {
    return this.el(`(//android.widget.TextView[contains(@text, ${JSON.stringify(t)})])[1]`).isExisting();
  }

  /** Cancel; with unsaved changes the app asks "Discard changes?" and this discards them. */
  async cancelAndDiscard(): Promise<{ asked: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    const asked = await this.el(this.selectors.discardTitle).waitForDisplayed({ timeout: 4_000 }).then(() => true, () => false);
    const message = asked && (await this.el(this.selectors.discardMessage).isExisting());
    if (asked) await this.tap(this.selectors.discard);
    await this.waitForGone(this.marker, 10_000, 'New template form');
    return { asked, message };
  }
}

export const templatesPage = new TemplatesPage();
export const templateDetailPage = new TemplateDetailPage();
export const newTemplatePage = new NewTemplatePage();
