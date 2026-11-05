import { expect } from 'chai';
import { tasksPage, TASK_TEXTS } from '../../../src/pages/TasksPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTasks } from '../../helpers/tasks.js';

describe('Smoke: tasks', () => {
  requiresAccount();

  it('MTSK-001 Tasks opens on Today with search, filters, the overdue preview and the today section', async () => {
    await openTasks();
    const p = tasksPage;
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(TASK_TEXTS.searchHint);
    expect(await $(p.selectors.calendar).isExisting(), 'Calendar').to.equal(true);
    expect(await $(p.selectors.newTask).isExisting(), 'New Task (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['Today']);
    await checkpoint('MTSK-001 today');
    const overdue = await p.overdueCount();
    if (overdue > 0) {
      expect(await $(p.selectors.overdueHeader).isExisting(), 'OVERDUE section').to.equal(true);
      expect(Number((await p.text(p.selectors.overdueHeaderCount)).replace(/[^\d]/g, '')), 'OVERDUE count vs chip').to.equal(overdue);
      const { y: todayTop } = await $(p.selectors.todayHeader).getLocation();
      const preview = (await p.visibleRows()).filter((r) => r.top < todayTop);
      expect(preview.length, 'overdue preview rows').to.be.within(1, 3);
      expect(preview.filter((r) => r.badge !== 'Overdue').map((r) => r.title), 'preview rows not marked Overdue').to.deep.equal([]);
      expect(await $(p.selectors.seeAllOverdue).getAttribute('content-desc'), 'See all link').to.equal(`See all ${overdue.toLocaleString('en-IN')} overdue`);
    }
    expect(await $(p.selectors.todayHeader).isExisting(), 'TODAY section').to.equal(true);
  });
});
