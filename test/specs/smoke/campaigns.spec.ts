import { expect } from 'chai';
import { campaignsPage, CAMPAIGN_FILTERS } from '../../../src/pages/CampaignsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCampaignList } from '../../helpers/campaigns.js';

describe('Smoke: campaigns', () => {
  requiresAccount();

  it('MCMP-001 Campaign list opens from More with search, filters and campaigns', async () => {
    await openCampaignList();
    expect(await campaignsPage.headerCount(), 'count under the title').to.be.a('number');
    for (const filter of CAMPAIGN_FILTERS) {
      expect(await $(campaignsPage.selectors.chip(filter)).isExisting(), `"${filter}" filter`).to.equal(true);
    }
    expect(await campaignsPage.selectedFilter(), 'default filter').to.equal('All');
    const rows = await campaignsPage.visibleRows();
    expect(rows.length, 'campaign rows').to.be.greaterThan(0);
    await checkpoint('MCMP-001 campaign list');
  });
});
