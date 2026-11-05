// A message log, read only: Overview, Message Data and Details of an outgoing and an incoming message, and
// Open Conversation (opens the chat; nothing is typed or sent).
import { expect } from 'chai';
import { messageLogPage, LOG_DETAIL_FIELDS, LOG_TEXTS } from '../../../src/pages/WhatsAppLogsPage.js';
import { chatPage } from '../../../src/pages/InboxPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openFirstLog } from '../../helpers/walogs.js';

describe('WhatsApp logs: message log (nothing is sent)', () => {
  requiresAccount();

  it('MWLG-007 An outgoing message log shows its status, contact, message and status timeline', async function () {
    const row = await openFirstLog(this, 'Outgoing');
    const s = messageLogPage.selectors;
    expect(await messageLogPage.text(s.status), 'status badge').to.equal(row.status);
    expect(await messageLogPage.text(s.direction), 'direction').to.equal('Outbound');
    expect(await messageLogPage.text(s.date), 'date').to.match(/^\d{1,2} \w{3}( \d{4})?, \d{1,2}:\d{2} [AP]M$/);
    expect(await $(s.contact(row.contact)).isExisting(), `"Open chat with ${row.contact}"`).to.equal(true);
    expect(await messageLogPage.text(s.message), 'MESSAGE').to.not.equal('');
    const steps = await messageLogPage.timeline();
    await checkpoint('MWLG-007 outgoing');
    expect(steps[0], 'first timeline step').to.equal('Queued');
    expect(steps[steps.length - 1], `last timeline step (${steps.join(' > ')})`).to.equal(row.status);
  });

  it('MWLG-008 Message Data and Details of an outgoing message show the Meta request and IDs', async function () {
    await openFirstLog(this, 'Outgoing');
    await messageLogPage.openTab('Message Data');
    const request = await messageLogPage.text(messageLogPage.selectors.request);
    const response = await messageLogPage.text(messageLogPage.selectors.response);
    expect(request, 'REQUEST payload').to.match(/^\{[\s\S]*"to"/);
    expect(response, 'RESPONSE payload').to.match(/^\{[\s\S]*"messages"/);
    await checkpoint('MWLG-008 message data');
    await messageLogPage.openTab('Details');
    const empty: string[] = [];
    for (const f of LOG_DETAIL_FIELDS) if (!(await messageLogPage.field(f))) empty.push(f);
    expect(empty, 'Details without a value').to.deep.equal([]);
    expect(await messageLogPage.field('Direction'), 'Direction').to.equal('Outbound');
    expect(await messageLogPage.field('Meta ID'), 'Meta ID').to.match(/^wamid\./);
    expect(response, 'RESPONSE carries the Meta ID').to.include(await messageLogPage.field('Meta ID'));
    await checkpoint('MWLG-008 details');
  });

  it('MWLG-009 An incoming message log shows Received, Inbound and no response', async function () {
    const row = await openFirstLog(this, 'Incoming');
    const s = messageLogPage.selectors;
    expect(await messageLogPage.text(s.status), 'status badge').to.equal(row.status);
    expect(await messageLogPage.text(s.direction), 'direction').to.equal('Inbound');
    expect(await messageLogPage.text(s.message), 'MESSAGE').to.not.equal('');
    expect(await messageLogPage.timeline(), 'status timeline').to.include(row.status);
    await checkpoint('MWLG-009 incoming');
    await messageLogPage.openTab('Message Data');
    expect(await messageLogPage.text(s.request), 'REQUEST (the webhook from Meta)').to.match(/^\{[\s\S]*"from"/);
    expect(await $(`android=new UiSelector().text("${LOG_TEXTS.noResponse}")`).isExisting(), `"${LOG_TEXTS.noResponse}"`).to.equal(true);
    await messageLogPage.openTab('Details');
    expect(await messageLogPage.field('Direction'), 'Direction').to.equal('Inbound');
  });

  it('MWLG-010 Open Conversation opens the chat with the contact', async function () {
    const row = await openFirstLog(this, 'Incoming');
    await messageLogPage.openConversation();
    await chatPage.waitForDisplayed(15_000);
    const header = (await $(chatPage.selectors.header).getAttribute('content-desc')) ?? '';
    await checkpoint('MWLG-010 chat');
    expect(header, 'chat header').to.include(row.contact);
  });
});
