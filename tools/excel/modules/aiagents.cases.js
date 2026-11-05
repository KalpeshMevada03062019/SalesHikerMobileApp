// Mobile AI Agents test cases (More > AI Agents), SalesHiker Android 1.0.0. Expected results come from the
// live app on the Realme RMX3997 (2026-11-03). Read only: no agent is created, switched, edited or deleted
// (creating AI agents is not tested); Add source and Run test are not tapped and nothing is typed in Test.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > AI Agents open.';
const tc = (fields) => ({ req: 'REQ-MAIA-01', input: 'Test account from config\\.env. Live beta AI agents.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MAIA-01', scenario: 'AI agent list', id: 'MAIA-001', title: 'AI Agents opens with the count, credits, search, status filters and agents',
    steps: '1. More > AI Agents.', type: 'Smoke', design: 'Positive',
    expected: '"N agents", New agent, "AI credits: N left", Search agents, filters All / Live / Paused / Draft with counts ("All" = N), and rows with name, status, role, WhatsApp numbers and replies in 7 days.',
    observed: 'List shown with credits, counts, filters and rows.' }),
  tc({ ts: 'TS-MAIA-01', scenario: 'AI agent list', id: 'MAIA-002', title: 'Status counts add up to the total',
    steps: '1. Read every filter count.', type: 'Functional', design: 'Validation',
    expected: 'Live + Paused + Draft = All.', observed: 'Counts add up.' }),
  tc({ ts: 'TS-MAIA-01', scenario: 'AI agent list', id: 'MAIA-003', title: 'Live and Draft filters show only agents with that status',
    steps: '1. Tap Live.\n2. Tap Draft.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only agents with that status are listed; "N agents" equals the chip count.', observed: 'Only matching statuses listed.' }),
  tc({ ts: 'TS-MAIA-01', scenario: 'AI agent list', id: 'MAIA-004', title: 'Search is case-insensitive, an unknown name finds none and Clear Filters restores the list',
    steps: '1. Search a word of a listed agent in upper case.\n2. Search qa_no_such_agent_zz.\n3. Tap Clear Filters.', input: 'Search: a word from a listed name (upper case), then qa_no_such_agent_zz',
    type: 'Functional', design: 'Negative', expected: 'The agent is found; the unknown name shows "0 agents", "No agents found" and "No agent matches this search or filter."; Clear Filters brings back all agents.', observed: 'Found; empty state shown; list restored.' }),
  tc({ ts: 'TS-MAIA-02', scenario: 'AI agent detail', id: 'MAIA-005', title: 'A live agent shows its stats, overview, numbers and knowledge',
    steps: '1. Filter Live, open the first agent.\n2. Scroll through the detail.', type: 'Functional', design: 'Positive',
    expected: 'Status Live, switch "Agent on. Pause" (not tapped); Last 30 days Chats / Replies / Resolved; OVERVIEW Role, Reply mode, Tone, Instructions and Hand-off message filled; WHATSAPP NUMBERS; KNOWLEDGE "N sources".',
    observed: 'Stats, overview, numbers and knowledge shown.' }),
  tc({ ts: 'TS-MAIA-02', scenario: 'AI agent detail', id: 'MAIA-006', title: 'The WhatsApp numbers on the list match the agent detail',
    steps: '1. Filter Live; read the number line of the first agent ("N WhatsApp number").\n2. Open the agent.', type: 'Functional', design: 'Validation',
    expected: 'An agent listed with N WhatsApp numbers shows those numbers on its detail; "No WhatsApp number" only when the list says so too.',
    observed: 'Until 16:13 the list said "1 WhatsApp number" and the detail "No WhatsApp number" (MAIA-D01); after the agent was updated both show the number.',
    defect: 'MAIA-D01' }),
  tc({ ts: 'TS-MAIA-02', scenario: 'AI agent detail', id: 'MAIA-007', title: 'A draft agent asks to finish setup and has no on/off switch',
    steps: '1. Filter Draft, open the first agent.', type: 'Functional', design: 'Positive',
    expected: 'Status Draft; "Draft. Finish setup in Edit."; no on/off switch.', observed: 'Draft with the finish-setup hint, no switch.' }),
  tc({ ts: 'TS-MAIA-02', scenario: 'AI agent detail', id: 'MAIA-008', title: 'The actions menu offers edit, knowledge, memories, performance, test and delete',
    steps: '1. Open the live agent.\n2. Open Agent actions, read it, close it.', type: 'Functional', design: 'Positive',
    expected: 'Edit, Knowledge, Memories, Performance, Test ("Chat as a customer. Nothing is sent."), Delete. Nothing is chosen.', observed: 'All actions offered; menu closed.' }),
  tc({ ts: 'TS-MAIA-03', scenario: 'AI agent screens', id: 'MAIA-009', title: 'Knowledge lists as many sources as the agent detail and each is ready',
    steps: '1. Open the live agent; read KNOWLEDGE "N sources".\n2. Agent actions > Knowledge.', type: 'Functional', design: 'Validation',
    expected: 'Knowledge count = N, N sources listed, each "Ready"; Add source offered (not tapped); "The agent answers from these sources."', observed: '3 sources, all Ready.' }),
  tc({ ts: 'TS-MAIA-03', scenario: 'AI agent screens', id: 'MAIA-010', title: 'Memories can be searched and filtered by type',
    steps: '1. Open the live agent.\n2. Agent actions > Memories.\n3. Tap Fact.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Count, Search memories and filters All / Fact / Preference / Context; under Fact only Fact memories are listed.', observed: 'Only Fact memories under Fact.' }),
  tc({ ts: 'TS-MAIA-03', scenario: 'AI agent screens', id: 'MAIA-011', title: 'Performance offers a quality check that sends nothing to customers',
    steps: '1. Open the live agent.\n2. Agent actions > Performance.', type: 'Functional', design: 'Positive',
    expected: 'QUALITY CHECK with "Nothing is sent to customers.", 5 / 10 questions, Run test (not tapped) and TEST RUNS.', observed: 'Quality check and past runs shown.' }),
  tc({ ts: 'TS-MAIA-03', scenario: 'AI agent screens', id: 'MAIA-012', title: 'Test opens a customer chat that sends nothing to customers',
    steps: '1. Open the live agent.\n2. Agent actions > Test.', type: 'Functional', design: 'Positive',
    expected: '"Test <name>" with "Write as a customer. Nothing is sent to customers." and a message box (nothing typed).', observed: 'Test chat opened with the notice.' }),
];
