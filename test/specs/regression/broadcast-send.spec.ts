// MBRD-020 creates and SENDS a real WhatsApp broadcast. Safety rules (all must hold, or nothing is sent):
// - BROADCAST_SEND=true, otherwise the test runs every check and is SKIPPED before "Send Now";
// - the audience is "Tags: BROADCAST_TAG", never All contacts, a list or a segment;
// - before sending, each BROADCAST_ALLOWLIST number has exactly one contact and that contact has the tag;
// - "Send Now" is tapped once and never retried;
// - afterwards the broadcast's recipients must be exactly the allowlist, or the test fails loudly.
// A contact carrying the tag that is not on the allowlist cannot be seen from the phone beforehand (the
// app shows no count for tags, MBRD-D01), so the tag must be unique to the allowlisted contacts.
import { expect } from 'chai';
import { broadcastsPage, broadcastDetailPage } from '../../../src/pages/BroadcastsPage.js';
import { newBroadcastPage } from '../../../src/pages/NewBroadcastPage.js';
import { contactsPage } from '../../../src/pages/ContactsPage.js';
import { launchSignedIn } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { settings } from '../../../src/config/settings.js';
import { account } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { discardIfOpen } from '../../helpers/broadcasts.js';
import { skipBecause } from '../../helpers/campaigns.js';

const { allowlist, tag, template, send } = settings.broadcast;

describe('Broadcasts: create and send to the allowlist', () => {
  requiresAccount();
  afterEach(async () => { await discardIfOpen(); });

  it('MBRD-020 Create and send a broadcast to the allowlisted tag, then check its recipients', async function () {
    if (!allowlist.length || !tag) skipBecause(this, 'BROADCAST_ALLOWLIST / BROADCAST_TAG not configured');
    await launchSignedIn(account.email, account.password);

    // 1. Each allowlisted number: exactly one contact, carrying the tag.
    await contactsPage.open();
    for (const phone of allowlist) {
      const hits = await contactsPage.findByPhone(phone);
      expect(hits.length, `contacts with ${phone}`).to.equal(1);
      expect(await contactsPage.hasTag(hits[0]!.label, tag), `${phone} carries "${tag}"`).to.equal(true);
    }

    // 2. Wizard: name, first connected number, Tags = tag, template, Send now.
    const name = `QA_Mobile_BC_${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}`;
    await broadcastsPage.open();
    await broadcastsPage.startNewBroadcast();
    await newBroadcastPage.waitForStep('Audience', 15_000);
    await newBroadcastPage.enterName(name);
    const sender = await newBroadcastPage.chooseFirstSender();
    await newBroadcastPage.chooseAudience('Tags');
    await newBroadcastPage.addTag(tag);
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Template');
    await newBroadcastPage.chooseTemplate(template);
    await newBroadcastPage.next();
    await newBroadcastPage.waitForStep('Review');
    const review = await newBroadcastPage.review();
    await checkpoint('MBRD-020 review');
    expect(review, 'review before sending').to.deep.equal({ audience: `Tags: ${tag}`, template, sender, sendNow: true });
    const confirmation = await newBroadcastPage.openSendConfirmation();
    expect(confirmation, 'confirmation').to.equal(`Tags: ${tag}. Sending starts now.`);
    await checkpoint('MBRD-020 confirmation');
    if (!send) {
      await newBroadcastPage.cancelConfirmation();
      skipBecause(this, 'BROADCAST_SEND is not "true": every check passed, nothing was sent');
    }

    // 3. Send once.
    await newBroadcastPage.confirmSend();
    await broadcastDetailPage.waitForDisplayed(30_000);
    expect(await broadcastDetailPage.isTitled(name), 'detail of the new broadcast').to.equal(true);
    await checkpoint('MBRD-020 sent');

    // 4. Recipients must be exactly the allowlist; then the list shows the broadcast.
    const recipients = await broadcastDetailPage.recipients();
    expect(recipients.map((r) => r.phone).sort(), 'recipients').to.deep.equal([...allowlist].sort());
    expect(await broadcastDetailPage.audienceLine(), 'audience line').to.equal(`Tags: ${tag}. ${allowlist.length} contacts`);
    expect(await broadcastDetailPage.templateName(), 'template').to.equal(template);
    await broadcastDetailPage.goBack();
    const row = await broadcastsPage.rowLabel(name);
    await checkpoint('MBRD-020 list');
    expect(row, 'list row').to.match(new RegExp(`, ${template}, ${allowlist.length} recipients, (Sending|Sent),`));
  });
});
