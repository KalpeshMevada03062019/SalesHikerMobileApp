// More > CRM > Documents: the list with search and a per-document actions sheet, and the document detail
// (reached through Actions > Details) with its More actions sheet. Live app on the phone, 2026-11-05.
//
// Read only: Upload document, Open, Download, Share, Rename and Delete are never tapped (Open and Download
// may count as a download), and a row itself is never tapped (it may open the file).
import { BasePage, by } from './BasePage.js';

export const DOCUMENT_ACTIONS = ['Open', 'Download', 'Share', 'Details'] as const;
export const DOCUMENT_MORE_ACTIONS = ['Rename', 'Delete'] as const;

export const DOCUMENT_TEXTS = {
  searchHint: 'Search documents',
  noDocuments: 'No documents found',
  noDocumentsHint: 'Try another search or folder.',
  openHint: 'Opens on this phone. Download saves or shares the file.',
  notLinked: 'Not linked to any record.',
};

/** List row: content-desc "<name>, <date>, <size>, <folder>". */
export interface DocumentRow { name: string; date: string; size: string; folder: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

export class DocumentsPage extends BasePage {
  protected readonly marker = by.a11y(DOCUMENT_TEXTS.searchHint);

  readonly selectors = {
    moreEntry: by.a11y('Documents'),                          // More > CRM > Documents
    count: '//android.view.View[@text="Documents"]/following-sibling::android.widget.TextView[1]',   // "5" under the title
    upload: by.a11y('Upload document'),                       // never tapped
    search: by.a11y(DOCUMENT_TEXTS.searchHint),               // EditText; its text is the hint or the query
    clearSearch: by.a11y('Clear search'),
    clearFilters: by.a11y('Clear Filters'),                   // on the empty state
    rows: '//android.widget.Button[count(.//android.widget.TextView) >= 4]',
    // Not "~...": WebdriverIO reads a selector ending in .jpg / .png as an image file to compare.
    actions: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(`Actions for ${name}`)}]`,
    footer: by.textMatches('Showing [0-9,]+ of [0-9,]+ documents?'),
    noDocuments: by.text(DOCUMENT_TEXTS.noDocuments),
    noDocumentsHint: by.text(DOCUMENT_TEXTS.noDocumentsHint),
    sheetTitle: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    sheetOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async count(): Promise<number> {
    return num(await $(this.selectors.count).getText());
  }

  /** "Showing 3 of 5 documents" -> { shown: 3, total: 5 }. */
  async footer(): Promise<{ shown: number; total: number }> {
    const [shown, total] = ((await $(this.selectors.footer).getText()).match(/[0-9,]+/g) ?? []).map(num);
    return { shown: shown ?? NaN, total: total ?? NaN };
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || $(this.selectors.noDocuments).isExisting(), {
      timeout, timeoutMsg: `Documents did not load within ${timeout} ms`,
    });
  }

  async visibleRows(): Promise<DocumentRow[]> {
    const rows: DocumentRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (texts.length < 4) continue;
      const [name, date, size, folder] = texts as [string, string, string, string];
      rows.push({ name, date, size, folder });
    }
    return rows;
  }

  async search(text: string): Promise<void> {
    const field = $(this.selectors.search);
    await field.waitForDisplayed();
    if (await $(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(2_500);
    await this.waitForLoaded();
  }

  async isEmptyStateShown(timeout = 10_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noDocuments, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.clearFilters);
    await this.waitForGone(this.selectors.noDocuments, 10_000, DOCUMENT_TEXTS.noDocuments);
    await this.waitForLoaded();
  }

  /** Opens a document's Actions sheet and returns the options found (nothing is chosen). */
  async openActions(name: string): Promise<string[]> {
    await this.tap(this.selectors.actions(name));
    await this.waitForVisible(this.selectors.sheetTitle(name), 10_000, `actions for ${name}`);
    const found: string[] = [];
    for (const a of DOCUMENT_ACTIONS) if (await $(this.selectors.sheetOption(a)).isExisting()) found.push(a);
    return found;
  }

  async closeActions(name: string): Promise<void> {
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle(name), 5_000, `actions for ${name}`);
  }

  /** Actions > Details: the only way into a document that cannot open the file. */
  async openDetails(name: string): Promise<void> {
    await this.openActions(name);
    await this.tap(this.selectors.sheetOption('Details'));
  }
}

export class DocumentDetailPage extends BasePage {
  protected readonly marker = by.a11y('Document summary');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    share: '(//android.widget.Button[@content-desc="Share"])[1]',   // never tapped
    moreActions: by.a11y('More actions'),
    // The "Document summary" group is empty: the name, the code and the status are its siblings.
    name: '(//android.widget.TextView[starts-with(@text, "DOC")]/preceding-sibling::android.view.View[1])[1]',
    code: by.textMatches('DOC[0-9]+'),
    status: '//android.widget.TextView[starts-with(@text, "DOC")]/following-sibling::android.widget.TextView[1]',
    value: (label: string) => `(//android.widget.TextView[@text=${JSON.stringify(label)}]/following-sibling::android.widget.TextView[1])[1]`,
    openHint: by.text(DOCUMENT_TEXTS.openHint),
    download: '(//android.widget.Button[@content-desc="Download"])[1]',   // never tapped
    open: '(//android.widget.Button[@content-desc="Open"])[1]',           // never tapped
    menuOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  async value(label: string): Promise<string> {
    return this.text(this.selectors.value(label));
  }

  /** Opens More actions, reads the options and closes it without choosing. */
  async moreActionOptions(): Promise<string[]> {
    await this.tap(this.selectors.moreActions);
    await this.waitForVisible(this.selectors.sheetClose, 10_000, 'More actions');
    const found: string[] = [];
    for (const a of DOCUMENT_MORE_ACTIONS) if (await $(this.selectors.menuOption(a)).isExisting()) found.push(a);
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.menuOption(DOCUMENT_MORE_ACTIONS[0]), 5_000, 'More actions');
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const documentsPage = new DocumentsPage();
export const documentDetailPage = new DocumentDetailPage();
