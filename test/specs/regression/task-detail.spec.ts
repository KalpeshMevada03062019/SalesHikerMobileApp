// Task form and calendar, read only: a task opens in its "Edit Task" form, which is read and left with Cancel.
// Save, Mark Done, Reopen, Delete Task, New Task and every field are never tapped.
import { expect } from 'chai';
import { tasksPage, taskFormPage, taskCalendarPage, taskDate, dayLabel, startOfToday, TASK_TEXTS } from '../../../src/pages/TasksPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openFirstTask, openTaskCalendar, openTasks } from '../../helpers/tasks.js';
import { skipBecause } from '../../helpers/campaigns.js';

const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

describe('Tasks: form and calendar (nothing is changed)', () => {
  requiresAccount();

  it('MTSK-009 A dated task opens in its form with the values shown in the list and Cancel leaves it unchanged', async function () {
    const row = await openFirstTask(this, 'Upcoming', (r) => r.date !== TASK_TEXTS.noDate && !!taskDate(r.date) && !!r.line, 'upcoming task with a date and an assignee');
    const f = taskFormPage;
    expect(await $(f.selectors.title).getText(), 'title').to.equal(row.title);
    expect((await f.status()).text, 'status').to.equal('Open');
    expect(await $(f.selectors.markDone).isExisting(), 'Mark Done (not tapped)').to.equal(true);
    expect(await f.field('type'), 'type vs list badge').to.equal(row.badge);
    expect(await f.priority(), 'priority vs list').to.equal(row.priority);
    const assignee = await f.field('assignee');
    if (assignee !== 'No one') expect(row.line, 'list line ends with the assignee').to.match(new RegExp(`(^· |, )${assignee.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    const due = await f.field('dueDate');
    expect(sameDay(taskDate(due), taskDate(row.date)), `due date "${due}" vs list "${row.date}"`).to.equal(true);
    expect(await f.isEnabled('time'), 'Time enabled with a due date').to.equal(true);
    await checkpoint('MTSK-009 form');
    const related = row.line.match(/^· ((?:Contact|Organization|Deal|Lead): [^,]+)/)?.[1];
    if (related) {
      await f.scrollTo(f.selectors.relatedTo);
      expect(await f.field('relatedTo'), 'Related To vs list').to.equal(related);
    }
    await f.cancel();
    await tasksPage.waitForDisplayed();
    expect(await tasksPage.selectedFilters(), 'chip after Cancel').to.deep.equal(['Upcoming']);
    const again = (await tasksPage.visibleRows()).find((r) => r.title === row.title);
    expect(again, 'task after Cancel').to.deep.include({ badge: row.badge, priority: row.priority, line: row.line, date: row.date });
  });

  it('MTSK-010 A task without a due date has Any time and no reminder until a date is set', async function () {
    const row = await openFirstTask(this, 'Upcoming', (r) => r.date === TASK_TEXTS.noDate, 'upcoming task without a date');
    const f = taskFormPage;
    expect(await $(f.selectors.title).getText(), 'title').to.equal(row.title);
    expect(await f.field('dueDate'), 'Due date').to.equal(TASK_TEXTS.noDueDate);
    expect(await f.field('time'), 'Time').to.equal(TASK_TEXTS.anyTime);
    expect(await f.isEnabled('time'), 'Time enabled').to.equal(false);
    expect(await f.isEnabled('reminder'), 'Reminder enabled').to.equal(false);
    expect(await $(f.selectors.dateFirst).isExisting(), `"${TASK_TEXTS.dateFirst}"`).to.equal(true);
    await checkpoint('MTSK-010 no date');
    await f.cancel();
  });

  it('MTSK-011 A done task offers Reopen instead of Mark Done', async function () {
    const row = await openFirstTask(this, 'Done', () => true, 'done task');
    const f = taskFormPage;
    expect(await $(f.selectors.title).getText(), 'title').to.equal(row.title);
    expect((await f.status()).text, 'status').to.equal('Done');
    expect(await $(f.selectors.reopen).isExisting(), 'Reopen (not tapped)').to.equal(true);
    expect(await $(f.selectors.markDone).isExisting(), 'Mark Done').to.equal(false);
    await checkpoint('MTSK-011 done task');
    await f.cancel();
  });

  it('MTSK-012 The task form shows a readable status badge', async function () {
    await openFirstTask(this, 'Upcoming', () => true, 'upcoming task');
    const { text, width } = await taskFormPage.status();
    await checkpoint('MTSK-012 status badge');
    expect(text, 'status').to.equal('Open');
    // The badge text needs about 50 px at this size; 2026-11-04 it was drawn 7 px wide, shown as "..".
    expect(width, `width of the "${text}" badge text (px)`).to.be.at.least(30);
    await taskFormPage.cancel();
  });

  it('MTSK-013 Calendar opens on the current week with today selected', async () => {
    await openTaskCalendar();
    const c = taskCalendarPage;
    const today = startOfToday();
    const days = await c.days();
    expect(days.length, 'days in the week').to.equal(7);
    expect(days, 'week').to.include(dayLabel(today));
    expect(days[0], 'week starts on Monday').to.match(/^Monday /);
    expect(await c.selectedDay(), 'selected day').to.equal(dayLabel(today));
    expect(await c.dayHeader(), 'day header').to.equal(dayLabel(today).replace(/^(\w+) /, '$1, ').toUpperCase());
    expect(await $(c.selectors.month).getText(), 'month').to.equal(today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
    await checkpoint('MTSK-013 calendar');
  });

  it('MTSK-014 A calendar day lists the tasks due that day', async function () {
    await openTasks('Upcoming');
    const row = (await tasksPage.visibleRows()).find((r) => r.date !== TASK_TEXTS.noDate && !!taskDate(r.date));
    if (!row) skipBecause(this, 'no upcoming task with a date');
    await tasksPage.tapCalendar();
    const c = taskCalendarPage;
    await c.waitForDisplayed(15_000);
    const day = taskDate(row.date)!;
    if (!(await c.openDay(day))) skipBecause(this, `${row.date} is more than 10 weeks ahead`);
    const entries = await c.entries();
    await checkpoint('MTSK-014 day');
    expect(entries.length, `tasks on ${dayLabel(day)}`).to.be.greaterThan(0);
    expect(await $(c.selectors.nothingPlanned).isExisting(), `"${TASK_TEXTS.nothingPlanned}"`).to.equal(false);
    const entry = entries.find((e) => e.startsWith(`${row.title}, `));
    expect(entry, `"${row.title}" on ${dayLabel(day)} (${entries.join(' | ')})`).to.not.equal(undefined);
    // The entry names the linked record when there is one ("11:00 AM, Contact: Rahul Mehta, Yash"), else the type.
    const related = row.line.match(/^· ((?:Contact|Organization|Deal|Lead): [^,]+)/)?.[1];
    expect(entry, 'linked record or type in the calendar entry').to.include(`, ${related ?? row.badge}`);
  });

  it('MTSK-015 Next week and Previous week move the calendar by one week', async () => {
    await openTaskCalendar();
    const c = taskCalendarPage;
    const week = await c.days();
    const monday = startOfToday();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const next = new Date(monday); next.setDate(next.getDate() + 7);
    await c.moveWeek('next');
    expect((await c.days())[0], 'first day after Next week').to.equal(dayLabel(next));
    await checkpoint('MTSK-015 next week');
    await c.moveWeek('previous');
    expect(await c.days(), 'week after Previous week').to.deep.equal(week);
  });
});
