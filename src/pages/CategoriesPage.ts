// More > INVENTORY > Categories: the list (count "N categories", search, one row per category name, no filter chips),
// a category's detail (name, status, PRODUCTS with "View N products", SUB-CATEGORIES, DETAILS), its actions menu
// (Edit, Rename, View PDF, Save PDF, Delete), the Rename sheet and the New / Edit category forms.
// Live app on the phone, 2026-11-17: 24 categories on beta; reference BEVERAGES (96 products, sort order 5).
//
// Read only: Save, View PDF, Save PDF and Delete are never chosen; Edit and Rename are opened and closed unchanged;
// the new form is filled and discarded.
import { BasePage, by } from './BasePage.js';
import { SalesListPage } from './SalesDocumentPages.js';

export const CATEGORY_ACTIONS = ['Edit', 'Rename', 'View PDF', 'Save PDF', 'Delete'] as const;

export const CATEGORY_TEXTS = {
  searchHint: 'Search categories',
  noResults: 'No categories found',
  noResultsHint: 'Try another name.',
  noSubCategories: 'No sub-categories.',
  sortHint: 'Lower numbers show first.',
  noParent: 'No parent',
  noOne: 'No one',
  discardTitle: 'Discard this category?',
  discardMessage: 'This category is not saved yet.',
};

const ROW = '//android.widget.Button[count(.//android.widget.TextView) = 1 and @content-desc != "Clear search"]';

class CategoryListPage extends SalesListPage {
  readonly category = {
    row: ROW,
    endOfList: by.textStartsWith('End of list.'),               // "End of list. 24 categories."
    emptyClear: '(//android.widget.Button[@content-desc="Clear search"])[last()]',   // the empty state's own button
  };

  /** Names of the rows on screen, top to bottom. */
  async visibleNames(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.category.row)) out.push(((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' '));
    return out.filter(Boolean);
  }

  /** Every category name, scrolling down to "End of list.", then back to the top. */
  async allNames(): Promise<string[]> {
    const seen: string[] = [];
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 15; i++) {
      for (const n of await this.visibleNames()) if (!seen.includes(n)) seen.push(n);
      if (await $(this.category.endOfList).isDisplayed().catch(() => false)) break;
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.5, direction: 'down', percent: 0.7 });
    }
    for (let i = 0; i < 6; i++) await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.5, direction: 'up', percent: 1 });
    return seen;
  }

  async endOfListText(): Promise<string> {
    return $(this.category.endOfList).getText().catch(() => '');
  }

  /** The empty state offers "Clear search" (not "Clear filters"). */
  override async clearFromEmptyState(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.category.emptyClear);
    await this.waitForGone(this.selectors.noResults, 60_000, CATEGORY_TEXTS.noResults);
    await this.waitForLoaded();
  }
}

export const categoriesPage = new CategoryListPage({
  title: 'Categories',
  searchHint: CATEGORY_TEXTS.searchHint,
  statuses: [],
  noResults: CATEGORY_TEXTS.noResults,
  noResultsHint: CATEGORY_TEXTS.noResultsHint,
  newButton: 'New category',
  minRowTexts: 1,
});

const STATUS = '(//android.widget.TextView[@text="Active" or @text="Inactive"])[1]';

class CategoryDetailPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="SUB-CATEGORIES"]';
  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    name: `${STATUS}/preceding-sibling::android.view.View[1]`,
    status: STATUS,
    count: (section: string) => `//android.view.View[@text=${JSON.stringify(section)}]/following-sibling::android.widget.TextView[1]`,
    viewProducts: by.descStartsWith('View '),                // "View 96 products"
    noSubCategories: by.text(CATEGORY_TEXTS.noSubCategories),
    field: (label: string) => `//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1]`,
    actions: by.a11y('More actions'),
    menuTitle: by.text('Category actions'),
    action: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
    renameTitle: '//android.view.View[@text="Rename category"]',
    renameName: by.a11y('Category name'),
    renameSave: '//android.widget.Button[@content-desc="Save"]',   // never tapped
  };

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  async field(label: string): Promise<string> {
    return this.text(this.selectors.field(label));
  }

  async viewProductsLabel(): Promise<string> {
    return (await $(this.selectors.viewProducts).getAttribute('content-desc').catch(() => '')) ?? '';
  }

  async openProducts(): Promise<void> {
    await this.tap(this.selectors.viewProducts);
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }

  /** Opens the actions menu, reads each expected option (label and enabled) and closes it without choosing. */
  async actionOptions(expected: readonly string[]): Promise<{ label: string; enabled: boolean }[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Category actions');
    const found: { label: string; enabled: boolean }[] = [];
    for (const a of expected) {
      const el = await $$(this.selectors.action(a));
      if (el.length) found.push({ label: a, enabled: (await el[0]!.getAttribute('enabled')) === 'true' });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuTitle, 5_000, 'Category actions');
    return found;
  }

  /** More actions > Edit or Rename (opens it; nothing is saved). */
  async openAction(name: 'Edit' | 'Rename'): Promise<void> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.menuTitle, 10_000, 'Category actions');
    await this.tap(this.selectors.action(name));
  }

  /** Rename sheet: reads the name and whether Save is offered, then closes it without saving. */
  async readRename(): Promise<{ name: string; save: boolean }> {
    await this.openAction('Rename');
    await this.waitForVisible(this.selectors.renameTitle, 10_000, 'Rename category');
    const seen = { name: await this.text(this.selectors.renameName), save: await $(this.selectors.renameSave).isExisting() };
    await this.hideKeyboard().catch(() => undefined);
    if (await $(this.selectors.renameTitle).isExisting()) await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.renameTitle, 5_000, 'Rename category');
    return seen;
  }
}

export const categoryDetailPage = new CategoryDetailPage();

const formSelectors = {
  cancel: by.a11y('Cancel'),
  save: by.a11y('Save'),                                   // never tapped
  name: by.a11y('Category name'),
  parent: by.descStartsWith('Parent category: '),          // "Parent category: No parent"
  description: by.a11y('Description'),
  sortOrder: by.a11y('Sort order'),
  sortHint: by.text(CATEGORY_TEXTS.sortHint),
  assignedTo: by.descStartsWith('Assigned to: '),          // "Assigned to: No one"
  active: '//android.widget.Switch[@content-desc="Active"]',
  parentTitle: '//android.view.View[@text="Parent category"]',
  parentSearch: by.a11y('Search categories'),
  sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  discardTitle: by.text(CATEGORY_TEXTS.discardTitle),
  discardMessage: by.text(CATEGORY_TEXTS.discardMessage),
  discard: by.a11y('Discard'),
  dialogCancel: '//android.widget.Button[@content-desc="Cancel" and following-sibling::android.widget.Button[@content-desc="Discard"]]',
};

export interface CategoryForm { name: string; parent: string; description: string; sortOrder: string; sortHint: boolean; assignedTo: string; active: boolean }

/** The New category and Edit category forms (one screen, no scrolling). */
class CategoryFormPage extends BasePage {
  protected readonly marker: string;
  readonly selectors = formSelectors;

  constructor(title: string) {
    super();
    this.marker = `//android.view.View[@text=${JSON.stringify(title)}]`;
  }

  async read(): Promise<CategoryForm> {
    const s = this.selectors;
    const txt = (sel: string) => $(sel).getText().catch(() => '');
    const desc = async (sel: string) => (await $(sel).getAttribute('content-desc').catch(() => '')) ?? '';
    return { name: await txt(s.name), parent: await desc(s.parent), description: await txt(s.description), sortOrder: await txt(s.sortOrder),
      sortHint: await $(s.sortHint).isExisting(), assignedTo: await desc(s.assignedTo), active: (await $(s.active).getAttribute('checked')) === 'true' };
  }

  /** Opens the Parent category picker, searches `term`, returns the options found and closes the picker. */
  async parentOptions(term: string): Promise<string[]> {
    await this.tap(this.selectors.parent);
    await this.waitForVisible(this.selectors.parentTitle, 10_000, 'Parent category');
    const search = $(this.selectors.parentSearch);
    await search.click();
    await search.setValue(term);
    await driver.pause(2_000);
    const out: string[] = [];
    for (const el of await $$('//android.widget.Button')) {
      const d = (await el.getAttribute('content-desc')) ?? '';
      if (d && d !== 'Close' && !d.includes(': ')) out.push(d);
    }
    await this.tap(this.selectors.sheetClose);         // Close first: Back with the keyboard down would close the sheet anyway
    await this.waitForGone(this.selectors.parentTitle, 5_000, 'Parent category');
    await this.hideKeyboard();
    return out;
  }

  async setName(value: string): Promise<void> {
    const el = $(this.selectors.name);
    await el.click();
    await el.setValue(value);
    await this.hideKeyboard();
  }

  /** Cancel on an unchanged form: closes it; returns whether a discard dialog appeared. */
  async cancel(): Promise<boolean> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await driver.pause(1_500);
    return $(this.selectors.discardTitle).isExisting();
  }

  /** Cancel; reads the discard dialog; Cancel on the dialog keeps the form. */
  async cancelThenKeep(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, CATEGORY_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.dialogCancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, CATEGORY_TEXTS.discardTitle);
    return seen;
  }

  /** Cancel; reads the discard dialog; Discard. */
  async discard(): Promise<{ title: boolean; message: boolean }> {
    await this.hideKeyboard();
    await this.tap(this.selectors.cancel);
    await this.waitForVisible(this.selectors.discardTitle, 10_000, CATEGORY_TEXTS.discardTitle);
    const seen = { title: true, message: await $(this.selectors.discardMessage).isExisting() };
    await this.tap(this.selectors.discard);
    return seen;
  }
}

export const newCategoryPage = new CategoryFormPage('New category');
export const editCategoryPage = new CategoryFormPage('Edit category');
