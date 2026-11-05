// More > CRM > Workflows: list with status filters and search, a workflow's detail (stats, trigger, steps,
// runs) with its actions menu, and a run's steps. Live app on the phone, 2026-11-03. Creating workflows is
// not tested.
//
// Read only: on/off switches, New workflow, Edit flow on web and every action in the menu (Run now, Rename,
// Duplicate, Delete) are never tapped.
import { BasePage, by } from './BasePage.js';

export const WORKFLOW_FILTERS = ['All', 'Active', 'Draft'] as const;
export type WorkflowFilter = (typeof WORKFLOW_FILTERS)[number];
export const WORKFLOW_STATUSES = ['Active', 'Draft'] as const;
export const WORKFLOW_ACTIONS = ['Run now', 'Rename', 'Duplicate', 'Delete'] as const;

export const WORKFLOW_TEXTS = {
  noWorkflows: 'No workflows found',
  noWorkflowsHint: 'No workflow matches this search or filter.',
  liveSwitch: 'Workflow on. Pause',
  connectHint: 'Connect the trigger to an action on the web to activate.',
  noRuns: 'No runs yet',
  noRunsDetail: 'No runs yet. They show here once the trigger fires.',
  fixOnWeb: 'Fix the step on the web app.',
};

/** List row (the Button left of the switch): content-desc "<name>, <status>"; texts name, status, trigger, runs. */
export interface WorkflowRow { name: string; status: string; trigger: string; runs: string; label: string }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

export class WorkflowsPage extends BasePage {
  protected readonly marker = by.textMatches('[0-9,]+ workflows?');

  readonly selectors = {
    moreEntry: by.a11y('Workflows'),                         // More > CRM > Workflows
    count: this.marker,
    newWorkflow: by.a11y('New workflow'),
    search: '//android.widget.EditText',                     // hint "Search workflows"
    clearSearch: by.a11y('Clear search'),
    clearSearchButton: by.a11y('Clear Search'),             // on the empty state
    filter: (name: WorkflowFilter) => `android=new UiSelector().className("android.widget.Button").descriptionMatches(${JSON.stringify(`${name}, [0-9]+`)})`,
    rows: '//android.widget.Button[contains(@content-desc, ", Active") or contains(@content-desc, ", Draft")]',
    noWorkflows: by.text(WORKFLOW_TEXTS.noWorkflows),
    noWorkflowsHint: by.text(WORKFLOW_TEXTS.noWorkflowsHint),
  };

  async count(): Promise<number> {
    return num(await this.el(this.selectors.count).getText());
  }

  async waitForLoaded(timeout = 30_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noWorkflows).isExisting(), {
      timeout, timeoutMsg: `Workflows did not load within ${timeout} ms`,
    });
  }

  async filterCount(name: WorkflowFilter): Promise<number> {
    const label = (await this.el(this.selectors.filter(name)).getAttribute('content-desc')) ?? '';
    return Number(label.split(', ').pop());
  }

  async selectFilter(name: WorkflowFilter): Promise<void> {
    await this.tap(this.selectors.filter(name));
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(1_500);
  }

  /** Visible rows with their trigger ("Lead created") and runs line ("No runs yet", "Last run 29 May", "60 failed runs"). */
  async visibleRows(): Promise<WorkflowRow[]> {
    const rows: WorkflowRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push(await t.getText());
      if (texts.length < 4) continue;                        // cut off at the bottom of the screen
      const i = label.lastIndexOf(', ');
      rows.push({ name: label.slice(0, i), status: label.slice(i + 2), trigger: texts[2]!, runs: texts[3]!, label });
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
    try { await this.waitForVisible(this.selectors.noWorkflows, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.tap(this.selectors.clearSearchButton);
    await this.waitForLoaded();
    await driver.pause(1_000);
  }

  /** Opens a workflow by tapping its row (the name area, never the on/off switch next to it). */
  async openWorkflow(label: string): Promise<void> {
    await this.tap(`(//android.widget.Button[@content-desc=${JSON.stringify(label)}])[1]`);
  }
}

export class WorkflowDetailPage extends BasePage {
  protected readonly marker = by.a11y('Workflow actions');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    title: (name: string) => `//android.view.View[@text=${JSON.stringify(name)}]`,
    status: '(//android.widget.TextView[@text="Active" or @text="Draft"])[1]',
    switch: '//android.widget.Switch',
    connectHint: by.text(WORKFLOW_TEXTS.connectHint),
    metric: (name: 'Runs' | 'Completed' | 'Failed') => by.descStartsWith(`${name} `),
    trigger: '//android.view.View[@text="TRIGGER"]/following-sibling::android.view.ViewGroup[1]//android.widget.TextView[1]',
    triggerSummary: by.textMatches('.*[.] [0-9]+ steps?[.]'),   // "Leads. 5 steps."
    stepsCount: '//android.view.View[@text="STEPS"]/following-sibling::android.widget.TextView[1]',
    step: (n: number) => by.textStartsWith(`${n}. `),
    editOnWeb: by.a11y('Edit flow on web'),
    runsCount: '//android.view.View[@text="RUNS"]/following-sibling::android.widget.TextView[1]',
    noRuns: by.text(WORKFLOW_TEXTS.noRunsDetail),
    runs: '//android.widget.Button[starts-with(@content-desc, "Run ") and not(starts-with(@content-desc, "Run now"))]',
    actions: by.a11y('Workflow actions'),
    action: (name: string) => (name === 'Rename' || name === 'Delete' ? `//android.widget.Button[@content-desc=${JSON.stringify(name)}]` : by.descStartsWith(`${name}, `)),
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
  };

  async isTitled(name: string): Promise<boolean> {
    return this.el(this.selectors.title(name)).isExisting();
  }

  async text(selector: string): Promise<string> {
    return this.el(selector).getText().catch(() => '');
  }

  async switchLabel(): Promise<string> {
    return (await this.el(this.selectors.switch).getAttribute('content-desc')) ?? '';
  }

  async metric(name: 'Runs' | 'Completed' | 'Failed'): Promise<number> {
    return num((await this.el(this.selectors.metric(name)).getAttribute('content-desc')) ?? '');
  }

  /** First listed run: content-desc "Run <date>, <status>". */
  async firstRun(): Promise<{ date: string; status: string; label: string } | undefined> {
    const el = this.el(`(${this.selectors.runs})[1]`);
    if (!(await el.isExisting())) return undefined;
    const label = (await el.getAttribute('content-desc')) ?? '';
    const i = label.lastIndexOf(', ');
    return { date: label.slice(4, i), status: label.slice(i + 2), label };
  }

  async openFirstRun(): Promise<void> {
    await this.tap(`(${this.selectors.runs})[1]`);
  }

  /** Opens the actions menu, reads every option and closes it without choosing. */
  async actionOptions(): Promise<string[]> {
    await this.tap(this.selectors.actions);
    await this.waitForVisible(this.selectors.action('Rename'), 10_000, 'Workflow actions menu');
    const found: string[] = [];
    for (const a of WORKFLOW_ACTIONS) if (await this.el(this.selectors.action(a)).isExisting()) found.push(a);
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.action('Rename'), 5_000, 'Workflow actions menu');
    return found;
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

/** One run of a workflow: status, when it ran, the steps it went through and run details. */
export class WorkflowRunPage extends BasePage {
  protected readonly marker = '//android.view.ViewGroup[@content-desc="Run steps"]';

  readonly selectors = {
    status: '(//android.widget.TextView)[1]',
    ran: by.textStartsWith('Ran '),                          // "Ran 31 Oct, 4:33 AM. Took 0s."
    stoppedAt: by.textMatches('Stopped at step [0-9]+ of [0-9]+'),
    steps: '//android.view.ViewGroup[@content-desc="Run steps"]/android.view.ViewGroup[@content-desc!=""]',
    fixOnWeb: by.text(WORKFLOW_TEXTS.fixOnWeb),
    // The "Run details" group is empty: label and value are siblings next to it.
    detail: (name: 'Started' | 'Finished') => `//android.widget.TextView[@text=${JSON.stringify(name)}]/following-sibling::android.widget.TextView[1]`,
  };

  async text(selector: string): Promise<string> {
    return this.el(selector).getText().catch(() => '');
  }

  /** Run steps as "<step>, <status>" (e.g. "Send WhatsApp text, Failed"). */
  async steps(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.selectors.steps)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
  }
}

export const workflowsPage = new WorkflowsPage();
export const workflowDetailPage = new WorkflowDetailPage();
export const workflowRunPage = new WorkflowRunPage();
