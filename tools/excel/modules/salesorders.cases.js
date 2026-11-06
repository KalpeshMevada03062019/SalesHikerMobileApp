// Mobile Sales order test cases (More > SALES > Sales orders), SalesHiker Android 1.0.0. Expected results
// come from the live app on the Realme RMX3997 (2026-11-05). Read only: New sales order, Download PDF, Edit
// and every menu action are never tapped. Beta holds about 3 lakh sales orders; the QA reference is
// SO-300004 "QA-TEST-R12 Quote A" (Draft, ₹240), made from quotation QT-301006.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Sales orders open.';
const tc = (fields) => ({ req: 'REQ-MSOR-01', input: 'Test account from config\\.env. Beta sales orders.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MSOR-01', scenario: 'Sales order list', id: 'MSOR-001', title: 'Sales orders opens with the count, search, status filters and orders',
    steps: '1. More > Sales orders.', type: 'Smoke', design: 'Positive',
    expected: 'Count under the title, New sales order (not tapped), "Search order number or subject", chips All (selected) / Draft / Confirmed / Shipped / Delivered / Cancelled, rows with subject, ₹ amount, number, date and status.',
    observed: '3,00,004 sales orders.' }),
  tc({ ts: 'TS-MSOR-01', scenario: 'Sales order list', id: 'MSOR-002', title: 'Status counts add up to all sales orders',
    steps: '1. Read All.\n2. Tap Draft, Confirmed, Shipped, Delivered and Cancelled and read each count.', type: 'Functional', design: 'Validation',
    expected: 'Draft + Confirmed + Shipped + Delivered + Cancelled = All.', observed: '60,003 + 60,000 + 60,000 + 60,001 + 60,000 = 3,00,004.' }),
  tc({ ts: 'TS-MSOR-01', scenario: 'Sales order list', id: 'MSOR-003', title: 'Each status filter shows only sales orders with that status',
    steps: '1. Tap Draft, Confirmed, Shipped, Delivered and Cancelled in turn.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'The tapped chip is selected (not All) and only sales orders with that status are listed.', observed: 'Only matching statuses listed.' }),
  tc({ ts: 'TS-MSOR-01', scenario: 'Sales order list', id: 'MSOR-004', title: 'Search finds a sales order by number or subject in any letter case',
    steps: '1. Search so-300004.\n2. Search QA-TEST-R12.', input: 'Search: so-300004, then QA-TEST-R12', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only SO-300004 for the number; for the subject only subjects with the words (count = rows), SO-300004 among them. Results can take 10-20 s.',
    observed: 'SO-300004 found both ways.' }),
  tc({ ts: 'TS-MSOR-01', scenario: 'Sales order list', id: 'MSOR-005', title: 'An unknown word finds no sales orders and Clear filters restores the list',
    steps: '1. Search qa_no_such_order_zz.\n2. Tap Clear filters.', input: 'Search: qa_no_such_order_zz', type: 'Functional', design: 'Negative',
    expected: 'Count 0, "No sales orders found", "Try another search or status." and Clear filters; Clear filters empties the search, keeps All and restores the count.',
    observed: 'Empty state shown.' }),
  tc({ ts: 'TS-MSOR-02', scenario: 'Sales order detail', id: 'MSOR-006', title: 'The sales order detail shows its number, status, amount and subject as on the list',
    steps: '1. Search and open SO-300004.\n2. Tap Back.', type: 'Functional', design: 'Validation',
    expected: '"Sales order" with number, status, amount and subject as on the list; Back returns to the list.', observed: 'SO-300004, Draft, ₹240, QA-TEST-R12 Quote A.' }),
  tc({ ts: 'TS-MSOR-02', scenario: 'Sales order detail', id: 'MSOR-007', title: 'Line items, taxes and the total add up to the sales order amount',
    steps: '1. Open SO-300004.\n2. Read LINE ITEMS and the totals.', type: 'Functional', design: 'Validation',
    expected: 'As many lines as the LINE ITEMS count; each line total = quantity x unit price; Subtotal = sum of lines; Total = Subtotal + taxes - deductions = amount on the list.',
    observed: '2 x ₹96 = ₹192; 192 + 8.64 + 19.20 + 24 - 3.84 = ₹240.' }),
  tc({ ts: 'TS-MSOR-02', scenario: 'Sales order detail', id: 'MSOR-008', title: 'The sales order links to its quotation with the same amount and lines',
    steps: '1. Open SO-300004.\n2. Scroll to RELATED; tap Quotation.\n3. Tap Back.', type: 'Functional', design: 'Validation',
    expected: 'RELATED: "Quotation, QT-301006" and Assigned to; Download PDF and Edit (not tapped). The quotation opens with the same amount and line items; Back returns to the sales order.',
    observed: 'QT-301006, ₹240, same line; back on SO-300004.' }),
  tc({ ts: 'TS-MSOR-02', scenario: 'Sales order detail', id: 'MSOR-009', title: 'The actions menu offers status, invoice, delivery, expense, PDF, notes, task, edit and delete',
    steps: '1. Open SO-300004.\n2. More actions; read it; tap Close.', type: 'Functional', design: 'Positive',
    expected: '"Sales order actions": Change status, Convert to invoice, Create delivery note, Add expense, View PDF, Notes, Add task, Edit, Delete, all enabled. Nothing is chosen.',
    observed: 'All nine offered; menu closed.' }),
];
