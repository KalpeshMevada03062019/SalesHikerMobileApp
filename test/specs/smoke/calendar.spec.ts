import { expect } from 'chai';
import { taskCalendarPage, dayLabel, startOfToday } from '../../../src/pages/TasksPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCalendar } from '../../helpers/calendar.js';

describe('Smoke: calendar', () => {
  requiresAccount();

  it('MCAL-001 Calendar opens from More on the current week with today selected', async () => {
    await openCalendar();
    const c = taskCalendarPage;
    const today = startOfToday();
    expect(await $(c.selectors.title).isExisting(), 'title Calendar').to.equal(true);
    expect(await $(c.selectors.newTask).isExisting(), 'New Task (not tapped)').to.equal(true);
    expect(await $(c.selectors.month).getText(), 'month').to.equal(today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));
    const days = await c.days();
    expect(days.length, 'days in the week').to.equal(7);
    expect(days[0], 'week starts on Monday').to.match(/^Monday /);
    expect(await c.selectedDay(), 'selected day').to.equal(dayLabel(today));
    expect(await $(c.selectors.day(dayLabel(today))).getAttribute('content-desc'), 'today marked').to.equal(`${dayLabel(today)}, today`);
    expect(await $(c.selectors.today).isExisting(), 'Today button while today is selected').to.equal(false);
    expect(await c.dayHeader(), 'day header').to.equal(dayLabel(today).replace(/^(\w+) /, '$1, ').toUpperCase());
    await checkpoint('MCAL-001 calendar');
  });
});
