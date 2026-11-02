// MINB-010..018 SEND real WhatsApp template messages, one per message type, to INBOX_RECIPIENT only.
// Safety: INBOX_SEND=true is required (otherwise each test selects and fills its template, then stops and
// is SKIPPED); before every send the chat header must show exactly INBOX_RECIPIENT; "Send Template" is
// tapped once and never retried. Types the app cannot send yet are expected to fail (see `defect`).
// Titles are written out (not built in a loop) so the runner and the workbooks can read them.
import { expect } from 'chai';
import { chatPage } from '../../../src/pages/InboxPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { settings } from '../../../src/config/settings.js';
import { inboxTemplates } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openRecipientChat, closeSheetIfOpen } from '../../helpers/inbox.js';
import { skipBecause } from '../../helpers/campaigns.js';

async function sendTemplate(ctx: Mocha.Context, id: (typeof inboxTemplates)[number]['id']): Promise<void> {
  const t = inboxTemplates.find((x) => x.id === id)!;
  await openRecipientChat();
  await chatPage.selectTemplate(t.name);
  if (t.values.length) await chatPage.fillVariables([...t.values]);
  await checkpoint(`${t.id} ready`);
  if (!settings.inbox.send) skipBecause(ctx, 'INBOX_SEND is not "true": template selected and filled, nothing was sent');

  const result = await chatPage.sendSelectedTemplate();
  await checkpoint(`${t.id} after send`);
  expect(result.reason, `"Template not sent" for ${t.name}`).to.equal('');
  expect(result.sent, 'new message in the chat').to.equal(true);
  expect(result.bubble, 'sent message').to.contain(t.expect);
  expect(result.bubble, 'message marked failed').to.not.match(/, Failed, /);
}

describe('Inbox: send one template of each message type to the allowlisted number', () => {
  requiresAccount();
  afterEach(async () => { await closeSheetIfOpen(); });

  it('MINB-010 Send a text template with quick-reply and call buttons', async function () { await sendTemplate(this, 'MINB-010'); });
  it('MINB-011 Send a template with body variables', async function () { await sendTemplate(this, 'MINB-011'); });
  it('MINB-012 Send an image-header template', async function () { await sendTemplate(this, 'MINB-012'); });
  it('MINB-013 Send a carousel template', async function () { await sendTemplate(this, 'MINB-013'); });
  it('MINB-014 Send a utility template with a variable', async function () { await sendTemplate(this, 'MINB-014'); });
  it('MINB-015 Send a template with a flow button', async function () { await sendTemplate(this, 'MINB-015'); });
  it('MINB-016 Send a template with a text-header variable and buttons', async function () { await sendTemplate(this, 'MINB-016'); });
  it('MINB-017 Send a location-header template', async function () { await sendTemplate(this, 'MINB-017'); });
  it('MINB-018 Send an authentication (one-time code) template', async function () { await sendTemplate(this, 'MINB-018'); });
});
