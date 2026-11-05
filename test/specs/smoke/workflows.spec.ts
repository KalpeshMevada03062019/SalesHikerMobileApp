import { expect } from 'chai';
import { workflowsPage, WORKFLOW_FILTERS } from '../../../src/pages/WorkflowsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openWorkflows } from '../../helpers/workflows.js';

describe('Smoke: workflows', () => {
  requiresAccount();

  it('MWFL-001 Workflows opens with the count, search, status filters and workflows', async () => {
    await openWorkflows();
    const total = await workflowsPage.count();
    expect(total, 'workflows').to.be.greaterThan(0);
    expect(await $(workflowsPage.selectors.search).getText(), 'search hint').to.equal('Search workflows');
    for (const f of WORKFLOW_FILTERS) expect(await workflowsPage.filterCount(f), `"${f}" filter`).to.be.a('number');
    expect(await workflowsPage.filterCount('All'), '"All" vs "N workflows"').to.equal(total);
    const rows = await workflowsPage.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(rows.filter((r) => !r.trigger || !r.runs).map((r) => r.name), 'rows without trigger or runs line').to.deep.equal([]);
    await checkpoint('MWFL-001 workflows');
  });
});
