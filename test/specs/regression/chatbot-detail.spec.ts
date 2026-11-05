// Chatbot detail, read only: an Active and a Draft chatbot, the actions menu (opened and closed) and the
// Test simulator (opened; nothing typed). Switch, Send test, Duplicate, Archive and Delete are never used.
import { expect } from 'chai';
import { chatbotsPage, chatbotDetailPage, CHATBOT_ACTIONS, CHATBOT_TEXTS } from '../../../src/pages/ChatbotsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openChatbots } from '../../helpers/chatbots.js';
import { skipBecause } from '../../helpers/campaigns.js';

/** Opens the first listed chatbot with a status (and, for Active, a keyword trigger); returns its row. */
async function openFirst(ctx: Mocha.Context, status: 'Active' | 'Draft') {
  await openChatbots();
  await chatbotsPage.selectFilter(status);
  const row = (await chatbotsPage.visibleRows()).find((r) => r.status === status && (status !== 'Active' || r.trigger.startsWith('Keyword')));
  if (!row) skipBecause(ctx, `no ${status} chatbot${status === 'Active' ? ' with keywords' : ''}`);
  await chatbotsPage.openChatbot(row.name);
  await chatbotDetailPage.waitForDisplayed(15_000);
  return row;
}

describe('Chatbots: detail (nothing is changed)', () => {
  requiresAccount();

  it('MCBT-005 An active chatbot shows its stats, trigger keywords, numbers and flow', async function () {
    const row = await openFirst(this, 'Active');
    expect(await chatbotDetailPage.isTitled(row.name), 'title').to.equal(true);
    expect(await chatbotDetailPage.status(), 'status').to.equal('Active');
    expect(await chatbotDetailPage.switchLabel(), 'switch').to.match(/^Chatbot on\. Pause$/);
    for (const m of ['Sessions', 'Completion', 'Hand-offs'] as const) expect(await chatbotDetailPage.metric(m), m).to.match(/^(\d+%?|None)$/);
    const keywords = row.trigger.replace(/^Keyword: /, '').split(', ');
    const missing = [];
    for (const k of keywords) if (!(await chatbotDetailPage.hasKeyword(k))) missing.push(k);
    expect(missing, `keywords from the list ("${row.trigger}") missing on the detail`).to.deep.equal([]);
    expect(await $(chatbotDetailPage.selectors.exactHint).isExisting(), 'keyword match hint').to.equal(true);
    await checkpoint('MCBT-005 active');
    await chatbotDetailPage.scrollToFlow();
    expect(await $(chatbotDetailPage.selectors.flowSteps).isExisting(), '"N steps in the draft"').to.equal(true);
  });

  it('MCBT-006 A draft chatbot cannot be switched on from the phone', async function () {
    await openFirst(this, 'Draft');
    expect(await chatbotDetailPage.status(), 'status').to.equal('Draft');
    expect(await chatbotDetailPage.switchLabel(), 'switch').to.equal(`Chatbot off. ${CHATBOT_TEXTS.draftSwitch}`);
    expect(await $(chatbotDetailPage.selectors.draftHint).isExisting(), '"Publish on the web to turn on."').to.equal(true);
    await checkpoint('MCBT-006 draft');
  });

  it('MCBT-007 The actions menu offers settings, test, history and management actions', async function () {
    await openFirst(this, 'Draft');
    const options = await chatbotDetailPage.actionOptions();   // closed again without choosing
    expect(options, 'Chatbot actions').to.deep.equal([...CHATBOT_ACTIONS]);
  });

  it('MCBT-008 Test opens a simulator that sends nothing to WhatsApp', async function () {
    await openFirst(this, 'Draft');
    expect(await chatbotDetailPage.openTestSimulator(), '"Nothing is sent to WhatsApp."').to.equal(true);
    await checkpoint('MCBT-008 test simulator');
    await chatbotDetailPage.goBack();
  });
});
