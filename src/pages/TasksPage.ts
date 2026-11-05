// More > CRM > Tasks: the list (Today / Upcoming / Overdue / Done chips, Assignee and Priority sheets, search),
// the task form a task opens in, and the week calendar. Live app on the phone, 2026-11-04.
//
// Read only: New Task, the "Mark ... done" check boxes, Save, Mark Done, Reopen, Delete Task and every form
// field are never tapped; the form is only read and left with Cancel.
import { BasePage, by } from './BasePage.js';

export const TASK_FILTERS = ['Today', 'Upcoming', 'Overdue', 'Done'] as const;
export type TaskFilter = (typeof TASK_FILTERS)[number];
export const TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;

export const TASK_TEXTS = {
  searchHint: 'Search tasks',
  nothingToday: 'Nothing due today.',
  noTasks: 'No tasks found',
  noTasksHint: 'Try another word.',
  endOfList: 'End of list',
  noDate: 'No date',
  noDueDate: 'No due date',
  anyTime: 'Any time',
  dateFirst: 'Set a due date first.',
  nothingPlanned: 'Nothing planned',
};

/** List row: texts "<type or Overdue>", "<title>", "<priority>", ["· [<related>, ]<assignee>"], "<date>". */
export interface TaskRow { badge: string; title: string; priority: string; line: string; date: string; top: number }

const num = (t: string) => Number(t.replace(/[^\d]/g, ''));
const CHIP_TOP = 260;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Start of the day of a list or form date: "Fri, 6 Nov", "Done 30 Oct", "6 Nov 2026", "Tomorrow". Null if none. */
export function taskDate(text: string, today = new Date()): Date | null {
  const t = text.replace(/^Done ?/, '').trim();
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (/^Today\b/.test(t)) return day0;
  if (/^Tomorrow\b/.test(t)) return new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + 1);
  const m = t.match(/(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))?/);
  if (!m || !MONTHS.includes(m[2]!)) return null;
  return new Date(m[3] ? Number(m[3]) : today.getFullYear(), MONTHS.indexOf(m[2]!), Number(m[1]));
}

export const startOfToday = (): Date => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

/** "Friday 6 November": the calendar label of a day. */
export function dayLabel(d: Date): string {
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
}

export class TasksPage extends BasePage {
  protected readonly marker = by.a11y(TASK_TEXTS.searchHint);

  readonly selectors = {
    moreEntry: by.a11y('Tasks'),                              // More > CRM > Tasks
    search: by.a11y(TASK_TEXTS.searchHint),                   // EditText; its text is the hint or the query
    clearSearch: by.a11y('Clear search'),
    clearSearchButton: by.a11y('Clear Search'),               // on the empty state
    calendar: by.a11y('Calendar'),
    newTask: by.a11y('New Task'),
    // Chips sit on one row (it scrolls sideways); "Overdue, 2,00,004" carries the count except while searching.
    filter: (name: TaskFilter) => `//android.widget.Button[(@content-desc=${JSON.stringify(name)} or starts-with(@content-desc, ${JSON.stringify(`${name}, `)})) and contains(@bounds, ",${CHIP_TOP}]")]`,
    selectedFilters: `//android.widget.Button[@selected="true" and contains(@bounds, ",${CHIP_TOP}]")]`,
    sheetChip: (sheet: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${sheet}: `)}) and contains(@bounds, ",${CHIP_TOP}]")]`,
    clearChip: (sheet: string) => `//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`Clear ${sheet}: `)})]`,
    sheetTitle: (sheet: string) => `//android.view.View[@text=${JSON.stringify(sheet)}]`,
    sheetOptions: '//android.widget.Button[@content-desc!="Close"]',
    sheetOption: (name: string) => `//android.widget.Button[@content-desc=${JSON.stringify(name)}]`,
    sheetClose: '(//android.widget.Button[@content-desc="Close"])[last()]',
    overdueHeader: '//android.view.View[@text="OVERDUE"]',
    overdueHeaderCount: '//android.view.View[@text="OVERDUE"]/following-sibling::android.widget.TextView[1]',
    todayHeader: '//android.view.View[@text="TODAY"]',
    seeAllOverdue: by.descStartsWith('See all '),             // "See all 2,00,004 overdue"
    nothingToday: by.text(TASK_TEXTS.nothingToday),
    rows: '//android.widget.Button[count(.//android.widget.TextView) >= 4]',
    row: (title: string) => `(//android.widget.Button[@content-desc=${JSON.stringify(title)}])[1]`,
    checkBoxes: '//android.widget.CheckBox',                  // "Mark <title> done" / "Mark <title> not done" (never tapped)
    endOfList: by.text(TASK_TEXTS.endOfList),
    noTasks: by.text(TASK_TEXTS.noTasks),
    noTasksHint: by.text(TASK_TEXTS.noTasksHint),
  };

  /** Rows, the empty state, the end of the list or the Today sections are shown. */
  async waitForLoaded(timeout = 30_000): Promise<void> {
    const s = this.selectors;
    await driver.waitUntil(async () => (await $$(s.rows).length) > 0 || (await $(s.noTasks).isExisting()) || (await $(s.nothingToday).isExisting())
      || (await $(s.endOfList).isExisting()), { timeout, timeoutMsg: `Tasks did not load within ${timeout} ms` });
  }

  /** Brings a chip fully on screen (the chip row scrolls sideways) and returns it. */
  private async chipInView(selector: string, later: boolean): Promise<WebdriverIO.Element> {
    const { width } = await driver.getWindowSize();
    for (let i = 0; i < 6; i++) {
      const found = await $$(selector);
      if (found.length) {
        const { x } = await found[0]!.getLocation();
        const { width: w } = await found[0]!.getSize();
        if (x > 2 && x + w < width - 2) return found[0]!;
      }
      await driver.execute('mobile: scrollGesture', { left: width * 0.15, top: CHIP_TOP + 4, width: width * 0.7, height: 80, direction: later ? 'right' : 'left', percent: 0.6 });
    }
    return $(selector).getElement();
  }

  async selectFilter(name: TaskFilter): Promise<void> {
    const chip = await this.chipInView(this.selectors.filter(name), name === 'Done' || name === 'Overdue');
    await chip.click();
    await driver.waitUntil(async () => (await $(this.selectors.filter(name)).getAttribute('selected').catch(() => null)) === 'true', { timeout: 5_000, timeoutMsg: `Filter "${name}" not selected` });
    await driver.pause(2_500);
    await this.waitForLoaded();
  }

  /** Selected status chips, e.g. ["Overdue"] (the count is dropped; a set Assignee / Priority chip is selected too, left out). */
  async selectedFilters(): Promise<string[]> {
    await this.chipInView(this.selectors.filter('Today'), false);   // status chips sit at the start of the row
    const out: string[] = [];
    for (const el of await $$(this.selectors.selectedFilters)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/, [0-9,]+$/, '');
      if ((TASK_FILTERS as readonly string[]).includes(label)) out.push(label);
    }
    return out;
  }

  /** The count on the Overdue chip ("Overdue, 2,00,004"). */
  async overdueCount(): Promise<number> {
    const chip = await this.chipInView(this.selectors.filter('Overdue'), true);
    return num((await chip.getAttribute('content-desc')) ?? '');
  }

  async text(selector: string): Promise<string> {
    return $(selector).getText().catch(() => '');
  }

  /** "Assignee: All" -> "All". */
  async sheetValue(sheet: 'Assignee' | 'Priority'): Promise<string> {
    const chip = await this.chipInView(this.selectors.sheetChip(sheet), true);
    return ((await chip.getAttribute('content-desc')) ?? '').slice(sheet.length + 2);
  }

  /** Opens the Assignee or Priority sheet and returns its options and the selected one. */
  async openSheet(sheet: 'Assignee' | 'Priority'): Promise<{ options: string[]; selected: string }> {
    const chip = await this.chipInView(this.selectors.sheetChip(sheet), true);
    await chip.click();
    await this.waitForVisible(this.selectors.sheetTitle(sheet), 10_000, `${sheet} sheet`);
    const options: string[] = [];
    let selected = '';
    for (const el of await $$(this.selectors.sheetOptions)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      options.push(label);
      if ((await el.getAttribute('selected')) === 'true') selected = label;
    }
    return { options, selected };
  }

  /** Picks an option in the open sheet and waits for the list to reload. */
  async chooseInSheet(sheet: 'Assignee' | 'Priority', option: string): Promise<void> {
    await this.tap(this.selectors.sheetOption(option));
    await this.waitForGone(this.selectors.sheetTitle(sheet), 10_000, `${sheet} sheet`);
    await driver.pause(2_500);
    await this.waitForLoaded();
  }

  async closeSheet(sheet: 'Assignee' | 'Priority'): Promise<void> {
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.sheetTitle(sheet), 5_000, `${sheet} sheet`);
  }

  /** Taps the X next to an Assignee or Priority chip. */
  async clearSheet(sheet: 'Assignee' | 'Priority'): Promise<void> {
    const chip = await this.chipInView(this.selectors.clearChip(sheet), true);
    await chip.click();
    await driver.pause(2_500);
    await this.waitForLoaded();
  }

  /** Visible rows. */
  async visibleRows(): Promise<TaskRow[]> {
    const rows: TaskRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const texts: string[] = [];
      for (const t of await el.$$('.//android.widget.TextView')) texts.push((await t.getText()).replace(/\s+/g, ' '));
      if (texts.length < 4) continue;
      const line = texts.find((t, i) => i > 2 && t.startsWith('· ')) ?? '';
      const { y } = await el.getLocation();
      rows.push({ badge: texts[0]!, title: texts[1]!, priority: texts[2]!, line, date: texts[texts.length - 1]! === line ? '' : texts[texts.length - 1]!, top: y });
    }
    return rows;
  }

  async checkBoxLabels(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.selectors.checkBoxes)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
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
    try { await this.waitForVisible(this.selectors.noTasks, timeout); return true; } catch { return false; }
  }

  async clearFromEmptyState(): Promise<void> {
    await this.tap(this.selectors.clearSearchButton);
    await this.waitForGone(this.selectors.noTasks, 10_000, TASK_TEXTS.noTasks);
    await this.waitForLoaded();
  }

  async tapCalendar(): Promise<void> {
    await this.tap(this.selectors.calendar);
  }

  async seeAllOverdue(): Promise<void> {
    await this.tap(this.selectors.seeAllOverdue);
    await driver.waitUntil(async () => (await this.selectedFilters()).includes('Overdue'), { timeout: 10_000, timeoutMsg: 'Overdue not selected after See all' });
    await driver.pause(2_000);
    await this.waitForLoaded();
  }

  async openTask(title: string): Promise<void> {
    await this.tap(this.selectors.row(title));
  }
}

/** The form a task opens in ("Edit Task"). Only read; left with Cancel. */
export class TaskFormPage extends BasePage {
  protected readonly marker = by.text('Edit Task');

  readonly selectors = {
    cancel: by.a11y('Cancel'),
    save: by.a11y('Save'),                                    // never tapped
    status: '//android.view.View[@text="TASK"]/following::android.widget.TextView[1]',   // badge "Open" / "Done"
    markDone: by.a11y('Mark Done'),                           // never tapped
    reopen: by.a11y('Reopen'),                                // never tapped
    title: by.descClass('Title', 'android.widget.EditText'),
    type: by.descStartsWith('Type: '),
    assignee: by.descStartsWith('Assignee: '),
    priority: '//android.widget.RadioButton[@checked="true"]',
    dueDate: by.descStartsWith('Due date: '),
    time: by.descStartsWith('Time: '),
    reminder: by.descClass('Reminder', 'android.widget.Switch'),
    dateFirst: by.text(TASK_TEXTS.dateFirst),
    relatedTo: by.descStartsWith('Related To: '),
    deleteTask: by.a11y('Delete Task'),                       // never tapped
  };

  /** "Type: To-do" -> "To-do". */
  async field(name: 'type' | 'assignee' | 'dueDate' | 'time' | 'relatedTo'): Promise<string> {
    return ((await $(this.selectors[name]).getAttribute('content-desc')) ?? '').replace(/^[^:]+: /, '');
  }

  async priority(): Promise<string> {
    return (await $(this.selectors.priority).getAttribute('content-desc')) ?? '';
  }

  async status(): Promise<{ text: string; width: number }> {
    const el = $(this.selectors.status);
    return { text: await el.getText(), width: (await el.getSize()).width };
  }

  async isEnabled(name: 'time' | 'reminder'): Promise<boolean> {
    return (await $(this.selectors[name]).getAttribute('enabled')) === 'true';
  }

  /** Scrolls the form down until the element is on screen. */
  async scrollTo(selector: string): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 4 && !(await $(selector).isDisplayed().catch(() => false)); i++) {
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.35, width: width * 0.8, height: height * 0.45, direction: 'down', percent: 0.6 });
    }
  }

  async cancel(): Promise<void> {
    await this.tap(this.selectors.cancel);
    await this.waitForGone(this.marker, 10_000, 'Edit Task');
  }
}

/** Tasks > Calendar: one week, a day's tasks below it. */
export class TaskCalendarPage extends BasePage {
  protected readonly marker = by.a11y('Previous week');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    previousWeek: by.a11y('Previous week'),
    nextWeek: by.a11y('Next week'),
    month: by.textMatches('[A-Z][a-z]+ [0-9]{4}'),           // "November 2026"
    days: '//android.view.View[@clickable="true" and string-length(@content-desc) > 0]',
    day: (label: string) => `//android.view.View[@content-desc=${JSON.stringify(label)} or @content-desc=${JSON.stringify(`${label}, today`)}]`,
    selectedDay: '//android.view.View[@selected="true" and @clickable="true"]',
    dayHeader: by.textMatches('[A-Z]+, [0-9]{1,2} [A-Z]+'),  // "FRIDAY, 6 NOVEMBER"
    entries: '//android.widget.Button[count(.//android.widget.TextView) >= 2]',   // "<title>, <time>, <type>[, <assignee>]"
    nothingPlanned: by.text(TASK_TEXTS.nothingPlanned),
    title: '//android.view.View[@text="Calendar"]',
    today: by.descClass('Today', 'android.widget.Button'),   // shown while another day is selected
    newTask: '(//android.widget.Button[@content-desc="New Task"])[1]',   // header; a day without tasks has a second one (never tapped)
    dayCount: '//android.view.View[contains(@text, ", ")]/following-sibling::android.widget.TextView[1]',   // "3" (none when empty)
    entry: (title: string) => `(//android.widget.Button[starts-with(@content-desc, ${JSON.stringify(`${title}, `)})])[1]`,
  };

  /** Day labels of the shown week, e.g. "Monday 2 November" (", today" removed). */
  async days(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.selectors.days)) out.push(((await el.getAttribute('content-desc')) ?? '').replace(/, today$/, ''));
    return out;
  }

  async selectedDay(): Promise<string> {
    return ((await $(this.selectors.selectedDay).getAttribute('content-desc')) ?? '').replace(/, today$/, '');
  }

  async dayHeader(): Promise<string> {
    return $(this.selectors.dayHeader).getText();
  }

  async entries(): Promise<string[]> {
    const out: string[] = [];
    for (const el of await $$(this.selectors.entries)) out.push((await el.getAttribute('content-desc')) ?? '');
    return out;
  }

  async moveWeek(direction: 'next' | 'previous'): Promise<void> {
    const before = (await this.days())[0];
    await this.tap(direction === 'next' ? this.selectors.nextWeek : this.selectors.previousWeek);
    await driver.waitUntil(async () => (await this.days())[0] !== before, { timeout: 5_000, timeoutMsg: `Week did not move (${direction})` });
  }

  /** Moves week by week (forward for future days, back for past ones) until the day is shown, selects it and waits for its list. */
  async openDay(d: Date, maxWeeks = 10): Promise<boolean> {
    const label = dayLabel(d);
    const direction = d < startOfToday() ? 'previous' : 'next';
    for (let i = 0; i <= maxWeeks && !(await $(this.selectors.day(label)).isExisting()); i++) await this.moveWeek(direction);
    if (!(await $(this.selectors.day(label)).isExisting())) return false;
    await this.tap(this.selectors.day(label));
    await driver.waitUntil(async () => (await this.selectedDay()) === label, { timeout: 5_000, timeoutMsg: `${label} not selected` });
    await driver.pause(2_000);
    return true;
  }

  /** The number next to the day header; 0 when the day has none ("Nothing planned"). */
  async dayCount(): Promise<number> {
    const found = await $$(this.selectors.dayCount);
    return found.length ? num(await found[0]!.getText()) : 0;
  }

  async selectDay(label: string): Promise<void> {
    await this.tap(this.selectors.day(label));
    await driver.waitUntil(async () => (await this.selectedDay()) === label, { timeout: 5_000, timeoutMsg: `${label} not selected` });
    await driver.pause(2_000);
  }

  async goToToday(): Promise<void> {
    await this.tap(this.selectors.today);
    await this.waitForGone(this.selectors.today, 5_000, 'Today button');
    await driver.pause(1_500);
  }

  async openEntry(title: string): Promise<void> {
    await this.tap(this.selectors.entry(title));
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const tasksPage = new TasksPage();
export const taskFormPage = new TaskFormPage();
export const taskCalendarPage = new TaskCalendarPage();
