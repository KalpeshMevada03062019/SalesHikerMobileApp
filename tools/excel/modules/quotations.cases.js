// Mobile Quotations test cases (More > SALES > Quotations), SalesHiker Android 1.0.0. Expected results come
// from the live app on the Realme RMX3997 (2026-11-05). Read only: Change status, Convert to sales order,
// View PDF, Share link, Download PDF and Share are never tapped. Beta holds about 3 lakh quotations; the QA
// reference is QT-301006 "QA-TEST-R12 Quote A" (Draft, ₹240, sales order SO-300004).

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Quotations open.';
const tc = (fields) => ({ req: 'REQ-MQTN-01', input: 'Test account from config\\.env. Beta quotations.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MQTN-01', scenario: 'Quotation list', id: 'MQTN-001', title: 'Quotations opens with the count, search, status filters and quotations',
    steps: '1. More > Quotations.', type: 'Smoke', design: 'Positive',
    expected: 'Count under the title, "Search quotations", chips All (selected) / Draft / Sent / Accepted / Declined / Expired, rows with title, ₹ amount, QT- / QUO- number, date and status.',
    observed: '3,01,003 quotations.' }),
  tc({ ts: 'TS-MQTN-01', scenario: 'Quotation list', id: 'MQTN-002', title: 'Status counts add up to all quotations',
    steps: '1. Read All.\n2. Tap Draft, Sent, Accepted, Declined and Expired and read each count.', type: 'Functional', design: 'Validation',
    expected: 'Draft + Sent + Accepted + Declined + Expired = All.',
    observed: '60,108 + 60,111 + 60,116 + 60,126 + 60,114 = 3,00,575, 428 below All 3,01,003 (MQTN-D01).',
    defect: 'MQTN-D01' }),
  tc({ ts: 'TS-MQTN-01', scenario: 'Quotation list', id: 'MQTN-003', title: 'Each status filter shows only quotations with that status',
    steps: '1. Tap Draft, Sent, Accepted, Declined and Expired in turn.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only the tapped chip is selected and only quotations with that status are listed.', observed: 'Only matching statuses listed.' }),
  tc({ ts: 'TS-MQTN-01', scenario: 'Quotation list', id: 'MQTN-004', title: 'Search finds a quotation by title or number in any letter case',
    steps: '1. Search QA-TEST-R12.\n2. Search qt-301006.', input: 'Search: QA-TEST-R12, then qt-301006', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'QT-301006 found by title (only titles with the words, count = rows) and by number (only QT-301006). Results can take 10-20 s.',
    observed: 'Found by title and number.' }),
  tc({ ts: 'TS-MQTN-01', scenario: 'Quotation list', id: 'MQTN-005', title: 'An unknown word finds no quotations and Clear filters restores the list',
    steps: '1. Search qa_no_such_quote_zz.\n2. Tap Clear filters.', input: 'Search: qa_no_such_quote_zz', type: 'Functional', design: 'Negative',
    expected: 'Count 0, "No quotations found", "Try another search or status." and Clear filters; Clear filters empties the search, keeps All and restores the count.',
    observed: 'Empty state shown after about 20 s.' }),
  tc({ ts: 'TS-MQTN-02', scenario: 'Quotation detail', id: 'MQTN-006', title: 'The quotation detail shows its number, status, amount and title as on the list',
    steps: '1. Search and open QT-301006.\n2. Tap Back.', type: 'Functional', design: 'Validation',
    expected: '"Quotation" with number, status, amount and title as on the list; Back returns to the list.', observed: 'QT-301006, Draft, ₹240, QA-TEST-R12 Quote A.' }),
  tc({ ts: 'TS-MQTN-02', scenario: 'Quotation detail', id: 'MQTN-007', title: 'Line items, taxes and the total add up to the quotation amount',
    steps: '1. Open QT-301006.\n2. Read LINE ITEMS and the totals.', type: 'Functional', design: 'Validation',
    expected: 'As many lines as the LINE ITEMS count; each line total = quantity x unit price; Subtotal = sum of lines; Total = Subtotal + taxes - deductions = amount on the list.',
    observed: '1 line 2 x ₹96 = ₹192; 192 + 8.64 (VAT 4.5%) + 19.20 (Sales 10%) + 24 (Service 12.5%) - 3.84 (Deducted Tax) = ₹240.' }),
  tc({ ts: 'TS-MQTN-02', scenario: 'Quotation detail', id: 'MQTN-008', title: 'The quotation shows who it is assigned to, its sales order and the share options',
    steps: '1. Open QT-301006.\n2. Scroll to RELATED.', type: 'Functional', design: 'Positive',
    expected: 'RELATED: Assigned to <name>; "Sales order, <status>, SO-<n>, <same amount>"; "Share sends a link your customer can open and print." with Download PDF and Share (not tapped).',
    observed: 'Yash; Sales order Draft SO-300004 ₹240.' }),
  tc({ ts: 'TS-MQTN-02', scenario: 'Quotation detail', id: 'MQTN-009', title: 'The actions menu offers its actions and blocks a second sales order',
    steps: '1. Open QT-301006.\n2. More actions; read it; tap Close.', type: 'Functional', design: 'Negative',
    expected: '"Quotation actions": Change status, Convert to sales order (disabled: "This quotation already has a sales order."), View PDF, Share link. Nothing is chosen.',
    observed: 'As expected; menu closed.' }),
];
