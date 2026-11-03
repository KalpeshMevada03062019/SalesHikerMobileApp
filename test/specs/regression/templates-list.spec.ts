// Templates list, read only: status and category filters, search, rejection reasons, Sync from Meta
// (which only pulls from Meta). No template is created, edited or deleted.
import { expect } from 'chai';
import { templatesPage, TEMPLATE_CATEGORIES, TEMPLATE_STATUSES } from '../../../src/pages/TemplatesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { templateData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTemplates } from '../../helpers/templates.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Templates: list, filters, search and sync', () => {
  requiresAccount();
  beforeEach(async () => { await openTemplates(); });

  it('MTPL-002 Status filters show only templates with that status', async () => {
    const problems: string[] = [];
    for (const status of TEMPLATE_STATUSES) {
      await templatesPage.selectFilter(status);
      const count = await templatesPage.count();
      const rows = await templatesPage.visibleRows();
      if (count === 0 && !(await templatesPage.isEmptyStateShown(5_000))) problems.push(`${status}: 0 templates but no empty state`);
      const other = rows.filter((r) => r.status !== status).map((r) => r.name);
      if (other.length) problems.push(`${status}: other statuses listed (${other.join(', ')})`);
      if (count > 0 && rows.length === 0) problems.push(`${status}: count ${count} but no rows`);
      await checkpoint(`MTPL-002 ${status}`);
    }
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MTPL-003 Category filters show only templates of that category', async () => {
    const problems: string[] = [];
    for (const category of TEMPLATE_CATEGORIES) {
      await templatesPage.selectFilter(category);
      const rows = await templatesPage.visibleRows();
      const other = rows.filter((r) => r.category !== category).map((r) => r.name);
      if (other.length) problems.push(`${category}: other categories listed (${other.join(', ')})`);
      if (!rows.length && !(await templatesPage.isEmptyStateShown(5_000))) problems.push(`${category}: no rows and no empty state`);
    }
    await checkpoint('MTPL-003 authentication');
    expect(problems, 'category filters').to.deep.equal([]);
  });

  it('MTPL-004 Rejected templates show the reason from Meta', async function () {
    await templatesPage.selectFilter('Rejected');
    const rows = await templatesPage.visibleRows();
    if (!rows.length) skipBecause(this, 'no rejected templates in the workspace');
    await checkpoint('MTPL-004 rejected');
    // Reason codes from Meta are upper case with underscores (e.g. INVALID_FORMAT, INCORRECT_CATEGORY).
    expect(rows.filter((r) => !/, [A-Z][A-Z_]+$/.test(r.label)).map((r) => r.name), 'rejected rows without a reason').to.deep.equal([]);
    expect(await templatesPage.count(), 'count vs rows').to.equal(rows.length);
  });

  it('MTPL-005 Search by part of a name is case-insensitive and an unknown name finds none', async () => {
    const all = await templatesPage.count();
    await templatesPage.search(templateData.approved.name.slice(0, 10).toUpperCase());
    const names = (await templatesPage.visibleRows()).map((r) => r.name);
    expect(names, 'upper-case partial search').to.include(templateData.approved.name);
    await templatesPage.search(templateData.noMatch);
    expect(await templatesPage.isEmptyStateShown(), '"No templates found"').to.equal(true);
    expect(await templatesPage.count(), 'count while nothing matches').to.equal(0);
    await checkpoint('MTPL-005 no match');
    await templatesPage.clearSearch();
    await driver.waitUntil(async () => (await templatesPage.count().catch(() => -1)) === all, { timeout: 15_000, timeoutMsg: 'Count not restored after clearing the search' });
  });

  it('MTPL-006 Sync from Meta reports that it ran and keeps the list', async () => {
    const before = await templatesPage.count();
    const { sawSyncing, result } = await templatesPage.syncFromMeta();
    await checkpoint('MTPL-006 synced');
    expect(sawSyncing, '"Syncing…" while it runs').to.equal(true);
    expect(result, 'result line').to.match(/^Synced from Meta (today|yesterday|\d{1,2} [A-Z][a-z]{2}), \d{1,2}:\d{2}$/);
    expect(await templatesPage.count(), 'templates after sync').to.be.at.least(before > 0 ? 1 : 0);
  });
});
