// Mobile AI Agents defects / observations (live app 2026-11-03, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MAIA-D01',
    category: 'Data consistency',
    title: 'The AI Agents list shows 1 WhatsApp number for the live agent while its detail says it has none',
    steps: '1. More > AI Agents.\n2. Read the live agent row ("Saleshiker, Live"): "1 WhatsApp number".\n3. Open the agent.',
    expected: 'The detail lists the same WhatsApp number as the list row (or the list says "No WhatsApp number").',
    actual: 'The detail says "No WhatsApp number. Add one in Edit, Numbers." and WHATSAPP NUMBERS shows "No number yet." although the agent is Live and the list counts 1 number.',
    issueType: 'Bug', severity: 'Medium', priority: 'P3 - Medium', status: 'Open',
    tests: ['MAIA-006'], guardTest: 'MAIA-006',
    evidence: 'reports/explore-aiagents/03-live.xml, q1.xml (list) and 04-detail.xml, m0.xml (detail), 2026-11-03',
    qaComment: 'Reproduced three times on 2026-11-03 (twice while exploring, once in run 20261103-160617-full). The agent was then updated at 16:13 (not by the tests, which never edit) and now shows +91 94093 94378 on its detail, so MAIA-006 passes from run 20261103-161831-full. Retest with an agent whose list and detail disagree; close if it does not come back.',
  },
];
