// Leads list, read only: status chips, the Source filter and search. New leads keep arriving on beta, so
// totals are compared with a reading before and after.
import { expect } from 'chai';
import { leadsPage, LEAD_STATUSES, LEAD_TEXTS } from '../../../src/pages/LeadsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { leadData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openLeads } from '../../helpers/leads.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Leads: filters and search', () => {
  requiresAccount();
  beforeEach(async () => { await openLeads(); });

  it('MLED-002 Status counts add up to all leads', async () => {
    const before = await leadsPage.count();
    let sum = 0;
    for (const s of LEAD_STATUSES) sum += await leadsPage.selectFilter(s);
    const after = await leadsPage.selectFilter('All');
    expect(sum, `New + Contacted + Qualified + Proposal + Won + Lost (All ${before} before, ${after} after)`).to.be.within(before, after);
  });

  it('MLED-003 Each status filter shows only leads with that status', async () => {
    const problems: string[] = [];
    for (const s of LEAD_STATUSES) {
      await leadsPage.selectFilter(s);
      const selected = await leadsPage.selectedFilters();
      if (selected.join() !== s) problems.push(`${s}: selected chips ${selected.join('+')}`);
      const rows = await leadsPage.visibleRows();
      if (!rows.length) problems.push(`${s}: no leads`);
      const other = rows.filter((r) => r.status !== s).length;
      if (other) problems.push(`${s}: ${other} lead(s) with another status`);
    }
    await checkpoint('MLED-003 last status');
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MLED-004 Converted shows only converted leads', async () => {
    const all = await leadsPage.count();
    const count = await leadsPage.selectFilter('Converted');
    const rows = await leadsPage.visibleRows();
    await checkpoint('MLED-004 converted');
    expect(await leadsPage.selectedFilters(), 'selected chips').to.deep.equal(['Converted']);
    const statuses = [...new Set(rows.map((r) => r.status))];
    expect(statuses.filter((s) => (LEAD_STATUSES as readonly string[]).includes(s)), `statuses listed under Converted (${count} of ${all} leads)`).to.deep.equal([]);
    expect(count, 'Converted count vs All').to.be.lessThan(all);
  });

  it('MLED-005 The Source filter lists sources and shows only leads from the chosen one', async function () {
    const all = await leadsPage.count();   // read before the sheet covers the list
    const { options, selected } = await leadsPage.openSourceSheet();
    expect(selected, 'selected source').to.equal(LEAD_TEXTS.anySource);
    expect(options[0], 'first option').to.equal(LEAD_TEXTS.anySource);
    if (!options.includes(leadData.source)) { await leadsPage.closeSourceSheet(); skipBecause(this, `no "${leadData.source}" source`); }
    await checkpoint('MLED-005 sources');
    const count = await leadsPage.chooseSource(leadData.source);
    const rows = await leadsPage.visibleRows();
    await checkpoint('MLED-005 manual');
    expect(rows.length, `"${leadData.source}" leads`).to.be.greaterThan(0);
    expect(rows.filter((r) => r.source !== leadData.source).map((r) => r.source), 'other sources listed').to.deep.equal([]);
    expect(count, `"${leadData.source}" count vs All`).to.be.lessThan(all);
  });

  it('MLED-006 Search finds a lead by name, an unknown name finds none and Clear Filters restores the list', async () => {
    const all = await leadsPage.count();
    await leadsPage.search(leadData.withContactSearch.toUpperCase());
    expect((await leadsPage.visibleRows()).map((r) => r.name), `results for "${leadData.withContactSearch.toUpperCase()}"`).to.include(leadData.withContact);
    await leadsPage.search(leadData.noMatch);
    expect(await leadsPage.isEmptyStateShown(), `"${LEAD_TEXTS.noLeads}"`).to.equal(true);
    expect(await $(leadsPage.selectors.noLeadsHint).isExisting(), `"${LEAD_TEXTS.noLeadsHint}"`).to.equal(true);
    expect(await leadsPage.count(), 'count').to.equal(0);
    await checkpoint('MLED-006 no match');
    await leadsPage.clearFromEmptyState();
    expect(await leadsPage.count(), 'count after Clear Filters').to.be.at.least(all);
  });
});
