// AI agent detail, read only: a Live and a Draft agent, the actions menu (opened and closed) and the
// Knowledge, Memories, Performance and Test screens. Switch, Edit, Delete, Add source and Run test are never
// used, and nothing is typed in the Test chat.
import { expect } from 'chai';
import {
  aiAgentDetailPage, agentKnowledgePage, agentMemoriesPage, agentPerformancePage, agentTestPage,
  AGENT_ACTIONS, AGENT_TEXTS, MEMORY_TYPES, OVERVIEW_FIELDS,
} from '../../../src/pages/AiAgentsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openFirstAgent } from '../../helpers/aiagents.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('AI agents: detail (nothing is changed)', () => {
  requiresAccount();

  it('MAIA-005 A live agent shows its stats, overview, numbers and knowledge', async function () {
    const row = await openFirstAgent(this, 'Live');
    expect(await aiAgentDetailPage.isTitled(row.name), 'title').to.equal(true);
    expect(await aiAgentDetailPage.status(), 'status').to.equal('Live');
    expect(await aiAgentDetailPage.switchLabel(), 'switch').to.equal(AGENT_TEXTS.liveSwitch);
    expect(await aiAgentDetailPage.metric('Chats'), 'Chats').to.match(/^\d+$/);
    expect(await aiAgentDetailPage.metric('Replies'), 'Replies').to.match(/^\d+$/);
    expect(await aiAgentDetailPage.metric('Resolved'), 'Resolved').to.match(/^(\d+%|None)$/);
    await checkpoint('MAIA-005 live');
    const empty: string[] = [];
    for (const f of OVERVIEW_FIELDS) if (!(await aiAgentDetailPage.field(f))) empty.push(f);
    expect(empty, 'OVERVIEW fields without a value').to.deep.equal([]);
    expect(await aiAgentDetailPage.knowledgeSources(), 'KNOWLEDGE "N sources"').to.be.a('number');
    expect(await $(aiAgentDetailPage.selectors.numbersSection).isExisting(), 'WHATSAPP NUMBERS').to.equal(true);
  });

  it('MAIA-006 The WhatsApp numbers on the list match the agent detail', async function () {
    const row = await openFirstAgent(this, 'Live');
    const listed = Number(row.numbers.match(/^(\d+) WhatsApp numbers?$/)?.[1] ?? 0);
    const detailNone = (await $(aiAgentDetailPage.selectors.noNumberBanner).isExisting()) || (await aiAgentDetailPage.hasNoNumberYet());
    await checkpoint('MAIA-006 numbers');
    expect(detailNone, `list says "${row.numbers}"; detail says "No WhatsApp number"`).to.equal(listed === 0);
  });

  it('MAIA-007 A draft agent asks to finish setup and has no on/off switch', async function () {
    await openFirstAgent(this, 'Draft');
    expect(await aiAgentDetailPage.status(), 'status').to.equal('Draft');
    expect(await $(aiAgentDetailPage.selectors.draftHint).isExisting(), `"${AGENT_TEXTS.draftHint}"`).to.equal(true);
    expect(await aiAgentDetailPage.hasSwitch(), 'on/off switch').to.equal(false);
    await checkpoint('MAIA-007 draft');
  });

  it('MAIA-008 The actions menu offers edit, knowledge, memories, performance, test and delete', async function () {
    await openFirstAgent(this, 'Live');
    expect(await aiAgentDetailPage.actionOptions(), 'Agent actions').to.deep.equal([...AGENT_ACTIONS]);   // closed without choosing
  });

  it('MAIA-009 Knowledge lists as many sources as the agent detail and each is ready', async function () {
    await openFirstAgent(this, 'Live');
    const onDetail = await aiAgentDetailPage.knowledgeSources();
    if (onDetail === 0) skipBecause(this, 'the live agent has no knowledge sources');
    await aiAgentDetailPage.openFromActions('Knowledge');
    await agentKnowledgePage.waitForDisplayed(15_000);
    expect(await agentKnowledgePage.count(), 'Knowledge count').to.equal(onDetail);
    const sources = await agentKnowledgePage.sources();
    expect(sources.length, 'sources listed').to.equal(onDetail);
    expect(sources.filter((s) => s.state !== AGENT_TEXTS.sourceReady).map((s) => `${s.name}: ${s.state || 'no state'}`), 'sources not Ready').to.deep.equal([]);
    expect(await $(agentKnowledgePage.selectors.addSource).isExisting(), 'Add source').to.equal(true);
    await checkpoint('MAIA-009 knowledge');
  });

  it('MAIA-010 Memories can be searched and filtered by type', async function () {
    await openFirstAgent(this, 'Live');
    await aiAgentDetailPage.openFromActions('Memories');
    await agentMemoriesPage.waitForDisplayed(15_000);
    expect(await $(agentMemoriesPage.selectors.search).isExisting(), 'Search memories').to.equal(true);
    for (const f of ['All', ...MEMORY_TYPES] as const) expect(await $(agentMemoriesPage.selectors.filter(f)).isExisting(), `"${f}" filter`).to.equal(true);
    if ((await agentMemoriesPage.count()) === 0) skipBecause(this, 'the live agent has no memories');
    await agentMemoriesPage.selectFilter('Fact');
    const types = await agentMemoriesPage.visibleTypes();
    await checkpoint('MAIA-010 memories fact');
    if (!types.length) skipBecause(this, 'no Fact memories');
    expect(types.filter((t) => t !== 'Fact'), 'other types under Fact').to.deep.equal([]);
  });

  it('MAIA-011 Performance offers a quality check that sends nothing to customers', async function () {
    await openFirstAgent(this, 'Live');
    await aiAgentDetailPage.openFromActions('Performance');
    await agentPerformancePage.waitForDisplayed(15_000);
    const s = agentPerformancePage.selectors;
    expect(await $(s.notice).isExisting(), `"${AGENT_TEXTS.performanceNotice}"`).to.equal(true);
    expect(await $(s.questions(5)).isExisting(), '5 questions').to.equal(true);
    expect(await $(s.questions(10)).isExisting(), '10 questions').to.equal(true);
    expect(await $(s.runTest).isExisting(), 'Run test (not tapped)').to.equal(true);
    expect(await $(s.testRuns).isExisting(), 'TEST RUNS').to.equal(true);
    await checkpoint('MAIA-011 performance');
  });

  it('MAIA-012 Test opens a customer chat that sends nothing to customers', async function () {
    const row = await openFirstAgent(this, 'Live');
    await aiAgentDetailPage.openFromActions('Test');
    await agentTestPage.waitForDisplayed(15_000);
    expect(await $(agentTestPage.selectors.title(row.name)).isExisting(), `"Test ${row.name}"`).to.equal(true);
    expect(await $(agentTestPage.selectors.message).isExisting(), 'message box (nothing typed)').to.equal(true);
    await checkpoint('MAIA-012 test chat');
    if (await driver.isKeyboardShown()) await driver.hideKeyboard();
    await aiAgentDetailPage.goBack();
  });
});
