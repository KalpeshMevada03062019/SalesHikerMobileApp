// Chatbots list, read only: status counts and filters, search. The on/off switches are never tapped.
import { expect } from 'chai';
import { chatbotsPage, CHATBOT_STATUSES } from '../../../src/pages/ChatbotsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { chatbotData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openChatbots } from '../../helpers/chatbots.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Chatbots: list, filters and search', () => {
  requiresAccount();
  beforeEach(async () => { await openChatbots(); });

  it('MCBT-002 Status counts add up to the total', async () => {
    const all = await chatbotsPage.filterCount('All');
    let sum = 0;
    for (const s of CHATBOT_STATUSES) sum += await chatbotsPage.filterCount(s);
    expect(sum, 'Active + Paused + Draft + Archived').to.equal(all);
    expect(await chatbotsPage.filterCount('Attention'), 'Attention (a flag, not a status)').to.be.at.most(all);
  });

  it('MCBT-003 Active and Draft filters show only chatbots with that status', async () => {
    const problems: string[] = [];
    for (const s of ['Active', 'Draft'] as const) {
      const chip = await chatbotsPage.filterCount(s);
      await chatbotsPage.selectFilter(s);
      const rows = await chatbotsPage.visibleRows();
      const other = rows.filter((r) => r.status !== s).map((r) => r.name);
      if (other.length) problems.push(`${s}: other statuses listed (${other.join(', ')})`);
      if ((await chatbotsPage.count()) !== chip) problems.push(`${s}: "N chatbots" ${await chatbotsPage.count()} vs chip ${chip}`);
      await checkpoint(`MCBT-003 ${s}`);
    }
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MCBT-004 Search by part of a name is case-insensitive and an unknown name finds none', async function () {
    const first = (await chatbotsPage.visibleRows())[0];
    if (!first) skipBecause(this, 'no chatbots listed');
    const word = first.name.split(/\s+/).sort((a, b) => b.length - a.length)[0]!;
    await chatbotsPage.search(word.toUpperCase());
    expect((await chatbotsPage.visibleRows()).map((r) => r.name), `results for "${word.toUpperCase()}"`).to.include(first.name);
    await chatbotsPage.search(chatbotData.noMatch);
    expect(await chatbotsPage.isEmptyStateShown(), '"No chatbots found"').to.equal(true);
    expect(await chatbotsPage.count(), 'count').to.equal(0);
    await checkpoint('MCBT-004 no match');
  });
});
