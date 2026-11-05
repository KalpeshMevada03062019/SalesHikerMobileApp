// Mobile WhatsApp Logs test cases (More > WhatsApp Logs), SalesHiker Android 1.0.0. Expected results come
// from the live app on the Realme RMX3997 (2026-11-03). Read only: nothing is sent from these screens;
// Open Conversation opens the chat but nothing is typed.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > WhatsApp Logs open.';
const tc = (fields) => ({ req: 'REQ-MWLG-01', input: 'Test account from config\\.env. Live beta message log.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MWLG-01', scenario: 'Message log list', id: 'MWLG-001', title: 'WhatsApp Logs opens with the message count, search, filters and messages',
    steps: '1. More > WhatsApp Logs.', type: 'Smoke', design: 'Positive',
    expected: '"N messages", "Search by phone or template", filters All (selected) / Outbound / Inbound / Sent / Delivered / Read / Failed / Template / Today, and rows with direction, contact, status, message, phone and time.',
    observed: 'Log shown with count, filters and rows.' }),
  tc({ ts: 'TS-MWLG-01', scenario: 'Message log list', id: 'MWLG-002', title: 'Outbound and Inbound counts add up to all messages',
    steps: '1. Read "N messages" under All.\n2. Tap Outbound, then Inbound.', type: 'Functional', design: 'Validation',
    expected: 'Outbound + Inbound = All.', observed: '435 + 7,094 = 7,529.' }),
  tc({ ts: 'TS-MWLG-01', scenario: 'Message log list', id: 'MWLG-003', title: 'Outbound and Inbound show only messages in that direction',
    steps: '1. Tap Outbound.\n2. Tap Inbound.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Outbound lists only outgoing messages, Inbound only incoming ones.', observed: 'Only matching directions listed.' }),
  tc({ ts: 'TS-MWLG-01', scenario: 'Message log list', id: 'MWLG-004', title: 'Status filters include outgoing messages with that status',
    steps: '1. Tap Outbound; note the statuses shown (Read, Sent, Failed).\n2. Tap each of those status filters.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Each status filter lists only messages with that status, including the outgoing ones seen under Outbound (direction and status chips combine).',
    observed: 'Outbound + Sent: 356 messages, all Sent; Outbound + Read: 35, all Read.' }),
  tc({ ts: 'TS-MWLG-01', scenario: 'Message log list', id: 'MWLG-005', title: 'Today lists the messages logged today',
    steps: '1. Note the messages timed today (HH:MM) under All.\n2. Tap Today.', type: 'Functional', design: 'Boundary Value',
    expected: 'Today lists at least the messages timed today.', observed: 'Today: 15 messages, all timed today.' }),
  tc({ ts: 'TS-MWLG-01', scenario: 'Message log list', id: 'MWLG-006', title: 'Search by phone finds that number only, an unknown text finds none and Clear Search restores the list',
    steps: '1. Search the last 10 digits of the first message phone.\n2. Search qa_no_such_log_zz.\n3. Tap Clear Search.', input: 'Search: phone digits of the first row, then qa_no_such_log_zz',
    type: 'Functional', design: 'Negative', expected: 'Only that number messages are listed; the unknown text shows "0 messages", "No messages found" and "No message matches this search or filter."; Clear Search restores all messages.',
    observed: 'Phone search filtered; empty state shown; list restored.' }),
  tc({ ts: 'TS-MWLG-02', scenario: 'Message log detail', id: 'MWLG-007', title: 'An outgoing message log shows its status, contact, message and status timeline',
    steps: '1. Outbound, open the newest message.', type: 'Functional', design: 'Positive',
    expected: '"Message log" with the row status, Outbound and the date; "Open chat with <contact>"; MESSAGE text; STATUS timeline from Queued to the row status (e.g. Queued > Sent > Read).',
    observed: 'Queued > Sent > Read shown.' }),
  tc({ ts: 'TS-MWLG-02', scenario: 'Message log detail', id: 'MWLG-008', title: 'Message Data and Details of an outgoing message show the Meta request and IDs',
    steps: '1. Open the newest outgoing message.\n2. Message Data tab.\n3. Details tab.', type: 'Functional', design: 'Positive',
    expected: 'REQUEST JSON with "to"; RESPONSE JSON with "messages" and the Meta ID; Details Direction Outbound, Type, Phone, Business number, Meta ID (wamid.), Created, Updated.',
    observed: 'Payloads and details shown.' }),
  tc({ ts: 'TS-MWLG-02', scenario: 'Message log detail', id: 'MWLG-009', title: 'An incoming message log shows Received, Inbound and no response',
    steps: '1. Inbound, open the newest message.\n2. Message Data tab.\n3. Details tab.', type: 'Functional', design: 'Positive',
    expected: 'Status Received, Inbound, MESSAGE text, timeline Received; REQUEST (webhook) JSON with "from" and "No response saved."; Details Direction Inbound.',
    observed: 'Incoming log shown.' }),
  tc({ ts: 'TS-MWLG-02', scenario: 'Message log detail', id: 'MWLG-010', title: 'Open Conversation opens the chat with the contact',
    steps: '1. Open the newest incoming message.\n2. Tap Open Conversation.', type: 'Functional', design: 'Positive',
    expected: 'The Inbox chat with that contact opens (nothing is typed).', observed: 'Chat opened.' }),
];
