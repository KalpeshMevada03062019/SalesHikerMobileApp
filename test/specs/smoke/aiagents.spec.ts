import { expect } from 'chai';
import { aiAgentsPage, AGENT_FILTERS } from '../../../src/pages/AiAgentsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openAiAgents } from '../../helpers/aiagents.js';

describe('Smoke: AI agents', () => {
  requiresAccount();

  it('MAIA-001 AI Agents opens with the count, credits, search, status filters and agents', async () => {
    await openAiAgents();
    const total = await aiAgentsPage.count();
    expect(total, 'agents').to.be.greaterThan(0);
    expect(await $(aiAgentsPage.selectors.credits).isExisting(), '"AI credits: N left"').to.equal(true);
    expect(await $(aiAgentsPage.selectors.search).isExisting(), 'Search agents').to.equal(true);
    for (const f of AGENT_FILTERS) expect(await aiAgentsPage.filterCount(f), `"${f}" filter`).to.be.a('number');
    expect(await aiAgentsPage.filterCount('All'), '"All" vs "N agents"').to.equal(total);
    expect((await aiAgentsPage.visibleRows()).length, 'rows').to.be.greaterThan(0);
    await checkpoint('MAIA-001 AI agents');
  });
});
