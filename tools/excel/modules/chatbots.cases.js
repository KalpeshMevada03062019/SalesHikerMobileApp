// Mobile Chatbots test cases (More > WhatsApp > Chatbots), SalesHiker Android 1.0.0. Expected results come
// from the live app on the Realme RMX3997 (2026-11-03), with the web project's chatbot scenarios
// (CB-001 ... CB-059) as the reference. Read only: no chatbot is created, switched, duplicated, archived or
// deleted (creating chatbots is not tested); the Test simulator is opened but nothing is typed.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Chatbots open.';
const tc = (fields) => ({ req: 'REQ-MCBT-01', input: 'Test account from config\\.env. Live beta chatbots.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MCBT-01', scenario: 'Chatbot list', id: 'MCBT-001', title: 'Chatbots opens with the count, search, status filters and chatbots',
    steps: '1. More > Chatbots.', type: 'Smoke', design: 'Positive',
    expected: '"N chatbots", New chatbot, Search chatbots, filters All / Active / Paused / Draft / Archived / Attention with counts ("All" = N), and rows with name, status, trigger and sessions in 7 days. Web: CB-001.',
    observed: 'List shown with counts, filters and rows.' }),
  tc({ ts: 'TS-MCBT-01', scenario: 'Chatbot list', id: 'MCBT-002', title: 'Status counts add up to the total',
    steps: '1. Read every filter count.', type: 'Functional', design: 'Validation',
    expected: 'Active + Paused + Draft + Archived = All; Attention (a flag) is at most All.', observed: 'Counts add up.' }),
  tc({ ts: 'TS-MCBT-01', scenario: 'Chatbot list', id: 'MCBT-003', title: 'Active and Draft filters show only chatbots with that status',
    steps: '1. Tap Active.\n2. Tap Draft.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only chatbots with that status are listed; "N chatbots" equals the chip count.', observed: 'Only matching statuses listed.' }),
  tc({ ts: 'TS-MCBT-01', scenario: 'Chatbot list', id: 'MCBT-004', title: 'Search by part of a name is case-insensitive and an unknown name finds none',
    steps: '1. Search a word of a listed chatbot in upper case.\n2. Search qa_no_such_chatbot_zz.', input: 'Search: a word from a listed name (upper case), then qa_no_such_chatbot_zz',
    type: 'Functional', design: 'Negative', expected: 'The chatbot is found; the unknown name shows "0 chatbots" and "No chatbots found". Web: CB-002, CB-003.', observed: 'Found; empty state shown.' }),
  tc({ ts: 'TS-MCBT-02', scenario: 'Chatbot detail', id: 'MCBT-005', title: 'An active chatbot shows its stats, trigger keywords, numbers and flow',
    steps: '1. Filter Active, open the first chatbot with keywords.\n2. Scroll to FLOW.', type: 'Functional', design: 'Positive',
    expected: 'Status Active, switch "Chatbot on. Pause" (not tapped); Last 7 days Sessions / Completion / Hand-offs; every keyword from the list row shown under TRIGGER KEYWORDS with "Starts when a message is exactly a keyword."; WHATSAPP NUMBERS; FLOW "N steps in the draft".',
    observed: 'Stats, keywords, numbers and flow shown.' }),
  tc({ ts: 'TS-MCBT-02', scenario: 'Chatbot detail', id: 'MCBT-006', title: 'A draft chatbot cannot be switched on from the phone',
    steps: '1. Filter Draft, open the first chatbot.', type: 'Functional', design: 'Positive',
    expected: 'Status Draft; switch "Chatbot off. Publish on the web to turn on." Web: CB-053 (a draft cannot be switched on from the list).', observed: 'Draft with the publish-on-web hint.' }),
  tc({ ts: 'TS-MCBT-02', scenario: 'Chatbot detail', id: 'MCBT-007', title: 'The actions menu offers settings, test, history and management actions',
    steps: '1. Open a draft chatbot.\n2. Open Chatbot actions, read it, close it.', type: 'Functional', design: 'Positive',
    expected: 'Settings, Test, Send test, Sessions, Analytics, Versions, Duplicate, Archive, Delete. Nothing is chosen.', observed: 'All actions offered; menu closed.' }),
  tc({ ts: 'TS-MCBT-02', scenario: 'Chatbot detail', id: 'MCBT-008', title: 'Test opens a simulator that sends nothing to WhatsApp',
    steps: '1. Open a draft chatbot.\n2. Chatbot actions > Test.', type: 'Functional', design: 'Positive',
    expected: '"Test <name>" with "Send a message to start the draft flow. Nothing is sent to WhatsApp." and a message box (nothing typed).', observed: 'Simulator opened with the notice.' }),
];
