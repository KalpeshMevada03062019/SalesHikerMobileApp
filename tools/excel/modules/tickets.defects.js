// Mobile Tickets defects (live app 2026-11-05, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MTKT-D01',
    category: 'UI / Layout',
    title: 'The status badge on the ticket list is squashed and unreadable',
    steps: '1. More > Tickets.\n2. Look at the status badge of a ticket (e.g. TT1, Closed), under the date.',
    expected: 'The badge reads the status in full ("Closed"), as on the ticket detail.',
    actual: 'The badge is a small grey pill showing "...". The UI hierarchy has the text "Closed", drawn 14 px wide (bounds [497,459][511,491]); the ticket detail draws the same badge 79 px wide. Same kind of fault as MTSK-D01 on the task form.',
    issueType: 'Bug', severity: 'Low', priority: 'P4 - Low', status: 'Open',
    tests: ['MTKT-006'], guardTest: 'MTKT-006',
    evidence: 'reports/explore-tickets/01-list.png, 04-closed.xml (2026-11-05); run 20261105-120411-full screenshot MTKT-006_status_badge.png',
    qaComment: 'Reproduced three times on 2026-11-05: exploration under All and under Closed (11:56), and run 20261105-120411-full (MTKT-006: 14 px). Automated test MTKT-006 fails while it persists.',
  },
];
