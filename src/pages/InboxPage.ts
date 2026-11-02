// Inbox tab (WhatsApp chats) and a chat with its composer and "Send Template" sheet.
// Live app on the phone, 2026-11-02. Nothing here sends on its own: only ChatPage.sendSelectedTemplate()
// taps the sheet's "Send Template", and the send spec calls it after checking the recipient.
import { BasePage, by } from './BasePage.js';
import { e164 } from './BroadcastsPage.js';

export const INBOX_TEXTS = {
  closedWindowHint: 'No customer message yet. Send a template to start the chat, or add a note for your team.',
  chooseTemplate: 'Choose a template to send.',
  enterValue: 'Enter a value.',
  noTemplates: 'No templates found',
  noTemplatesHint: 'No templates match this search or category.',
  notSent: 'Template not sent',
};

export const TEMPLATE_CATEGORIES = ['All', 'Marketing', 'Utility', 'Authentication'] as const;

export class InboxPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ chats? · [0-9,]+ unread');

  readonly selectors = {
    tab: by.a11y('Inbox'),                                        // bottom navigation
    counts: this.marker,                                          // "17 chats · 0 unread"
    views: (name: 'All' | 'Mine' | 'Unassigned') => by.descClass(name, 'android.widget.RadioButton'),
    openSearch: by.descClass('Search conversations', 'android.widget.Button'),
    search: by.descClass('Search conversations', 'android.widget.EditText'),
    clearSearch: by.a11y('Clear search'),
    // Search hits: "<name>, <+phone>" (contact) and "<name>, <time>, <last message>" (chat).
    hits: '//android.widget.Button[contains(@content-desc, ", ") and not(contains(@content-desc, "+"))]',
  };

  async open(): Promise<void> {
    await this.tap(this.selectors.tab);
    await this.waitForDisplayed(30_000);
  }

  async counts(): Promise<{ chats: number; unread: number }> {
    const [chats, unread] = (await this.el(this.selectors.counts).getText()).match(/[0-9,]+/g)!.map((n) => Number(n.replace(/,/g, '')));
    return { chats: chats!, unread: unread! };
  }

  /** Searches by phone digits and opens the chat (not the contact) hit. */
  async openChatByPhone(phone: string): Promise<void> {
    await this.tap(this.selectors.openSearch);
    const field = this.el(this.selectors.search);
    await field.waitForDisplayed();
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(phone.replace(/^\+91/, '').replace(/\D/g, ''));
    await this.hideKeyboard();
    await this.waitForVisible(`(${this.selectors.hits})[1]`, 20_000, `Chat for ${phone} in the search results`);
    await this.tap(`(${this.selectors.hits})[1]`);
  }
}

export interface ChatBubble { label: string; time: string; failed: string | null }

export class ChatPage extends BasePage {
  protected readonly marker = by.descStartsWith('Back to Inbox');

  readonly selectors = {
    back: by.a11y('Back to Inbox'),
    header: '//android.widget.Button[contains(@content-desc, ". Open contact")]',
    windowClosed: by.text('Window closed'),
    closedHint: by.text(INBOX_TEXTS.closedWindowHint),
    attachDisabled: by.a11y('Attach file. Needs an open window'),
    internalNote: by.a11y('Internal note'),
    // The composer's "Send Template" comes last in the hierarchy; the sheet's comes first.
    composerSendTemplate: '(//android.widget.Button[@content-desc="Send Template"])[last()]',
    sheetTitle: '//android.view.View[@text="Send Template"]',
    sheetSend: '(//android.widget.Button[@content-desc="Send Template"])[1]',
    sheetClose: '//android.widget.Button[@content-desc="Close"]',
    templateSearch: by.a11y('Search templates'),
    clearSearch: by.a11y('Clear search'),
    category: (name: string) => by.descClass(name, 'android.widget.Button'),   // All / Marketing / Utility / Authentication
    templateRows: '//android.widget.Button[contains(@content-desc, ", Approved") or contains(@content-desc, ", Rejected") or contains(@content-desc, ", Pending")]',
    templateRow: (name: string) => by.descStartsWith(`${name}, `),
    preview: by.text('Preview'),
    fullPreview: by.a11y('Full Preview'),
    variable: (n: number) => by.a11y(`Value for {{${n}}}`),
    text: (t: string) => `(//*[@text=${JSON.stringify(t)}])[1]`,
    notSent: '//android.view.View[starts-with(@content-desc, "Template not sent, ")]',
    dismiss: by.a11y('Dismiss'),
    bubbles: '//android.view.ViewGroup[contains(@content-desc, ", ") and string-length(@content-desc) > 12]',
  };

  /** "Kalpesh Mevada, +91 91734 49831. Open contact" -> { name, phone: "+919173449831" } */
  async recipient(): Promise<{ name: string; phone: string }> {
    const label = (await this.el(this.selectors.header).getAttribute('content-desc')) ?? '';
    const m = /^(.*), (\+[\d ]+)\. Open contact$/.exec(label);
    if (!m) throw new Error(`Chat header not in the expected format: "${label}"`);
    return { name: m[1]!, phone: e164(m[2]!) };
  }

  async isWindowClosed(): Promise<boolean> {
    return this.el(this.selectors.windowClosed).isExisting();
  }

  // ---- template sheet
  async openTemplateSheet(): Promise<void> {
    await this.hideKeyboard();
    if (await this.el(this.selectors.sheetTitle).isExisting()) return;
    await this.tap(this.selectors.composerSendTemplate);
    await this.waitForVisible(this.selectors.templateSearch, 15_000, 'Send Template sheet');
  }

  async closeTemplateSheet(): Promise<void> {
    await this.hideKeyboard();
    if (await this.el(this.selectors.sheetTitle).isExisting()) await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle, 5_000, 'Send Template sheet');
  }

  /**
   * Searches the sheet. The field keeps the previous search and typing after a tap inserts in the middle
   * of it (MBRD-D02), so it is cleared with its X first. Returns the template names listed.
   */
  async searchTemplates(text: string): Promise<string[]> {
    await this.openTemplateSheet();
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    const field = this.el(this.selectors.templateSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(1_000);   // results filter as you type
    const names: string[] = [];
    for (const el of await $$(this.selectors.templateRows)) names.push(((await el.getAttribute('content-desc')) ?? '').split(', ')[0]!);
    return names;
  }

  async isTextShown(t: string): Promise<boolean> {
    return this.el(this.selectors.text(t)).isExisting();
  }

  async chooseCategory(name: (typeof TEMPLATE_CATEGORIES)[number]): Promise<void> {
    await this.tap(this.selectors.category(name));
  }

  /** Selects a template in the sheet (search first, so it is on screen). Sends nothing. */
  async selectTemplate(name: string): Promise<void> {
    const names = await this.searchTemplates(name);
    if (!names.includes(name)) throw new Error(`Template "${name}" is not offered (found: ${names.join(', ') || 'none'})`);
    await this.tap(this.selectors.templateRow(name));
    await this.waitForVisible(this.selectors.preview, 10_000, `Preview of "${name}"`);
  }

  /** Number of "Value for {{n}}" fields the selected template asks for. */
  async variableCount(): Promise<number> {
    let n = 0;
    while (await this.el(this.selectors.variable(n + 1)).isExisting()) n++;
    return n;
  }

  async fillVariables(values: string[]): Promise<void> {
    for (const [i, value] of values.entries()) {
      const field = this.el(this.selectors.variable(i + 1));
      await field.click();
      await field.setValue(value);
      await this.hideKeyboard();
    }
  }

  /** Text of the preview (first text under "Preview"). */
  async previewContains(text: string): Promise<boolean> {
    return this.el(by.textContains(text)).isExisting();
  }

  // ---- bubbles and sending
  async bubbleLabels(): Promise<string[]> {
    const labels: string[] = [];
    for (const el of await $$(this.selectors.bubbles)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      if (/, \d{1,2}:\d{2}/.test(label)) labels.push(label);
    }
    return labels;
  }

  /**
   * The only call that sends. Taps the sheet's "Send Template" once, then reports either the new message
   * bubble or the app's "Template not sent" reason. Never retried.
   */
  async sendSelectedTemplate(timeout = 20_000): Promise<{ sent: boolean; reason: string; bubble: string }> {
    const before = new Set(await this.bubbleLabels());
    await this.tap(this.selectors.sheetSend);
    let result = { sent: false, reason: '', bubble: '' };
    await driver.waitUntil(async () => {
      const failure = this.el(this.selectors.notSent);
      if (await failure.isExisting()) {
        result = { sent: false, reason: ((await failure.getAttribute('content-desc')) ?? '').replace('Template not sent, ', ''), bubble: '' };
        return true;
      }
      if (await this.el(this.selectors.sheetTitle).isExisting()) return false;
      const fresh = (await this.bubbleLabels()).filter((b) => !before.has(b));
      if (fresh.length) { result = { sent: true, reason: '', bubble: fresh.at(-1)! }; return true; }
      return false;
    }, { timeout, timeoutMsg: `No new message and no error within ${timeout} ms after Send Template` });
    if (!result.sent) {
      if (await this.el(this.selectors.dismiss).isExisting()) await this.tap(this.selectors.dismiss);
      if (await this.el(this.selectors.sheetTitle).isExisting()) await this.closeTemplateSheet();
    }
    return result;
  }
}

export const inboxPage = new InboxPage();
export const chatPage = new ChatPage();
