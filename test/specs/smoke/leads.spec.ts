import { expect } from 'chai';
import { leadsPage } from '../../../src/pages/LeadsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openLeads } from '../../helpers/leads.js';

describe('Smoke: leads', () => {
  requiresAccount();

  it('MLED-001 Leads opens with the count, search, status filters and leads', async () => {
    await openLeads();
    expect(await leadsPage.count(), 'leads').to.be.greaterThan(0);
    expect(await $(leadsPage.selectors.search).getText(), 'search hint').to.equal('Search leads');
    expect(await $(leadsPage.selectors.newLead).isExisting(), 'New Lead (not tapped)').to.equal(true);
    expect(await leadsPage.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await leadsPage.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(rows.filter((r) => !r.name || !r.source || !r.status).map((r) => r.label), 'rows without name, source or status').to.deep.equal([]);
    await checkpoint('MLED-001 leads');
  });
});
