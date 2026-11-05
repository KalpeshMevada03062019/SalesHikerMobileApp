// Mobile Quotations defects / observations (live app 2026-11-05, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MQTN-D01',
    category: 'Counts / Filtering',
    title: 'The quotation status counts add up to 428 less than All',
    steps: '1. More > Quotations; read the count under the title (All).\n2. Tap Draft, Sent, Accepted, Declined and Expired; read each count.',
    expected: 'Draft + Sent + Accepted + Declined + Expired = All, or a chip for every other status a quotation can have.',
    actual: 'Draft 60,108 + Sent 60,111 + Accepted 60,116 + Declined 60,126 + Expired 60,114 = 3,00,575; All shows 3,01,003 (428 more). No chip lists those 428 quotations.',
    issueType: 'Observation', severity: 'Low', priority: 'P4 - Low', status: 'Needs Decision',
    tests: ['MQTN-002'], guardTest: 'MQTN-002',
    evidence: 'reports/explore-quotations/c.xml, 03-draft.xml, 04-all.xml (2026-11-05); run 20261105-124945-full (MQTN-002)',
    qaComment: 'Reproduced twice on 2026-11-05 with the same numbers: exploration (12:40) and run 20261105-124945-full. Either 428 quotations have a status the app has no chip for (to compare with the web), or a count is wrong. Needs a decision from the team; MQTN-002 fails while the gap remains.',
  },
];
