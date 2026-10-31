// Mobile Broadcasts defects / observations, backed by observed evidence only (live app, 2026-10-31,
// Realme RMX3997, Android 16). Same fields as login.defects.js. No contact names or numbers here.
module.exports = [
  {
    id: 'MBRD-D01',
    category: 'Send safety',
    title: 'For a Tags audience, neither the review nor the send confirmation says how many contacts will receive the broadcast',
    steps: '1. Broadcasts > New Broadcast.\n2. Audience: Tags, add a tag.\n3. Pick a template and go to Review.\n4. Tap Send Broadcast.',
    expected: 'Before sending, the user sees how many contacts the tag reaches, as for the other audiences ("All contacts: 3,01,064 contacts", segment "3 contacts match.", review "Audience, 3 contacts").',
    actual: 'Step 1 shows no count for tags. The review shows only "Audience, Tags: <tag>" and the confirmation only "Tags: <tag>. Sending starts now." The count appears only after sending (detail: "Tags: <tag>. 2 contacts"). Contacts search does not find contacts by tag either, so the reach cannot be checked on the phone at all.',
    issueType: 'Bug', severity: 'Medium', priority: 'P2 - High', status: 'Open',
    tests: ['MBRD-012', 'MBRD-020'], guardTest: 'MBRD-012',
    evidence: 'reports/explore-broadcast/91-review.png, 94-confirm.xml (live inspection, 2026-10-31)',
    qaComment: 'A common tag can reach thousands of contacts with no warning. Seen on every Tags review (3 times). Automated test MBRD-012 (test/specs/regression/broadcast-wizard.spec.ts) fails while this persists. The send test (MBRD-020) works around it by checking each allowlisted contact\'s tag first and the recipients afterwards.',
  },
  {
    id: 'MBRD-D02',
    category: 'Usability',
    title: 'Template search keeps the previous text, and typing after tapping the field inserts in the middle of it',
    steps: '1. New Broadcast > step 2 > open the template picker and search "call_phone_message".\n2. Pick a template, then open the picker again.\n3. Tap the search field and type.',
    expected: 'The picker opens with an empty search, or tapping puts the cursor at the end.',
    actual: 'The old text is still there and the cursor lands where the field was tapped, producing e.g. "call_phone_mescall_phone_messagesage" and "No templates found".',
    issueType: 'Observation', severity: 'Low', priority: 'P4 - Low', status: 'Needs Decision',
    tests: ['MBRD-007'],
    evidence: 'reports/explore-broadcast/89c.xml (live inspection, 2026-10-31)',
    qaComment: 'Seen once during exploration. The automated tests clear the field with its X before typing.',
  },
];
