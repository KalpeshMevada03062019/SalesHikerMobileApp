// Calendar (More > Calendar), read only: days, week moves, Today, past and future tasks on their day, and a
// task opened from a day (its form is only read and left with Cancel). New Task, the "Mark ... done" check
// boxes and Save are never tapped.
import { expect } from 'chai';
import { tasksPage, taskFormPage, taskCalendarPage, taskDate, dayLabel, startOfToday, TASK_TEXTS } from '../../../src/pages/TasksPage.js';
import { morePage } from '../../../src/pages/MorePage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCalendar } from '../../helpers/calendar.js';
import { openTasks } from '../../helpers/tasks.js';
import { skipBecause } from '../../helpers/campaigns.js';

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthLabel = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

describe('Calendar: days and tasks (nothing is changed)', () => {
  requiresAccount();

  it('MCAL-002 Each day of the week shows as many tasks as its count, or Nothing planned', async () => {
    await openCalendar();
    const c = taskCalendarPage;
    const problems: string[] = [];
    for (const day of await c.days()) {
      await c.selectDay(day);
      const count = await c.dayCount();
      const entries = await c.entries();
      const empty = await $(c.selectors.nothingPlanned).isExisting();
      if (count === 0 && !empty) problems.push(`${day}: no count and no "${TASK_TEXTS.nothingPlanned}"`);
      if (count > 0 && empty) problems.push(`${day}: count ${count} with "${TASK_TEXTS.nothingPlanned}"`);
      // Long days scroll: only the first entries are on screen.
      if (count <= 4 ? entries.length !== count : entries.length < 4) problems.push(`${day}: count ${count}, ${entries.length} listed`);
      if (entries.some((e) => !/^.+, /.test(e))) problems.push(`${day}: entry without details`);
    }
    await checkpoint('MCAL-002 last day');
    expect(problems, 'days').to.deep.equal([]);
  });

  it('MCAL-003 Moving a week keeps the weekday selected and the month follows the selected day', async () => {
    await openCalendar();
    const c = taskCalendarPage;
    const today = startOfToday();
    await c.moveWeek('previous');
    expect(await c.selectedDay(), 'selected after Previous week').to.equal(dayLabel(addDays(today, -7)));
    expect(await $(c.selectors.month).getText(), 'month after Previous week').to.equal(monthLabel(addDays(today, -7)));
    await checkpoint('MCAL-003 previous week');
    await c.moveWeek('next');
    await c.moveWeek('next');
    expect(await c.selectedDay(), 'selected after two Next week').to.equal(dayLabel(addDays(today, 7)));
    expect(await $(c.selectors.month).getText(), 'month after Next week').to.equal(monthLabel(addDays(today, 7)));
  });

  it('MCAL-004 Today appears away from today and brings the calendar back to it', async () => {
    await openCalendar();
    const c = taskCalendarPage;
    const today = startOfToday();
    expect(await $(c.selectors.today).isExisting(), 'Today button on today').to.equal(false);
    await c.moveWeek('next');
    await c.moveWeek('next');
    expect(await $(c.selectors.today).isExisting(), 'Today button two weeks ahead').to.equal(true);
    await checkpoint('MCAL-004 two weeks ahead');
    await c.goToToday();
    expect(await c.selectedDay(), 'selected after Today').to.equal(dayLabel(today));
    expect(await c.days(), 'week after Today').to.include(dayLabel(today));
    expect(await $(c.selectors.month).getText(), 'month after Today').to.equal(monthLabel(today));
  });

  it('MCAL-005 An overdue task is listed on its past due day', async function () {
    await openTasks('Overdue');
    const row = (await tasksPage.visibleRows()).find((r) => !!taskDate(r.date));
    if (!row) skipBecause(this, 'no overdue task with a date');
    const day = taskDate(row.date)!;
    await openCalendar();
    const c = taskCalendarPage;
    if (!(await c.openDay(day, 26))) skipBecause(this, `${row.date} is more than 26 weeks back`);
    const entries = await c.entries();
    await checkpoint('MCAL-005 overdue day');
    expect(await c.dayCount(), `count on ${dayLabel(day)}`).to.be.greaterThan(0);
    expect(entries.some((e) => e.startsWith(`${row.title}, `)), `"${row.title}" on ${dayLabel(day)} (${entries.join(' | ')})`).to.equal(true);
    expect(await $(c.selectors.today).isExisting(), 'Today button on a past day').to.equal(true);
  });

  it('MCAL-006 A task opens from its day and Cancel returns to that day', async function () {
    await openTasks('Upcoming');
    const row = (await tasksPage.visibleRows()).find((r) => r.date !== TASK_TEXTS.noDate && !!taskDate(r.date));
    if (!row) skipBecause(this, 'no upcoming task with a date');
    const day = taskDate(row.date)!;
    await openCalendar();
    const c = taskCalendarPage;
    if (!(await c.openDay(day))) skipBecause(this, `${row.date} is more than 10 weeks ahead`);
    const count = await c.dayCount();
    await c.openEntry(row.title);
    await taskFormPage.waitForDisplayed(15_000);
    expect(await $(taskFormPage.selectors.title).getText(), 'title in the form').to.equal(row.title);
    expect(taskDate(await taskFormPage.field('dueDate'))?.getTime(), 'due date in the form').to.equal(day.getTime());
    await checkpoint('MCAL-006 form');
    await taskFormPage.cancel();
    await c.waitForDisplayed();
    expect(await c.selectedDay(), 'selected day after Cancel').to.equal(dayLabel(day));
    expect(await c.dayCount(), 'count after Cancel').to.equal(count);
  });

  it('MCAL-007 Back returns to More, whose Tasks today matches today in the calendar', async () => {
    await openCalendar();
    const c = taskCalendarPage;
    const today = await c.dayCount();
    await c.goBack();
    // More comes back scrolled to its Calendar entry; its "Tasks today" tile (the page marker) is off screen.
    await $(morePage.selectors.calendar).waitForDisplayed({ timeout: 15_000, timeoutMsg: 'More (Calendar entry) not shown after Back' });
    expect(await morePage.tasksToday(), 'More: Tasks today vs the calendar today').to.equal(today);
    await checkpoint('MCAL-007 more');
  });
});
