// Mobile Tasks defects (live app 2026-11-04, Realme RMX3997, Android 16).
module.exports = [
  {
    id: 'MTSK-D01',
    category: 'UI / Layout',
    title: 'The status badge on the task form is squashed and unreadable',
    steps: '1. More > Tasks.\n2. Open any task (Upcoming, Overdue or Done).\n3. Look at the badge under TASK, left of Mark Done / Reopen.',
    expected: 'The badge shows the task status in full: "Open" or "Done".',
    actual: 'The badge is a small empty pill showing ".." (Open) or "." (Done). The UI hierarchy has the full text, but it is drawn 6-7 px wide (bounds [80,332][87,364]).',
    issueType: 'Bug', severity: 'Low', priority: 'P4 - Low', status: 'Open',
    tests: ['MTSK-012'], guardTest: 'MTSK-012',
    evidence: 'reports/explore-tasks/13-detail.png, 16-sam.xml, 18-overdue-detail.xml, 20-done-detail.png (2026-11-04); run screenshot MTSK-012',
    qaComment: 'Reproduced on four tasks on 2026-11-04 during exploration: Verify 184-186 and Meeting with Sam (Upcoming), Call Rahul Mehta about pricing for 20 users (Overdue), Task 280405 (Done). Automated test MTSK-012 fails while it persists.',
  },
];
