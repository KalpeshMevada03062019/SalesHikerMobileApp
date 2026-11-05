// Mobile Leads defects (live app 2026-11-04, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MLED-D01',
    category: 'Filtering',
    title: 'The Converted lead filter does not filter: every lead stays listed',
    steps: '1. More > Leads (All: N leads).\n2. Scroll the status chips and tap Converted.',
    expected: 'Only converted leads are listed, or "No leads found" if there are none; the count drops below All.',
    actual: 'Converted is the only selected chip, yet the list still shows New and Won leads and the count is 3,00,047, more than All (3,00,044). After Lost, tapping Converted kept Lost selected as well.',
    issueType: 'Bug', severity: 'Medium', priority: 'P3 - Medium', status: 'Open',
    tests: ['MLED-004'], guardTest: 'MLED-004',
    evidence: 'reports/explore-leads/converted.png, k2.xml (2026-11-04); run screenshot MLED-004',
    qaComment: 'Reproduced twice on 2026-11-04: exploration (12:41) and run 20261104-124546-full (MLED-004: New and Won listed, 3,00,047 of 3,00,044). Converted seems to drop every filter, and All seems to leave out 3 leads. Automated test MLED-004 fails while it persists.',
  },
];
