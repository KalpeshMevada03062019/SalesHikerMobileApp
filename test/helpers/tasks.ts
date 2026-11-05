// Navigation shared by the Task specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { tasksPage, taskFormPage, taskCalendarPage, type TaskFilter, type TaskRow } from '../../src/pages/TasksPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Tasks (Today). */
export async function openTasks(filter?: TaskFilter): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(tasksPage.selectors.moreEntry);
  await tasksPage.waitForDisplayed(20_000);
  await tasksPage.waitForLoaded();
  if (filter && filter !== 'Today') await tasksPage.selectFilter(filter);
}

/** Opens the first listed task of a filter that matches, in its form; skips when there is none. */
export async function openFirstTask(ctx: Mocha.Context, filter: TaskFilter, match: (r: TaskRow) => boolean, what: string): Promise<TaskRow> {
  await openTasks(filter);
  const row = (await tasksPage.visibleRows()).find(match);
  if (!row) skipBecause(ctx, `no ${what}`);
  await tasksPage.openTask(row.title);
  await taskFormPage.waitForDisplayed(15_000);
  return row;
}

/** Opens Tasks > Calendar. */
export async function openTaskCalendar(): Promise<void> {
  await openTasks();
  await tasksPage.tapCalendar();
  await taskCalendarPage.waitForDisplayed(15_000);
}
