// New Broadcast wizard, from step 1 to the "Send this broadcast?" confirmation. Nothing is ever sent
// or saved here: every test ends with Cancel / Discard (afterEach makes sure of it).
import { expect } from 'chai';
import { broadcastsPage } from '../../../src/pages/BroadcastsPage.js';
import { newBroadcastPage, BROADCAST_TEXTS } from '../../../src/pages/NewBroadcastPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { settings } from '../../../src/config/settings.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openNewBroadcast, discardIfOpen } from '../../helpers/broadcasts.js';
import { skipBecause } from '../../helpers/campaigns.js';

const template = settings.broadcast.template;
const draftName = () => `QA_Mobile_Draft_${Date.now()}`;

describe('Broadcasts: New Broadcast wizard (nothing is sent)', () => {
  requiresAccount();
  beforeEach(async () => { await openNewBroadcast(); });
  afterEach(async () => { await discardIfOpen(); });

  it('MBRD-002 Step 1 starts with no audience chosen and the first connected number as sender', async () => {
    for (const kind of ['All contacts', 'Saved list', 'Segment', 'Tags'] as const) {
      expect(await newBroadcastPage.isAudienceChecked(kind), `"${kind}" pre-selected`).to.equal(false);
    }
    expect(await newBroadcastPage.allContactsCount(), '"All contacts" shows its size').to.be.greaterThan(0);
    const numbers = await newBroadcastPage.openSenderOptions();
    await checkpoint('MBRD-002 send from options');
    await newBroadcastPage.closeSheet();
    expect(numbers.length, 'connected numbers').to.be.greaterThan(0);
    expect(await newBroadcastPage.senderNumber(), 'default sender').to.equal(numbers[0]);
  });

  it('MBRD-003 Step 1 blocks Next without a name or an audience', async () => {
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.next();
    expect(await newBroadcastPage.step(), 'still on step 1').to.equal('Audience');
    expect(await newBroadcastPage.isErrorShown(BROADCAST_TEXTS.nameTooShort), 'name error').to.equal(true);
    expect(await newBroadcastPage.isErrorShown(BROADCAST_TEXTS.addTag), 'tag error').to.equal(true);
    await checkpoint('MBRD-003 step 1 errors');
  });

  it('MBRD-004 A one-character name is rejected', async () => {
    await newBroadcastPage.enterName('Q');
    await newBroadcastPage.next();
    expect(await newBroadcastPage.step(), 'still on step 1').to.equal('Audience');
    expect(await newBroadcastPage.isErrorShown(BROADCAST_TEXTS.nameTooShort), 'name error').to.equal(true);
  });

  it('MBRD-005 Saved list and Segment pickers offer named audiences with their sizes', async () => {
    await newBroadcastPage.chooseAudience('Saved list');
    const lists = await newBroadcastPage.pickerOptions('Saved list');
    await checkpoint('MBRD-005 saved lists');
    await newBroadcastPage.closeSheet();
    await newBroadcastPage.chooseAudience('Segment');
    const segments = await newBroadcastPage.pickerOptions('Segment');
    await checkpoint('MBRD-005 segments');
    // Pick the smallest segment with members and check the "N contacts match." line agrees (nothing is sent).
    const smallest = segments.filter((s) => s.count > 0).sort((a, b) => a.count - b.count)[0];
    if (smallest) await newBroadcastPage.chooseOption(smallest.label); else await newBroadcastPage.closeSheet();
    expect(lists.length, 'saved lists offered').to.be.greaterThan(0);
    expect(segments.length, 'segments offered').to.be.greaterThan(0);
    if (smallest) expect(await newBroadcastPage.matchCount(), `"${smallest.name}" match count`).to.equal(smallest.count);
  });

  it('MBRD-006 Step 2 requires a template', async () => {
    await newBroadcastPage.enterName(draftName());
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(settings.broadcast.tag || 'qa_mobile_no_send');
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    await newBroadcastPage.next();
    expect(await newBroadcastPage.step(), 'still on step 2').to.equal('Template');
    expect(await newBroadcastPage.isErrorShown(BROADCAST_TEXTS.pickTemplate), '"Pick a template."').to.equal(true);
  });

  it('MBRD-007 Template search is case-insensitive and reports no match', async () => {
    await newBroadcastPage.enterName(draftName());
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(settings.broadcast.tag || 'qa_mobile_no_send');
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    const found = await newBroadcastPage.searchTemplates(template.toUpperCase());
    expect(found, `results for "${template.toUpperCase()}"`).to.include(template);
    await newBroadcastPage.searchTemplates('qa_no_such_template_zz');
    expect(await newBroadcastPage.isNoTemplatesShown(), '"No templates found"').to.equal(true);
    await checkpoint('MBRD-007 no templates');
    await newBroadcastPage.closeSheet();
  });

  it('MBRD-008 Choosing an approved template shows its status and a WhatsApp preview', async () => {
    await newBroadcastPage.enterName(draftName());
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(settings.broadcast.tag || 'qa_mobile_no_send');
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    await newBroadcastPage.chooseTemplate(template);
    const details = await newBroadcastPage.templateDetails();
    await checkpoint('MBRD-008 template preview');
    expect(details.approved, '"Approved"').to.equal(true);
    expect(details.preview, 'WhatsApp preview').to.equal(true);
  });

  it('MBRD-009 Review summarises the choices, defaults to Send now and asks before sending', async () => {
    const name = draftName();
    await newBroadcastPage.enterName(name);
    const sender = await newBroadcastPage.chooseFirstSender();
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(settings.broadcast.tag || 'qa_mobile_no_send');
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    await newBroadcastPage.chooseTemplate(template);
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Review');
    const review = await newBroadcastPage.review();
    expect(review.template, 'template').to.equal(template);
    expect(review.sender, 'sender').to.equal(sender);
    expect(review.audience, 'audience').to.equal(`Tags: ${settings.broadcast.tag || 'qa_mobile_no_send'}`);
    expect(review.sendNow, '"Send now" selected').to.equal(true);
    expect(await newBroadcastPage.isErrorShown(BROADCAST_TEXTS.sendNowHint), 'send-now hint').to.equal(true);
    await checkpoint('MBRD-009 review');
    const message = await newBroadcastPage.openSendConfirmation();
    await checkpoint('MBRD-009 confirmation');
    expect(message, 'confirmation names the audience').to.contain(settings.broadcast.tag || 'qa_mobile_no_send');
    await newBroadcastPage.cancelConfirmation();   // never "Send Now" here
    expect(await newBroadcastPage.step(), 'back on review').to.equal('Review');
  });

  it('MBRD-010 Back keeps the entries of earlier steps', async () => {
    const name = draftName();
    await newBroadcastPage.enterName(name);
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(settings.broadcast.tag || 'qa_mobile_no_send');
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    await newBroadcastPage.chooseTemplate(template);
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Review');
    await newBroadcastPage.backToPreviousStep();
    await newBroadcastPage.waitForStep('Template');
    expect(await $(`~Template: ${template}`).isExisting(), 'template kept').to.equal(true);
    await newBroadcastPage.backToPreviousStep();
    await newBroadcastPage.waitForStep('Audience');
    expect(await $(newBroadcastPage.selectors.name).getText(), 'name kept').to.equal(name);
    expect(await newBroadcastPage.isAudienceChecked('Tags'), 'audience kept').to.equal(true);
  });

  it('MBRD-011 Closing asks to discard, Cancel keeps editing and Discard saves nothing', async () => {
    const name = draftName();
    await newBroadcastPage.enterName(name);
    await newBroadcastPage.close();
    expect(await newBroadcastPage.isDiscardMessageShown(), '"This broadcast is not saved yet."').to.equal(true);
    await checkpoint('MBRD-011 discard prompt');
    await newBroadcastPage.keepEditing();
    expect(await newBroadcastPage.step(), 'still in the wizard').to.equal('Audience');
    await newBroadcastPage.close();
    await newBroadcastPage.discard();
    await broadcastsPage.waitForDisplayed();
    expect(await broadcastsPage.rowLabel(name, 3_000), 'discarded broadcast listed').to.equal(null);
  });

  // The review and the confirmation show a recipient count for lists and segments, but not for tags:
  // the user confirms a send without knowing how many contacts it reaches (MBRD-D01).
  it('MBRD-012 Review shows how many contacts a Tags audience reaches before sending', async function () {
    if (!settings.broadcast.tag) skipBecause(this, 'BROADCAST_TAG not configured');
    await newBroadcastPage.enterName(draftName());
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(settings.broadcast.tag);
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    await newBroadcastPage.chooseTemplate(template);
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Review');
    const { audience } = await newBroadcastPage.review();
    const message = await newBroadcastPage.openSendConfirmation();
    await checkpoint('MBRD-012 tags confirmation');
    await newBroadcastPage.cancelConfirmation();
    expect(`${audience} | ${message}`, 'recipient count before sending').to.match(/\d+ contacts?/);
  });
});
