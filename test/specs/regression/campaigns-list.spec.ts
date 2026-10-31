import { expect } from 'chai';
import { campaignsPage, CAMPAIGN_TYPES, CAMPAIGN_STATUSES, type CampaignFilter } from '../../../src/pages/CampaignsPage.js';
import { campaignDetailPage } from '../../../src/pages/CampaignDetailPage.js';
import { morePage } from '../../../src/pages/MorePage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCampaignList, skipBecause } from '../../helpers/campaigns.js';

describe('Campaigns: list and filters', () => {
  requiresAccount();
  beforeEach(async () => { await openCampaignList(); });

  it('MCMP-002 Each row shows name, date, type, enrolled, sent and status', async () => {
    const rows = await campaignsPage.allRows();   // throws if a row label is not in this format
    expect(rows.length, 'rows').to.be.greaterThan(0);
    for (const row of rows) {
      expect(row.name, `name in "${row.label}"`).to.not.equal('');
      expect([...CAMPAIGN_TYPES], `type in "${row.label}"`).to.include(row.type);
      expect([...CAMPAIGN_STATUSES], `status in "${row.label}"`).to.include(row.status);
      expect(row.sent, `sent <= enrolled in "${row.label}"`).to.be.at.most(row.enrolled);
    }
    expect(await campaignsPage.isEndOfListShown(), 'end-of-list footer').to.equal(true);
    await checkpoint('MCMP-002 rows');
  });

  it('MCMP-003 Header count and "All" chip count match the number of campaigns', async () => {
    const header = await campaignsPage.headerCount();
    const all = await campaignsPage.filterCount('All');
    const rows = await campaignsPage.allRows();
    expect(header, 'count under the title').to.equal(rows.length);
    expect(all, '"All" chip count').to.equal(rows.length);
  });

  /** Applies each filter and checks its rows against the chip count and the unfiltered list. */
  async function checkFilters(id: string, filters: CampaignFilter[], field: 'type' | 'status'): Promise<void> {
    const all = await campaignsPage.allRows();
    for (const filter of filters) {
      const chipCount = await campaignsPage.filterCount(filter);
      await campaignsPage.selectFilter(filter);
      const shown = chipCount === 0 ? [] : await campaignsPage.allRows();
      await checkpoint(`${id} ${filter}`);
      expect(shown.filter((r) => r[field] !== filter).map((r) => r.label), `rows outside "${filter}"`).to.deep.equal([]);
      expect(shown.length, `"${filter}" rows vs chip count`).to.equal(chipCount);
      expect(shown.length, `"${filter}" rows vs the full list`).to.equal(all.filter((r) => r[field] === filter).length);
    }
  }

  it('MCMP-004 Type filters show only campaigns of that type and match the chip count', async () => {
    await checkFilters('MCMP-004', [...CAMPAIGN_TYPES], 'type');
  });

  it('MCMP-005 Status filters show only campaigns with that status and match the chip count', async () => {
    await checkFilters('MCMP-005', [...CAMPAIGN_STATUSES], 'status');
  });

  it('MCMP-006 Selected filter is marked and "All" restores the full list', async () => {
    const total = (await campaignsPage.allRows()).length;
    await campaignsPage.selectFilter('Paused');
    expect(await campaignsPage.selectedFilter(), 'selected chip').to.equal('Paused');
    await checkpoint('MCMP-006 paused selected');
    await campaignsPage.selectFilter('All');
    expect(await campaignsPage.selectedFilter(), 'selected chip').to.equal('All');
    expect((await campaignsPage.allRows()).length, 'rows after "All"').to.equal(total);
  });

  it('MCMP-007 Filter is kept after opening a campaign and resets when the list is reopened', async function () {
    if ((await campaignsPage.filterCount('Active')) === 0) skipBecause(this, 'no Active campaign in the account');
    await campaignsPage.selectFilter('Active');
    const filtered = (await campaignsPage.allRows()).length;
    await campaignsPage.openRow(0);
    await campaignDetailPage.waitForDisplayed();
    await campaignDetailPage.goBack();
    await campaignsPage.waitForDisplayed();
    expect(await campaignsPage.selectedFilter(), 'filter after Back from detail').to.equal('Active');
    expect((await campaignsPage.allRows()).length, 'rows after Back from detail').to.equal(filtered);
    await campaignsPage.goBack();
    await morePage.waitForDisplayed();
    await morePage.openCampaigns();
    await campaignsPage.waitForDisplayed();
    expect(await campaignsPage.selectedFilter(), 'filter after reopening the list').to.equal('All');
    await checkpoint('MCMP-007 reopened list');
  });
});
