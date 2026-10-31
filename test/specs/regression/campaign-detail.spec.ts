import { expect } from 'chai';
import { campaignsPage } from '../../../src/pages/CampaignsPage.js';
import { campaignDetailPage, contactProfilePage, DELIVERY_METRICS } from '../../../src/pages/CampaignDetailPage.js';
import { morePage } from '../../../src/pages/MorePage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCampaignList, skipBecause } from '../../helpers/campaigns.js';

describe('Campaigns: detail screen', () => {
  requiresAccount();
  beforeEach(async () => { await openCampaignList(); });

  it('MCMP-013 Detail opens with the name, status, type and enrolment of the tapped row', async () => {
    const row = await campaignsPage.openRow(0);
    await campaignDetailPage.waitForDisplayed();
    expect(await campaignDetailPage.isTitled(row.name), 'title').to.equal(true);
    expect(await campaignDetailPage.status(), 'status pill').to.equal(row.status);
    const { type, started } = await campaignDetailPage.typeAndStart();
    expect(type, 'type').to.equal(row.type);
    expect(started, 'start date').to.equal(row.date);
    const enrolment = await campaignDetailPage.enrolment();
    expect(enrolment.enrolled, 'enrolled').to.equal(row.enrolled);
    expect(enrolment.active + enrolment.done, 'active + done').to.equal(enrolment.enrolled);
    await checkpoint('MCMP-013 detail');
  });

  it('MCMP-014 Delivery tiles agree with the list and their percentages', async function () {
    const row = await campaignsPage.openFirstRowWhere((r) => r.sent > 0);
    if (!row) skipBecause(this, 'no campaign has sent messages');
    await campaignDetailPage.waitForDisplayed();
    const tiles = await campaignDetailPage.delivery();
    await checkpoint('MCMP-014 delivery');
    expect(tiles.Sent.count, 'Sent vs list row').to.equal(row.sent);
    for (const metric of DELIVERY_METRICS.filter((m) => m !== 'Sent')) {
      const { count, percent } = tiles[metric];
      expect(count, `${metric} <= Sent`).to.be.at.most(tiles.Sent.count);
      expect(percent, `${metric} percentage`).to.equal(Math.round((count / tiles.Sent.count) * 100));
    }
    expect(tiles.Read.count, 'Read <= Delivered').to.be.at.most(tiles.Delivered.count);
  });

  it('MCMP-015 Campaign with nobody enrolled shows no delivery stats and "No recipients yet"', async function () {
    const row = await campaignsPage.openFirstRowWhere((r) => r.enrolled === 0);
    if (!row) skipBecause(this, 'every campaign has enrolments');
    await campaignDetailPage.waitForDisplayed();
    expect(await campaignDetailPage.hasDeliverySection(), 'DELIVERY section').to.equal(false);
    expect(await campaignDetailPage.isNoRecipientsShown(), '"No recipients yet"').to.equal(true);
    await checkpoint('MCMP-015 empty campaign');
  });

  it('MCMP-016 Detail lists the steps and says edits are made on the web app', async () => {
    await campaignsPage.openRow(0);
    await campaignDetailPage.waitForDisplayed();
    expect(await campaignDetailPage.stepCount(), 'numbered steps').to.be.greaterThan(0);
    expect(await campaignDetailPage.isReadOnlyNoteShown(), 'web-app note').to.equal(true);
    await checkpoint('MCMP-016 steps');
  });

  it('MCMP-017 A recipient opens the contact profile and Back returns to the campaign', async function () {
    const row = await campaignsPage.openFirstRowWhere((r) => r.enrolled > 0);
    if (!row) skipBecause(this, 'no campaign has enrolments');
    await campaignDetailPage.waitForDisplayed();
    const recipient = await campaignDetailPage.openRecipient(0);
    await contactProfilePage.waitForDisplayed();
    expect(await contactProfilePage.isFor(recipient.name), 'profile of the tapped recipient').to.equal(true);
    await checkpoint('MCMP-017 contact profile');
    await driver.back();
    await campaignDetailPage.waitForDisplayed();
    expect(await campaignDetailPage.isTitled(row.name), 'back on the same campaign').to.equal(true);
  });

  it('MCMP-018 Back goes from detail to the list and from the list to More', async () => {
    await campaignsPage.openRow(0);
    await campaignDetailPage.waitForDisplayed();
    await campaignDetailPage.goBack();
    await campaignsPage.waitForDisplayed();
    await campaignsPage.goBack();
    await morePage.waitForDisplayed();
    await checkpoint('MCMP-018 back on More');
  });

  // A WhatsApp reply means the message reached the contact, so it must count as delivered and read.
  // On 2026-10-30 two campaigns showed a "Replied" recipient with Delivered 0 and Read 0: MCMP-D01.
  it('MCMP-019 Recipients who replied are counted as delivered and read', async function () {
    let checked = 0;
    const rows = (await campaignsPage.visibleRows()).filter((r) => r.sent > 0);
    for (const row of rows) {
      await campaignsPage.openFirstRowWhere((r) => r.label === row.label);
      await campaignDetailPage.waitForDisplayed();
      const replied = (await campaignDetailPage.recipients()).filter((r) => r.status === 'Replied').length;
      if (replied > 0) {
        checked++;
        await campaignDetailPage.scrollTo('DELIVERY');
        const tiles = await campaignDetailPage.delivery();
        await checkpoint(`MCMP-019 ${checked}`);
        expect(tiles.Delivered.count, `Delivered (${replied} replied)`).to.be.at.least(replied);
        expect(tiles.Read.count, `Read (${replied} replied)`).to.be.at.least(replied);
      }
      await campaignDetailPage.goBack();
      await campaignsPage.waitForDisplayed();
    }
    if (!checked) skipBecause(this, 'no visible campaign has a recipient who replied');
  });
});
