import { expect } from 'chai';
import { campaignsPage, CAMPAIGN_TYPES, CAMPAIGN_STATUSES, type CampaignRow } from '../../../src/pages/CampaignsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { campaignSearch } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCampaignList, skipBecause } from '../../helpers/campaigns.js';

const contains = (row: CampaignRow, term: string) => row.name.toLowerCase().includes(term.toLowerCase());

/** Longest word (3+ letters) of a campaign name, used as a partial search term. */
function wordFrom(rows: CampaignRow[]): string | null {
  const words = rows.flatMap((r) => r.name.split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length >= 3);
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

describe('Campaigns: search', () => {
  requiresAccount();
  let all: CampaignRow[];
  beforeEach(async () => {
    await openCampaignList();
    all = await campaignsPage.allRows();
  });

  it('MCMP-008 Search by part of a name is case-insensitive', async function () {
    const word = wordFrom(all);
    if (!word) skipBecause(this, 'no campaign name with a word of 3+ letters');
    const expected = all.filter((r) => contains(r, word)).map((r) => r.label);
    await campaignsPage.search(word.toUpperCase());
    const shown = (await campaignsPage.allRows()).map((r) => r.label);
    await checkpoint('MCMP-008 upper-case search');
    expect(shown, `results for "${word.toUpperCase()}"`).to.have.members(expected);
  });

  it('MCMP-009 Search updates the filter chip counts to the matching campaigns', async function () {
    const word = wordFrom(all);
    if (!word) skipBecause(this, 'no campaign name with a word of 3+ letters');
    const hits = all.filter((r) => contains(r, word));
    await campaignsPage.search(word);
    const counts = await campaignsPage.filterCounts();
    expect(counts.All, '"All"').to.equal(hits.length);
    for (const t of CAMPAIGN_TYPES) expect(counts[t], `"${t}"`).to.equal(hits.filter((r) => r.type === t).length);
    for (const s of CAMPAIGN_STATUSES) expect(counts[s], `"${s}"`).to.equal(hits.filter((r) => r.status === s).length);
    expect(await campaignsPage.headerCount(), 'title count is hidden while searching').to.equal(null);
  });

  it('MCMP-010 No match shows the empty state and Clear Filters resets search and filter', async () => {
    await campaignsPage.selectFilter('Drip');
    await campaignsPage.search(campaignSearch.noMatch);
    expect(await campaignsPage.isEmptyStateShown(), '"No campaigns found" with hint').to.equal(true);
    expect((await campaignsPage.filterCounts()).All, '"All" count').to.equal(0);
    await checkpoint('MCMP-010 empty state');
    await campaignsPage.clearFilters();
    expect(await campaignsPage.searchText(), 'search text').to.equal('');
    expect(await campaignsPage.selectedFilter(), 'selected chip').to.equal('All');
    expect((await campaignsPage.allRows()).length, 'rows').to.equal(all.length);
  });

  it('MCMP-011 Clear search (X) restores the full list', async () => {
    await campaignsPage.search(campaignSearch.noMatch);
    await campaignsPage.clearSearch();
    expect(await campaignsPage.searchText(), 'search text').to.equal('');
    expect((await campaignsPage.allRows()).length, 'rows').to.equal(all.length);
  });

  // The empty state says "Try another name, type or status." On 2026-10-30 searching a type
  // ("drip") matched names only, and a status ("active", "paused") matched nothing: defect MCMP-D02.
  it('MCMP-012 Search finds campaigns by type and status, as the empty-state hint says', async () => {
    const missing: string[] = [];
    for (const term of [...CAMPAIGN_TYPES, ...CAMPAIGN_STATUSES]) {
      const expected = all.filter((r) => r.type === term || r.status === term || contains(r, term));
      if (!expected.length) continue;
      await campaignsPage.search(term.toLowerCase());
      const shown = (await campaignsPage.isEmptyStateShown(2_000)) ? [] : await campaignsPage.allRows();
      await checkpoint(`MCMP-012 search ${term}`);
      if (shown.length < expected.length) missing.push(`"${term.toLowerCase()}": ${shown.length} of ${expected.length}`);
      await campaignsPage.clearSearch();
    }
    expect(missing, 'searches that miss campaigns of that type/status').to.deep.equal([]);
  });
});
