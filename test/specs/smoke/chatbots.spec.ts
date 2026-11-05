import { expect } from 'chai';
import { chatbotsPage, CHATBOT_FILTERS } from '../../../src/pages/ChatbotsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openChatbots } from '../../helpers/chatbots.js';

describe('Smoke: chatbots', () => {
  requiresAccount();

  it('MCBT-001 Chatbots opens with the count, search, status filters and chatbots', async () => {
    await openChatbots();
    const total = await chatbotsPage.count();
    expect(total, 'chatbots').to.be.greaterThan(0);
    for (const f of CHATBOT_FILTERS) expect(await chatbotsPage.filterCount(f), `"${f}" filter`).to.be.a('number');
    expect(await chatbotsPage.filterCount('All'), '"All" vs "N chatbots"').to.equal(total);
    expect((await chatbotsPage.visibleRows()).length, 'rows').to.be.greaterThan(0);
    await checkpoint('MCBT-001 chatbots');
  });
});
