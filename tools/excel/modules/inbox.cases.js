// Mobile Inbox test cases (WhatsApp chats: open a chat, Send Template, one template per message type),
// SalesHiker Android 1.0.0. Expected results come from the live app on the Realme RMX3997, 2026-11-02.
// Messages go only to the allowlisted number INBOX_RECIPIENT (config\.env). No personal data here.

const PRE = 'Registered beta test account (config\\.env).\nThe allowlisted recipient (INBOX_RECIPIENT) has a contact and a chat.\nApp restarted signed in; Inbox > search the number > chat opened; header shows exactly that number.';
const SEND_PRE = `${PRE}\nINBOX_SEND=true to send (otherwise the test stops before sending).\nWorks with the 24-hour window closed (templates only).`;
const tc = (fields) => ({ req: 'REQ-MINB-01', input: 'Recipient: INBOX_RECIPIENT (one allowlisted number).', pre: PRE, ...fields });
const send = (id, title, name, values, expect, defect) => tc({
  ts: 'TS-MINB-03', scenario: 'Each WhatsApp message type can be sent as a template', id,
  title, pre: SEND_PRE,
  steps: `1. Tap Send Template.\n2. Search and select "${name}".${values ? `\n3. Fill "Value for {{n}}" with ${values}.` : ''}\n${values ? 4 : 3}. Tap Send Template (once).`,
  input: `Template: ${name}${values ? `; values: ${values}` : ''}.`, type: 'Regression', design: 'Positive',
  expected: `The sheet closes and a new message appears in the chat containing "${expect}", with a time and no "Failed" mark; no "Template not sent" banner.`,
  observed: `Message sent and shown in the chat ("${expect}").`, ...(defect ? { defect } : {}),
});

module.exports = [
  tc({ ts: 'TS-MINB-01', scenario: 'Inbox and chats', id: 'MINB-001', title: 'Inbox opens with chat counts, views and search',
    pre: 'Registered beta test account (config\\.env). User is signed in.', steps: '1. Open the Inbox tab.', type: 'Smoke', design: 'Positive',
    expected: '"N chats · M unread" (unread <= chats), views All / Mine / Unassigned, a search button.', observed: 'Inbox shown with counts, views and search.' }),
  tc({ ts: 'TS-MINB-01', scenario: 'Inbox and chats', id: 'MINB-002', title: 'Searching the number opens the contact chat',
    steps: '1. Inbox > Search conversations.\n2. Type the number.\n3. Open the chat result.', type: 'Functional', design: 'Positive',
    expected: 'The chat opens; its header shows the contact name and exactly the searched number.', observed: 'Chat of the searched number opened.' }),
  tc({ ts: 'TS-MINB-02', scenario: 'Composer and template sheet', id: 'MINB-003', title: 'With the 24-hour window closed only templates and notes can be sent',
    steps: '1. Open the chat while the window is closed.\n2. Read the composer.', type: 'Functional', design: 'Positive',
    expected: '"Window closed" chip; hint "No customer message yet. Send a template to start the chat, or add a note for your team."; attach disabled ("Needs an open window"); Internal note and Send Template available.',
    observed: 'Closed-window composer shown with only templates and notes.' }),
  tc({ ts: 'TS-MINB-02', scenario: 'Composer and template sheet', id: 'MINB-004', title: 'Template sheet lists approved templates and reports no match',
    steps: '1. Tap Send Template.\n2. Search the template name in upper case.\n3. Search a name that does not exist.', input: 'Search: CALL_PHONE_MESSAGE, then qa_no_such_template_zz',
    type: 'Functional', design: 'Negative',
    expected: '"Choose a template to send." until one is picked; upper-case search finds call_phone_message; unknown name shows "No templates found" and "No templates match this search or category."',
    observed: 'Search case-insensitive; empty state shown.' }),
  tc({ ts: 'TS-MINB-02', scenario: 'Composer and template sheet', id: 'MINB-005', title: 'Category filters show only templates of that category',
    steps: '1. Tap Send Template.\n2. Tap "Authentication".', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only Authentication templates are listed.', observed: 'Only Authentication templates listed.' }),
  tc({ ts: 'TS-MINB-02', scenario: 'Composer and template sheet', id: 'MINB-006', title: 'Template variables are required and fill the preview',
    steps: '1. Select testvarbody.\n2. Fill both values.', input: 'Values: QA, preview check', type: 'Functional', design: 'Validation',
    expected: 'Two required fields "Value for {{1}} *" / "{{2}} *" (empty ones show "Enter a value." on Send); the preview shows the typed values.',
    observed: 'Two required fields; preview updated with the values.' }),
  send('MINB-010', 'Send a text template with quick-reply and call buttons', 'call_phone_message', '', 'Welcome to SalesHiker!'),
  send('MINB-011', 'Send a template with body variables', 'testvarbody', '"QA", "mobile automation"', 'Hello QA this is testing template for body'),
  send('MINB-012', 'Send an image-header template', 'image', '', 'Hello test new'),
  send('MINB-013', 'Send a carousel template', 'saleshiker_plan_carousel', '', 'Grow Your Business with SalesHiker CRM'),
  send('MINB-014', 'Send a utility template with a variable', 'test_new543', '"QA"', 'This template is used for testing purposes only'),
  send('MINB-015', 'Send a template with a flow button', 'test_flow', '', 'Hello world!'),
  send('MINB-016', 'Send a template with a text-header variable and buttons', 'button_template', '', 'Track Order', 'MINB-D01'),
  send('MINB-017', 'Send a location-header template', 'location_template', '', 'Check Our New Loction', 'MINB-D02'),
  send('MINB-018', 'Send an authentication (one-time code) template', 'onetap_otp', '"123456"', 'is your verification code', 'MINB-D03'),
];
