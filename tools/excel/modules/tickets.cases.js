// Mobile Tickets test cases (More > CRM > Tickets), SalesHiker Android 1.0.0. Expected results come from the
// live app on the Realme RMX3997 (2026-11-05). Read only: no ticket is created, reopened, re-statused,
// re-prioritised, edited or deleted, and no note is added. Beta has one ticket: TT1 "Test", Closed, Normal.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Tickets open.';
const tc = (fields) => ({ req: 'REQ-MTKT-01', input: 'Test account from config\\.env. Beta ticket TT1.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MTKT-01', scenario: 'Ticket list', id: 'MTKT-001', title: 'Tickets opens with the count, search, status filters and tickets',
    steps: '1. More > Tickets.', type: 'Smoke', design: 'Positive',
    expected: '"N tickets" under the title, New Ticket (not tapped), "Search tickets", chips All (selected) / Open / In Progress / Waiting / Closed / Priority, rows with title, date, number and status, and "Showing N of N tickets".',
    observed: '1 ticket: Test, 7 Oct, TT1, Closed.' }),
  tc({ ts: 'TS-MTKT-01', scenario: 'Ticket list', id: 'MTKT-002', title: 'Status counts add up to all tickets',
    steps: '1. Read All.\n2. Tap Open, In Progress, Waiting and Closed and read "N tickets".', type: 'Functional', design: 'Validation',
    expected: 'Open + In Progress + Waiting + Closed = All.', observed: '0 + 0 + 0 + 1 = 1.' }),
  tc({ ts: 'TS-MTKT-01', scenario: 'Ticket list', id: 'MTKT-003', title: 'Each status filter shows only tickets with that status, or No tickets found',
    steps: '1. Tap Open, In Progress, Waiting and Closed in turn.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only the tapped chip is selected; only tickets with that status are listed, or "No tickets found" with "Try another title, number or filter." when there are none.',
    observed: 'Open, In Progress, Waiting: No tickets found; Closed: TT1.' }),
  tc({ ts: 'TS-MTKT-01', scenario: 'Ticket list', id: 'MTKT-004', title: 'The Priority filter lists the priorities and shows the ticket under its own priority only',
    steps: '1. Tap Priority.\n2. Choose Normal.\n3. Tap Priority; choose Urgent.\n4. Tap the X next to the chip.', input: 'Priority: Normal, then Urgent', type: 'Functional', design: 'Equivalence Partitioning',
    expected: '"Filter by Priority": Any priority (selected), Low, Normal, High, Urgent; Normal lists TT1 and the chip reads "Priority: Normal"; Urgent shows No tickets found; the X restores "Priority" and TT1.',
    observed: 'As expected.' }),
  tc({ ts: 'TS-MTKT-01', scenario: 'Ticket list', id: 'MTKT-005', title: 'Search finds a ticket by title or number, an unknown word finds none and Clear Filters resets every filter',
    steps: '1. Search TEST.\n2. Search tt1.\n3. Tap Closed; search qa_no_such_ticket_zz.\n4. Tap Clear Filters.', input: 'Search: TEST, tt1, qa_no_such_ticket_zz', type: 'Functional', design: 'Negative',
    expected: 'TT1 found by title and by number in any letter case; the unknown word shows "0 tickets", "No tickets found" and "Try another title, number or filter."; Clear Filters empties the search, selects All and restores every ticket.',
    observed: 'Found by title and number; empty state; all filters reset.' }),
  tc({ ts: 'TS-MTKT-01', scenario: 'Ticket list', id: 'MTKT-006', title: 'The ticket list shows a readable status badge',
    steps: '1. More > Tickets.\n2. Look at the status badge of the first ticket.', type: 'Functional', design: 'Validation',
    expected: 'The badge reads the status in full ("Closed"), as on the ticket detail.',
    observed: 'The badge is squashed and shows "..." instead of Closed (MTKT-D01).',
    defect: 'MTKT-D01' }),
  tc({ ts: 'TS-MTKT-02', scenario: 'Ticket detail', id: 'MTKT-007', title: 'The ticket detail shows its number, status, priority, people and texts as on the list',
    steps: '1. Open TT1.\n2. Scroll to ACTIVITY.\n3. Tap Back.', type: 'Functional', design: 'Validation',
    expected: '"Ticket" with TT1, the title, status as on the list and priority Normal; "Opened by <name>, <list date>, <time>"; Reopen for a closed ticket (not tapped); Assignee, Channel, DESCRIPTION; ACTIVITY entries, Add Note and the note box (not used). Back returns to the list.',
    observed: 'TT1 Test: Closed, Normal, opened by Yash 7 Oct 5:33 PM; Yash / CRM; desc, sol; 1 note.' }),
  tc({ ts: 'TS-MTKT-02', scenario: 'Ticket detail', id: 'MTKT-008', title: 'The ticket actions menu offers change status, change priority, edit and delete',
    steps: '1. Open TT1.\n2. More actions; read it; tap Close.', type: 'Functional', design: 'Positive',
    expected: '"Ticket Actions": Change Status, Change Priority, Edit, Delete Ticket. Nothing is chosen.', observed: 'All four offered; menu closed.' }),
];
