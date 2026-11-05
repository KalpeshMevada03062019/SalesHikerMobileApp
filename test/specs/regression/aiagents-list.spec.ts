// AI Agents list, read only: status counts and filters, search. The on/off switches and New agent are never tapped.
import { expect } from 'chai';
import { aiAgentsPage, AGENT_STATUSES } from '../../../src/pages/AiAgentsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { aiAgentData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openAiAgents } from '../../helpers/aiagents.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('AI agents: list, filters and search', () => {
  requiresAccount();
  beforeEach(async () => { await openAiAgents(); });

  it('MAIA-002 Status counts add up to the total', async () => {
    const all = await aiAgentsPage.filterCount('All');
    let sum = 0;
    for (const s of AGENT_STATUSES) sum += await aiAgentsPage.filterCount(s);
    expect(sum, 'Live + Paused + Draft').to.equal(all);
  });

  it('MAIA-003 Live and Draft filters show only agents with that status', async () => {
    const problems: string[] = [];
    for (const s of ['Live', 'Draft'] as const) {
      const chip = await aiAgentsPage.filterCount(s);
      await aiAgentsPage.selectFilter(s);
      const rows = await aiAgentsPage.visibleRows();
      const other = rows.filter((r) => r.status !== s).map((r) => r.name);
      if (other.length) problems.push(`${s}: other statuses listed (${other.join(', ')})`);
      if ((await aiAgentsPage.count()) !== chip) problems.push(`${s}: "N agents" ${await aiAgentsPage.count()} vs chip ${chip}`);
      await checkpoint(`MAIA-003 ${s}`);
    }
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MAIA-004 Search is case-insensitive, an unknown name finds none and Clear Filters restores the list', async function () {
    const all = await aiAgentsPage.count();
    const first = (await aiAgentsPage.visibleRows())[0];
    if (!first) skipBecause(this, 'no AI agents listed');
    const word = first.name.split(/\s+/).sort((a, b) => b.length - a.length)[0]!;
    await aiAgentsPage.search(word.toUpperCase());
    expect((await aiAgentsPage.visibleRows()).map((r) => r.name), `results for "${word.toUpperCase()}"`).to.include(first.name);
    await aiAgentsPage.search(aiAgentData.noMatch);
    expect(await aiAgentsPage.isEmptyStateShown(), '"No agents found"').to.equal(true);
    expect(await $(aiAgentsPage.selectors.noAgentsHint).isExisting(), '"No agent matches this search or filter."').to.equal(true);
    expect(await aiAgentsPage.count(), 'count').to.equal(0);
    await checkpoint('MAIA-004 no match');
    await aiAgentsPage.clearFilters();
    expect(await aiAgentsPage.count(), 'count after Clear Filters').to.equal(all);
  });
});
