// Mobile Inbox defects, backed by observed evidence (live app, 2026-11-02, Realme RMX3997, Android 16).
// Each was seen when sending to the allowlisted number; WhatsApp rejected the send, so nothing reached the
// recipient, and the chat keeps the message marked "Failed". No contact names or numbers here.
const common = 'Messages that need these inputs can be picked and sent but always fail; the user only learns this after sending.';
module.exports = [
  {
    id: 'MINB-D01',
    category: 'Send template',
    title: 'Send Template does not ask for header variables, so templates with a text-header {{1}} always fail',
    steps: '1. Inbox > open a chat.\n2. Send Template > select "button_template" (header "hello {{1}}").\n3. Tap Send Template.',
    expected: 'The sheet asks for the header value (as it does for body values) and the message is sent.',
    actual: 'No field for the header variable is shown. Sending shows "Template not sent - header: number of localizable_params (0) does not match the expected number of params (1)"; the chat keeps the message marked Failed, with "{{1}}" shown literally.',
    issueType: 'Bug', severity: 'High', priority: 'P2 - High', status: 'Open',
    tests: ['MINB-016'], guardTest: 'MINB-016',
    evidence: 'reports/explore-inbox/70-after-button_template.xml (live, 2026-11-02 14:39)',
    qaComment: `${common} Automated test MINB-016 (test/specs/regression/inbox-send-templates.spec.ts) fails while this persists.`,
  },
  {
    id: 'MINB-D02',
    category: 'Send template',
    title: 'Location-header templates cannot be sent from the app: no location is asked for',
    steps: '1. Inbox > open a chat.\n2. Send Template > select "location_template".\n3. Tap Send Template.',
    expected: 'The sheet asks for (or pre-fills) the location (latitude, longitude, name, address) and the message is sent.',
    actual: 'The preview shows a location header but no fields. Sending shows "Template not sent - header: Format mismatch, expected LOCATION, received UNKNOWN"; the message stays marked Failed.',
    issueType: 'Bug', severity: 'Medium', priority: 'P3 - Medium', status: 'Open',
    tests: ['MINB-017'], guardTest: 'MINB-017',
    evidence: 'reports/explore-inbox/70-after-location_template.xml (live, 2026-11-02 14:39)',
    qaComment: `${common} Related web defect TPL-01 (location templates cannot be saved on the web). Automated test MINB-017 fails while this persists.`,
  },
  {
    id: 'MINB-D03',
    category: 'Send template',
    title: 'Authentication (one-time code) templates fail: the code button parameter is not sent',
    steps: '1. Inbox > open a chat.\n2. Send Template > select "onetap_otp".\n3. Fill "Value for {{1}}" with a code (e.g. 123456).\n4. Tap Send Template.',
    expected: 'The code is used for the body and for the copy-code / URL button, and the message is sent.',
    actual: '"Template not sent - buttons: Button at index 0 of type Url requires a parameter"; the message stays marked Failed.',
    issueType: 'Bug', severity: 'Medium', priority: 'P3 - Medium', status: 'Open',
    tests: ['MINB-018'], guardTest: 'MINB-018',
    evidence: 'reports/explore-inbox/70-after-onetap_otp.xml (live, 2026-11-02 14:42)',
    qaComment: `${common} Automated test MINB-018 fails while this persists.`,
  },
  {
    id: 'MINB-D04',
    category: 'Usability',
    title: 'Template search in the chat keeps the previous text and typing inserts in the middle of it',
    steps: '1. Inbox > chat > Send Template, search "call_phone_message", close the sheet.\n2. Open Send Template again, tap the search field and type.',
    expected: 'The search starts empty, or the cursor goes to the end.',
    actual: 'The old text stays and the new text is inserted where the field was tapped ("call_phone_mescall_phcall_phone_messageone_messagesage"), so "No templates found" is shown. Same behaviour as the broadcast wizard (MBRD-D02).',
    issueType: 'Observation', severity: 'Low', priority: 'P4 - Low', status: 'Needs Decision',
    tests: ['MINB-004'],
    evidence: 'reports/explore-inbox/33.xml (live, 2026-11-02)',
    qaComment: 'Seen twice in the Inbox and in the broadcast wizard. The automated tests clear the field with its X before typing.',
  },
];
