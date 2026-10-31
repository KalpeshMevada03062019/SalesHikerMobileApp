import { expect } from 'chai';
import { broadcastsPage, BROADCAST_FILTERS } from '../../../src/pages/BroadcastsPage.js';
import { newBroadcastPage } from '../../../src/pages/NewBroadcastPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openBroadcastList, discardIfOpen } from '../../helpers/broadcasts.js';

describe('Smoke: broadcasts', () => {
  requiresAccount();
  afterEach(async () => { await discardIfOpen(); });

  it('MBRD-001 Broadcast list opens with status filters and New Broadcast starts the wizard', async () => {
    await openBroadcastList();
    const total = await broadcastsPage.headerCount();
    expect(await broadcastsPage.filterCount('All'), '"All" chip vs "N broadcasts"').to.equal(total);
    for (const filter of BROADCAST_FILTERS) {
      expect(await $(broadcastsPage.selectors.chip(filter)).isExisting(), `"${filter}" filter`).to.equal(true);
    }
    await checkpoint('MBRD-001 broadcast list');
    await broadcastsPage.startNewBroadcast();
    await newBroadcastPage.waitForStep('Audience', 15_000);
    await checkpoint('MBRD-001 new broadcast');
  });
});
