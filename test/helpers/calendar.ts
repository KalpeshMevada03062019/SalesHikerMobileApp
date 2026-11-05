// Navigation shared by the Calendar specs (More > CRM > Calendar: the task calendar).
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { taskCalendarPage } from '../../src/pages/TasksPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

/** Restarts the app signed in and opens More > Calendar. */
export async function openCalendar(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(morePage.selectors.calendar);
  await taskCalendarPage.waitForDisplayed(20_000);
}
