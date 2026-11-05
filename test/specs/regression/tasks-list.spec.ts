// Tasks list, read only: the Upcoming / Overdue / Done filters, See all, the Priority and Assignee sheets and
// search. The "Mark ... done" check boxes and New Task are never tapped.
import { expect } from 'chai';
import { tasksPage, taskDate, startOfToday, TASK_PRIORITIES, TASK_TEXTS } from '../../../src/pages/TasksPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { taskData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTasks } from '../../helpers/tasks.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Tasks: filters and search', () => {
  requiresAccount();

  it('MTSK-002 Upcoming lists only open tasks due after today or without a date', async () => {
    await openTasks('Upcoming');
    const p = tasksPage;
    expect(await p.selectedFilters(), 'selected chip').to.deep.equal(['Upcoming']);
    const rows = await p.visibleRows();
    await checkpoint('MTSK-002 upcoming');
    expect(rows.length, 'upcoming tasks').to.be.greaterThan(0);
    const today = startOfToday();
    const problems = rows.filter((r) => {
      if (r.badge === 'Overdue') return true;
      if (r.date === TASK_TEXTS.noDate) return false;
      const d = taskDate(r.date);
      return !d || d <= today;
    }).map((r) => `${r.title} (${r.badge}, ${r.date})`);
    expect(problems, 'tasks that are overdue, due today or with an unreadable date').to.deep.equal([]);
    expect((await p.checkBoxLabels()).filter((l) => !/^Mark .+ done$/.test(l) || / not done$/.test(l)), 'check boxes not offering "Mark ... done"').to.deep.equal([]);
  });

  it('MTSK-003 Overdue lists only open tasks due before today', async () => {
    await openTasks('Overdue');
    const p = tasksPage;
    expect(await p.selectedFilters(), 'selected chip').to.deep.equal(['Overdue']);
    const rows = await p.visibleRows();
    await checkpoint('MTSK-003 overdue');
    expect(rows.length, 'overdue tasks').to.be.greaterThan(0);
    const today = startOfToday();
    const problems = rows.filter((r) => { const d = taskDate(r.date); return r.badge !== 'Overdue' || !d || d >= today; })
      .map((r) => `${r.title} (${r.badge}, ${r.date})`);
    expect(problems, 'tasks not marked Overdue or not due before today').to.deep.equal([]);
  });

  it('MTSK-004 See all overdue opens the Overdue filter', async function () {
    await openTasks();
    const p = tasksPage;
    if (!(await $(p.selectors.seeAllOverdue).isExisting())) skipBecause(this, 'no overdue tasks');
    const count = await p.overdueCount();
    await p.seeAllOverdue();
    expect(await p.selectedFilters(), 'selected chip').to.deep.equal(['Overdue']);
    expect(await p.overdueCount(), 'Overdue count').to.equal(count);
    const rows = await p.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(rows.filter((r) => r.badge !== 'Overdue').map((r) => r.title), 'rows not marked Overdue').to.deep.equal([]);
    await checkpoint('MTSK-004 see all');
  });

  it('MTSK-005 Done lists only completed tasks that can be marked not done', async () => {
    await openTasks('Done');
    const p = tasksPage;
    expect(await p.selectedFilters(), 'selected chip').to.deep.equal(['Done']);
    const rows = await p.visibleRows();
    await checkpoint('MTSK-005 done');
    expect(rows.length, 'done tasks').to.be.greaterThan(0);
    expect(rows.filter((r) => r.badge === 'Overdue' || !/^Done\b/.test(r.date)).map((r) => `${r.title} (${r.badge}, ${r.date})`), 'rows without "Done"').to.deep.equal([]);
    expect((await p.checkBoxLabels()).filter((l) => !/^Mark .+ not done$/.test(l)), 'check boxes not offering "Mark ... not done"').to.deep.equal([]);
  });

  it('MTSK-006 The Priority filter shows only tasks with the chosen priority and can be cleared', async function () {
    await openTasks('Upcoming');
    const p = tasksPage;
    expect(await p.sheetValue('Priority'), 'Priority chip').to.equal('All');
    const { options, selected } = await p.openSheet('Priority');
    expect(options, 'priority options').to.deep.equal(['All', ...TASK_PRIORITIES]);
    expect(selected, 'selected priority').to.equal('All');
    await checkpoint('MTSK-006 priority sheet');
    await p.chooseInSheet('Priority', taskData.priority);
    expect(await p.sheetValue('Priority'), 'Priority chip').to.equal(taskData.priority);
    const rows = await p.visibleRows();
    if (!rows.length) skipBecause(this, `no upcoming ${taskData.priority} tasks`);
    await checkpoint('MTSK-006 high');
    expect(rows.filter((r) => r.priority !== taskData.priority).map((r) => `${r.title} (${r.priority})`), `rows not ${taskData.priority}`).to.deep.equal([]);
    expect(await p.selectedFilters(), 'status chip kept').to.deep.equal(['Upcoming']);
    await p.clearSheet('Priority');
    expect(await p.sheetValue('Priority'), 'Priority chip after clearing').to.equal('All');
    expect((await p.visibleRows()).some((r) => r.priority !== taskData.priority), 'other priorities listed again').to.equal(true);
  });

  it('MTSK-007 The Assignee filter lists the team and shows only tasks of the chosen member', async function () {
    await openTasks('Upcoming');
    const p = tasksPage;
    expect(await p.sheetValue('Assignee'), 'Assignee chip').to.equal('All');
    const { options, selected } = await p.openSheet('Assignee');
    expect(options.slice(0, 2), 'first options').to.deep.equal(['All', 'Me']);
    expect(selected, 'selected assignee').to.equal('All');
    await checkpoint('MTSK-007 assignee sheet');
    if (!options.includes(taskData.assignee)) { await p.closeSheet('Assignee'); skipBecause(this, `no team member "${taskData.assignee}"`); }
    await p.chooseInSheet('Assignee', taskData.assignee);
    expect(await p.sheetValue('Assignee'), 'Assignee chip').to.equal(taskData.assignee);
    const rows = await p.visibleRows();
    if (!rows.length) skipBecause(this, `no upcoming tasks for ${taskData.assignee}`);
    await checkpoint('MTSK-007 assignee');
    const assigned = (r: { line: string }) => r.line === `· ${taskData.assignee}` || r.line.endsWith(`, ${taskData.assignee}`);
    expect(rows.filter((r) => !assigned(r)).map((r) => `${r.title} (${r.line || 'no assignee shown'})`), `rows not assigned to ${taskData.assignee}`).to.deep.equal([]);
    await p.clearSheet('Assignee');
    expect(await p.sheetValue('Assignee'), 'Assignee chip after clearing').to.equal('All');
  });

  it('MTSK-008 Search finds tasks by title or description, an unknown word finds none and Clear Search restores the list', async () => {
    await openTasks('Upcoming');
    const p = tasksPage;
    const before = (await p.visibleRows()).map((r) => r.title);
    await p.search(taskData.search.toUpperCase());
    const found = (await p.visibleRows()).map((r) => r.title);
    await checkpoint('MTSK-008 search');
    expect(found, `results for "${taskData.search.toUpperCase()}" (title)`).to.include(taskData.titleMatch);
    expect(found, `results for "${taskData.search.toUpperCase()}" (description)`).to.include(taskData.descriptionMatch);
    expect(await p.selectedFilters(), 'status chip kept').to.deep.equal(['Upcoming']);
    await p.search(taskData.noMatch);
    expect(await p.isEmptyStateShown(), `"${TASK_TEXTS.noTasks}"`).to.equal(true);
    expect(await $(p.selectors.noTasksHint).isExisting(), `"${TASK_TEXTS.noTasksHint}"`).to.equal(true);
    expect(await p.visibleRows(), 'rows').to.deep.equal([]);
    await checkpoint('MTSK-008 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search box after Clear Search').to.equal(TASK_TEXTS.searchHint);
    expect((await p.visibleRows()).map((r) => r.title), 'list after Clear Search').to.include(before[0]);
  });
});
