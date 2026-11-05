// Workflows list, read only: status counts and filters, search. The on/off switches and New workflow are never tapped.
import { expect } from 'chai';
import { workflowsPage, WORKFLOW_STATUSES } from '../../../src/pages/WorkflowsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { workflowData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openWorkflows } from '../../helpers/workflows.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Workflows: list, filters and search', () => {
  requiresAccount();
  beforeEach(async () => { await openWorkflows(); });

  it('MWFL-002 Status counts add up to the total', async () => {
    const all = await workflowsPage.filterCount('All');
    let sum = 0;
    for (const s of WORKFLOW_STATUSES) sum += await workflowsPage.filterCount(s);
    expect(sum, 'Active + Draft').to.equal(all);
  });

  it('MWFL-003 Active and Draft filters show only workflows with that status', async () => {
    const problems: string[] = [];
    for (const s of WORKFLOW_STATUSES) {
      const chip = await workflowsPage.filterCount(s);
      await workflowsPage.selectFilter(s);
      const other = (await workflowsPage.visibleRows()).filter((r) => r.status !== s).map((r) => r.name);
      if (other.length) problems.push(`${s}: other statuses listed (${other.join(', ')})`);
      if ((await workflowsPage.count()) !== chip) problems.push(`${s}: "N workflows" ${await workflowsPage.count()} vs chip ${chip}`);
      await checkpoint(`MWFL-003 ${s}`);
    }
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MWFL-004 Search is case-insensitive, an unknown name finds none and Clear Search restores the list', async function () {
    const all = await workflowsPage.count();
    const first = (await workflowsPage.visibleRows())[0];
    if (!first) skipBecause(this, 'no workflows listed');
    const word = first.name.split(/\s+/).sort((a, b) => b.length - a.length)[0]!;
    await workflowsPage.search(word.toUpperCase());
    expect((await workflowsPage.visibleRows()).map((r) => r.name), `results for "${word.toUpperCase()}"`).to.include(first.name);
    await workflowsPage.search(workflowData.noMatch);
    expect(await workflowsPage.isEmptyStateShown(), '"No workflows found"').to.equal(true);
    expect(await $(workflowsPage.selectors.noWorkflowsHint).isExisting(), '"No workflow matches this search or filter."').to.equal(true);
    expect(await workflowsPage.count(), 'count').to.equal(0);
    expect(await workflowsPage.filterCount('All'), '"All" chip').to.equal(0);
    await checkpoint('MWFL-004 no match');
    await workflowsPage.clearFromEmptyState();
    expect(await workflowsPage.count(), 'count after Clear Search').to.equal(all);
  });
});
