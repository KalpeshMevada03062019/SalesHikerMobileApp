// WhatsApp > Chatbots (More > Chatbots): list with status filters and search, and a chatbot's detail with
// its actions menu and Test simulator. Live app on the phone, 2026-11-03; the web project's chatbot
// scenarios (features/chatbots) are the reference. Creating chatbots is not tested.
//
// Read only: on/off switches (they pause live chatbots), New chatbot, Send test, Duplicate, Archive and
// Delete are never tapped; the Test simulator is opened but nothing is typed in it.
import { BasePage, by } from './BasePage.js';

export const CHATBOT_FILTERS = ['All', 'Active', 'Paused', 'Draft', 'Archived', 'Attention'] as const;
export type ChatbotFilter = (typeof CHATBOT_FILTERS)[number];
/** Statuses that partition the list (Attention is a flag on top of a status). */
export const CHATBOT_STATUSES = ['Active', 'Paused', 'Draft', 'Archived'] as const;
export const CHATBOT_ACTIONS = ['Settings', 'Test', 'Send test', 'Sessions', 'Analytics', 'Versions', 'Duplicate', 'Archive', 'Delete'] as const;

export const CHATBOT_TEXTS = {
  noChatbots: 'No chatbots found',
  draftSwitch: 'Publish on the web to turn on.',
  exactKeyword: 'Starts when a message is exactly a keyword.',
  testNotice: 'Send a message to start the draft flow. Nothing is sent to WhatsApp.',
};

/** List row (the Button left of the switch): content-desc "<name>, <status>". */
export interface ChatbotRow { name: string; status: string; trigger: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

/** Swipe the screen up/down, closing the keyboard first: swiping over Gboard glide-types into fields. */
async function scroll(direction: 'up' | 'down'): Promise<void> {
  if (await driver.isKeyboardShown()) await driver.hideKeyboard();
  const { width, height } = await driver.getWindowSize();
  await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction, percent: 0.7 });
}

export class ChatbotsPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ chatbots?');

  readonly selectors = {
    moreEntry: by.a11y('Chatbots'),                         // More > WHATSAPP > Chatbots
    count: this.marker,
    newChatbot: by.a11y('New chatbot'),
    search: by.descClass('Search chatbots', 'android.widget.EditText'),
    clearSearch: by.a11y('Clear search'),
    filter: (name: ChatbotFilter) => `android=new UiSelector().className("android.widget.Button").descriptionMatches(${JSON.stringify(`${name}, [0-9]+`)})`,
    rows: '//android.widget.Button[contains(@content-desc, ", Active") or contains(@content-desc, ", Draft") or contains(@content-desc, ", Paused") or contains(@content-desc, ", Archived")]',
    row: (name: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${name}, `)})]`,
    noChatbots: by.text(CHATBOT_TEXTS.noChatbots),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noChatbots).isExisting(), {
      timeout, timeoutMsg: `Chatbots did not load within ${timeout} ms`,
    });
  }

  /** Chips scroll sideways (Archived and Attention start off-screen). */
  private async chipInView(name: ChatbotFilter): Promise<WebdriverIO.Element> {
    const chip = this.el(this.selectors.filter(name));
    const { width } = await driver.getWindowSize();
    const later = CHATBOT_FILTERS.indexOf(name) >= 3;
    for (let i = 0; i < 6; i++) {
      if (await chip.isExisting()) {
        const { x } = await chip.getLocation();
        const { width: w } = await chip.getSize();
        if (x > 2 && x + w < width - 2) return chip.getElement();
      }
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: 262, width: width * 0.8, height: 84, direction: later ? 'left' : 'right', percent: 0.5 });
    }
    return chip.getElement();
  }

  async filterCount(name: ChatbotFilter): Promise<number> {
    const label = (await (await this.chipInView(name)).getAttribute('content-desc')) ?? '';
    return Number(label.split(', ').pop());
  }

  async selectFilter(name: ChatbotFilter): Promise<void> {
    const chip = await this.chipInView(name);
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(1_500);
  }

  /** Visible rows with their trigger line ("Keyword: tour, menu"). */
  async visibleRows(): Promise<ChatbotRow[]> {
    const rows: ChatbotRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const i = label.lastIndexOf(', ');
      const trigger = await el.$('.//android.widget.TextView[starts-with(@text, "Keyword") or starts-with(@text, "Manual") or starts-with(@text, "Any")]').getText().catch(() => '');
      rows.push({ name: label.slice(0, i), status: label.slice(i + 2), trigger, label });
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
    await driver.pause(1_500);
  }

  async isEmptyStateShown(timeout = 10_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noChatbots, timeout); return true; } catch { return false; }
  }

  /** Opens a chatbot by tapping its row (the name area, never the on/off switch next to it). */
  async openChatbot(name: string): Promise<void> {
    await this.tap(`(${this.selectors.row(name)})[1]`);
  }
}

export class ChatbotDetailPage extends BasePage {
  protected readonly marker = by.a11y('Chatbot actions');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    status: '(//android.widget.TextView[@text="Active" or @text="Draft" or @text="Paused" or @text="Archived"])[1]',
    switch: '//android.widget.Switch',
    draftHint: by.text(CHATBOT_TEXTS.draftSwitch),
    metric: (name: 'Sessions' | 'Completion' | 'Hand-offs') => `(//android.widget.TextView[@text=${JSON.stringify(name)}]/following-sibling::android.widget.TextView[1])[1]`,
    keywordsSection: by.text('TRIGGER KEYWORDS'),
    exactHint: by.text(CHATBOT_TEXTS.exactKeyword),
    numbersSection: by.text('WHATSAPP NUMBERS'),
    flowSection: by.text('FLOW'),
    flowSteps: by.textMatches('[0-9]+ steps? in the draft'),
    actions: by.a11y('Chatbot actions'),
    action: (name: string) => by.descStartsWith(name === 'Sessions' || name === 'Analytics' || name === 'Versions' || name === 'Archive' || name === 'Delete' ? name : `${name}, `),
    sheetClose: '//android.widget.Button[@content-desc="Close"]',
    testNotice: by.text(CHATBOT_TEXTS.testNotice),
    testMessage: by.descClass('Message', 'android.widget.EditText'),
    startAgain: by.a11y('Start again'),
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isExisting();
  }

  async status(): Promise<string> {
    return this.el(this.selectors.status).getText();
  }

  async switchLabel(): Promise<string> {
    return (await this.el(this.selectors.switch).getAttribute('content-desc')) ?? '';
  }

  async metric(name: 'Sessions' | 'Completion' | 'Hand-offs'): Promise<string> {
    return this.el(this.selectors.metric(name)).getText();
  }

  /** Whether a keyword chip is shown under TRIGGER KEYWORDS (each chip is labelled with its keyword). */
  async hasKeyword(word: string): Promise<boolean> {
    return this.el(`//android.view.ViewGroup[@content-desc=${JSON.stringify(word)}]`).isExisting();
  }

  async scrollToFlow(): Promise<void> {
    for (let i = 0; i < 4 && !(await this.el(this.selectors.flowSteps).isExisting()); i++) await scroll('up');
  }

  /** Opens the actions menu, reads every option (scrolling the sheet) and closes it without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.action('Settings'), 10_000, 'Chatbot actions menu');
    const found: string[] = [];
    for (let i = 0; i < 3; i++) {
      for (const a of ['Settings', 'Test', 'Send test', 'Sessions', 'Analytics', 'Versions', 'Duplicate', 'Archive', 'Delete']) {
        if (!found.includes(a) && (await this.el(this.selectors.action(a)).isExisting())) found.push(a);
      }
      const { width, height } = await driver.getWindowSize();
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.7, width: width * 0.8, height: height * 0.2, direction: 'up', percent: 0.6 });
    }
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.action('Settings'), 5_000, 'Chatbot actions menu');
    // Keep the pipeline order for comparison.
    return ['Settings', 'Test', 'Send test', 'Sessions', 'Analytics', 'Versions', 'Duplicate', 'Archive', 'Delete'].filter((a) => found.includes(a));
  }

  /** Opens the Test simulator (types nothing) and returns whether its "nothing is sent" notice is shown. */
  async openTestSimulator(): Promise<boolean> {
    await this.tap(this.selectors.actions);
    await this.tap(this.selectors.action('Test'));
    await this.waitForVisible(this.selectors.testMessage, 10_000, 'Test simulator');
    return this.el(this.selectors.testNotice).isExisting();
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}


export const chatbotsPage = new ChatbotsPage();
export const chatbotDetailPage = new ChatbotDetailPage();
