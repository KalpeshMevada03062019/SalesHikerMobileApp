// More > AI Agents: list with status filters and search, an agent's detail with its actions menu, and the
// read-only Knowledge, Memories, Performance and Test screens. Live app on the phone, 2026-11-03.
// Creating AI agents is not tested.
//
// Read only: on/off switches (they pause live agents), New agent, Edit, Delete, Add source and Run test are
// never tapped; the Test chat is opened but nothing is typed in it.
import { BasePage, by } from './BasePage.js';

export const AGENT_FILTERS = ['All', 'Live', 'Paused', 'Draft'] as const;
export type AgentFilter = (typeof AGENT_FILTERS)[number];
/** Statuses that partition the list. */
export const AGENT_STATUSES = ['Live', 'Paused', 'Draft'] as const;
export const AGENT_ACTIONS = ['Edit', 'Knowledge', 'Memories', 'Performance', 'Test', 'Delete'] as const;
export const OVERVIEW_FIELDS = ['Role', 'Reply mode', 'Tone', 'Instructions', 'Hand-off message'] as const;
export const MEMORY_TYPES = ['Fact', 'Preference', 'Context'] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const AGENT_TEXTS = {
  noAgents: 'No agents found',
  noAgentsHint: 'No agent matches this search or filter.',
  draftHint: 'Draft. Finish setup in Edit.',
  noNumber: 'No WhatsApp number',
  noNumberYet: 'No number yet. Add one in Edit, Numbers.',
  liveSwitch: 'Agent on. Pause',
  knowledgeHint: 'The agent answers from these sources.',
  sourceReady: 'Ready',
  performanceNotice: 'Nothing is sent to customers.',
  testNotice: 'Write as a customer. Nothing is sent to customers.',
};

/** List row (the Button left of the switch): content-desc "<name>, <status>". */
export interface AgentRow { name: string; status: string; numbers: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

/** Swipe the screen up/down, closing the keyboard first: swiping over Gboard glide-types into fields. */
async function scroll(direction: 'up' | 'down'): Promise<void> {
  if (await driver.isKeyboardShown()) await driver.hideKeyboard();
  const { width, height } = await driver.getWindowSize();
  await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction, percent: 0.7 });
}

/** The number shown next to a screen title ("Knowledge 3", "Memories 20"). */
const titleCount = (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following-sibling::android.widget.TextView[1]`;

export class AiAgentsPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ agents?');

  readonly selectors = {
    moreEntry: by.a11y('AI Agents'),                         // More > AI Agents
    count: this.marker,
    newAgent: by.a11y('New agent'),
    credits: by.textMatches('AI credits: [0-9,]+ left'),
    search: by.descClass('Search agents', 'android.widget.EditText'),
    searchField: '//android.widget.EditText',
    clearSearch: by.a11y('Clear search'),
    clearFilters: by.a11y('Clear Filters'),
    filter: (name: AgentFilter) => `android=new UiSelector().className("android.widget.Button").descriptionMatches(${JSON.stringify(`${name}, [0-9]+`)})`,
    rows: '//android.widget.Button[contains(@content-desc, ", Live") or contains(@content-desc, ", Draft") or contains(@content-desc, ", Paused")]',
    row: (name: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${name}, `)})]`,
    noAgents: by.text(AGENT_TEXTS.noAgents),
    noAgentsHint: by.text(AGENT_TEXTS.noAgentsHint),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noAgents).isExisting(), {
      timeout, timeoutMsg: `AI agents did not load within ${timeout} ms`,
    });
  }

  async filterCount(name: AgentFilter): Promise<number> {
    const label = (await this.el(this.selectors.filter(name)).getAttribute('content-desc')) ?? '';
    return Number(label.split(', ').pop());
  }

  async selectFilter(name: AgentFilter): Promise<void> {
    await this.tap(this.selectors.filter(name));
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(1_500);
  }

  /** Visible rows with their WhatsApp-number line ("1 WhatsApp number", "No WhatsApp number"). */
  async visibleRows(): Promise<AgentRow[]> {
    const rows: AgentRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const i = label.lastIndexOf(', ');
      const numbers = await el.$('.//android.widget.TextView[contains(@text, "WhatsApp number")]').getText().catch(() => '');
      rows.push({ name: label.slice(0, i), status: label.slice(i + 2), numbers, label });
    }
    return rows;
  }

  async search(text: string): Promise<void> {
    const field = this.el(this.selectors.searchField);
    await field.waitForDisplayed();
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(1_500);
  }

  async isEmptyStateShown(timeout = 10_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noAgents, timeout); return true; } catch { return false; }
  }

  async clearFilters(): Promise<void> {
    await this.tap(this.selectors.clearFilters);
    await this.waitForLoaded();
    await driver.pause(1_000);
  }

  /** Opens an agent by tapping its row (the name area, never the on/off switch next to it). */
  async openAgent(name: string): Promise<void> {
    await this.tap(`(${this.selectors.row(name)})[1]`);
  }
}

export class AiAgentDetailPage extends BasePage {
  protected readonly marker = by.a11y('Agent actions');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    status: '(//android.widget.TextView[@text="Live" or @text="Draft" or @text="Paused"])[1]',
    switch: '//android.widget.Switch',
    draftHint: by.text(AGENT_TEXTS.draftHint),
    noNumberBanner: by.textStartsWith(`${AGENT_TEXTS.noNumber}.`),
    metric: (name: 'Chats' | 'Replies' | 'Resolved') => by.descStartsWith(`${name} `),
    field: (name: string) => `(//android.widget.TextView[@text=${JSON.stringify(name)}]/following-sibling::android.widget.TextView[1])[1]`,
    numbersSection: by.text('WHATSAPP NUMBERS'),
    noNumberYet: by.text(AGENT_TEXTS.noNumberYet),
    knowledgeSources: by.textMatches('[0-9]+ sources?'),
    manageKnowledge: by.a11y('Manage knowledge'),
    actions: by.a11y('Agent actions'),
    action: (name: string) => (name === 'Test' ? by.descStartsWith('Test, ') : `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`),
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isExisting();
  }

  async status(): Promise<string> {
    return this.el(this.selectors.status).getText();
  }

  async hasSwitch(): Promise<boolean> {
    return this.el(this.selectors.switch).isExisting();
  }

  async switchLabel(): Promise<string> {
    return (await this.el(this.selectors.switch).getAttribute('content-desc')) ?? '';
  }

  /** "Chats 327" -> "327"; "Resolved 74%" -> "74%"; "Resolved None" -> "None". */
  async metric(name: 'Chats' | 'Replies' | 'Resolved'): Promise<string> {
    return ((await this.el(this.selectors.metric(name)).getAttribute('content-desc')) ?? '').slice(name.length + 1);
  }

  /** Value under an OVERVIEW label, scrolling down until the label and its value are on screen. */
  async field(name: string): Promise<string> {
    for (let i = 0; i < 5 && !(await this.el(this.selectors.field(name)).isExisting()); i++) await scroll('up');
    return this.el(this.selectors.field(name)).getText().catch(() => '');
  }

  /** Scrolls to KNOWLEDGE and returns its "N sources" count. */
  async knowledgeSources(): Promise<number> {
    for (let i = 0; i < 5 && !(await this.el(this.selectors.knowledgeSources).isExisting()); i++) await scroll('up');
    return num(await this.el(this.selectors.knowledgeSources).getText());
  }

  async hasNoNumberYet(): Promise<boolean> {
    for (let i = 0; i < 5 && !(await this.el(this.selectors.numbersSection).isExisting()); i++) await scroll('up');
    return this.el(this.selectors.noNumberYet).isExisting();
  }

  /** Opens the actions menu, reads every option and closes it without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.action('Edit'), 10_000, 'Agent actions menu');
    const found: string[] = [];
    for (const a of AGENT_ACTIONS) if (await this.el(this.selectors.action(a)).isExisting()) found.push(a);
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.action('Edit'), 5_000, 'Agent actions menu');
    return found;
  }

  /** Opens one of the read-only screens from the actions menu (never Edit or Delete). */
  async openFromActions(name: 'Knowledge' | 'Memories' | 'Performance' | 'Test'): Promise<void> {
    await this.tap(this.selectors.actions);
    await this.tap(this.selectors.action(name));
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

/** Knowledge sources of an agent (Add source is never tapped). */
export class AgentKnowledgePage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Knowledge"]';

  readonly selectors = {
    count: titleCount('Knowledge'),
    addSource: by.a11y('Add source'),
    hint: by.text(AGENT_TEXTS.knowledgeHint),
    sources: '//android.widget.Button[@content-desc!="Back" and @content-desc!="Add source"]',
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  /** Each source with its state ("Ready", ...). */
  async sources(): Promise<{ name: string; state: string }[]> {
    const out: { name: string; state: string }[] = [];
    for (const el of await $$(this.selectors.sources)) {
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push(await t.getText());
      out.push({ name: texts[0] ?? '', state: texts.find((t) => /^(Ready|Processing|Failed|Pending)/.test(t)) ?? '' });
    }
    return out;
  }
}

/** What the agent remembers about customers: count, search and type filters. */
export class AgentMemoriesPage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Memories"]';

  readonly selectors = {
    count: titleCount('Memories'),
    search: by.descClass('Search memories', 'android.widget.EditText'),
    filter: (name: 'All' | MemoryType) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    // Memory rows: "<memory>, <contact> · <date>".
    rowTypes: '//android.widget.Button[contains(@content-desc, " · ")]//android.widget.TextView[@text="Fact" or @text="Preference" or @text="Context"]',
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async selectFilter(name: 'All' | MemoryType): Promise<void> {
    await this.tap(this.selectors.filter(name));
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Memory filter "${name}" not selected` });
    await driver.pause(1_500);
  }

  async visibleTypes(): Promise<string[]> {
    const types: string[] = [];
    for (const el of await $$(this.selectors.rowTypes)) types.push(await el.getText());
    return types;
  }
}

/** Quality check: question-count options, Run test (never tapped) and past test runs. */
export class AgentPerformancePage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Performance"]';

  readonly selectors = {
    qualityCheck: '//android.view.View[@text="QUALITY CHECK"]',
    notice: by.textContains(AGENT_TEXTS.performanceNotice),
    questions: (n: 5 | 10) => by.a11y(`${n} questions`),
    runTest: by.a11y('Run test'),
    testRuns: '//android.view.View[@text="TEST RUNS"]',
    runScore: by.textMatches('[0-9]+%'),
    runSummary: by.textMatches('.* · [0-9]+ pass, [0-9]+ partial, [0-9]+ fail'),
  };
}

/** Test chat: the agent answers as if to a customer; nothing is typed by the tests. */
export class AgentTestPage extends BasePage {
  protected readonly marker = by.text(AGENT_TEXTS.testNotice);

  readonly selectors = {
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(`Test ${name}`)}]`,
    notice: this.marker,
    message: '//android.widget.EditText[@text="Message as a customer"]',   // the hint is exposed as text
    send: by.a11y('Send'),
    startAgain: by.a11y('Start again'),
  };
}

export const aiAgentsPage = new AiAgentsPage();
export const aiAgentDetailPage = new AiAgentDetailPage();
export const agentKnowledgePage = new AgentKnowledgePage();
export const agentMemoriesPage = new AgentMemoriesPage();
export const agentPerformancePage = new AgentPerformancePage();
export const agentTestPage = new AgentTestPage();
