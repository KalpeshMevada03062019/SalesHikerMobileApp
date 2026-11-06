// Mobile Invoice test cases (More > SALES > Invoices), SalesHiker Android 1.0.0. Expected results come from the
// live app on the Realme RMX3997 (2026-11-06). Read only: New invoice, Record payment, Share and every menu action
// are never tapped. Beta holds about 3 lakh invoices; the references are INV-300005 "test" (Paid, ₹1,076.92, made
// from SO-077380) and INV-004221 "Invoice 4221" (Partially Paid, ₹98,500.13).

const PRE = 'Registered beta test account (config\.env).\nApp restarted signed in; More > Invoices open.';
const tc = (fields) => ({ req: 'REQ-MINV-01', input: 'Test account from config\.env. Beta invoices.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MINV-01', scenario: 'Invoice list', id: 'MINV-001', title: 'Invoices opens with the count, search, status filters and invoices',
    steps: '1. More > Invoices.', type: 'Smoke', design: 'Positive',
    expected: 'Count under the title, New invoice (not tapped), "Search invoices", chips All (selected) / Draft / Sent / Approved / Paid / Partially Paid / Overdue / Void, rows with subject, ₹ amount, INV- number, status and, when set, "Due <date>" and "Paid ₹<amount>".',
    observed: '3,00,005 invoices.' }),
  tc({ ts: 'TS-MINV-01', scenario: 'Invoice list', id: 'MINV-002', title: 'Status counts add up to all invoices',
    steps: '1. Read All.\n2. Tap each status chip and read its count.', type: 'Functional', design: 'Validation',
    expected: 'Draft + Sent + Approved + Paid + Partially Paid + Overdue + Void = All.', observed: 'See the run.' }),
  tc({ ts: 'TS-MINV-01', scenario: 'Invoice list', id: 'MINV-003', title: 'Each status filter shows only invoices with that status',
    steps: '1. Tap each status chip in turn.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'The tapped chip is selected (not All) and only invoices with that status are listed.', observed: 'See the run.' }),
  tc({ ts: 'TS-MINV-01', scenario: 'Invoice list', id: 'MINV-004', title: 'Search finds an invoice by number or subject in any letter case',
    steps: '1. Search inv-300005.\n2. Search INVOICE 4221.', input: 'Search: inv-300005, then INVOICE 4221', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only INV-300005 for the number; for the subject only subjects with the words (count = rows), INV-004221 among them. Results can take 10-20 s.',
    observed: 'See the run.' }),
  tc({ ts: 'TS-MINV-01', scenario: 'Invoice list', id: 'MINV-005', title: 'An unknown word finds no invoices and Clear filters restores the list',
    steps: '1. Search qa_no_such_invoice_zz.\n2. Tap Clear filters.', input: 'Search: qa_no_such_invoice_zz', type: 'Functional', design: 'Negative',
    expected: 'Count 0, "No invoices found", "Try another search or status." and Clear filters; Clear filters empties the search, keeps All and restores the count.',
    observed: 'Empty state shown (exploration).' }),
  tc({ ts: 'TS-MINV-02', scenario: 'Invoice detail', id: 'MINV-006', title: 'The invoice detail shows its number, status, amount, subject and due date as on the list',
    steps: '1. Search and open INV-004221.\n2. Tap Back.', type: 'Functional', design: 'Validation',
    expected: '"Invoice" with number, status, amount and subject as on the list and the due date with its year; Back returns to the list. The detail can take 30 s to load.',
    observed: 'INV-004221, Partially Paid, ₹98,500.13, Invoice 4221, Due 8 Jul 2026.' }),
  tc({ ts: 'TS-MINV-02', scenario: 'Invoice calculation', id: 'MINV-007', title: 'Line items with discount, taxes and the total add up to the invoice amount',
    steps: '1. Open INV-300005.\n2. Read LINE ITEMS and the totals.', type: 'Functional', design: 'Validation',
    expected: 'As many lines as the LINE ITEMS count; each line total = quantity x unit price less its discount; Subtotal = sum of lines; Total = Subtotal + taxes - deductions = amount on the list.',
    observed: '1 x ₹1,110 less 1% = ₹1,098.90; 1,098.90 - 21.98 (Deducted Tax) = ₹1,076.92.' }),
  tc({ ts: 'TS-MINV-03', scenario: 'Invoice payments', id: 'MINV-008', title: 'A paid invoice shows its payments adding up to the total with nothing due',
    steps: '1. Open INV-300005.\n2. Read PAYMENT and the payment history.', type: 'Functional', design: 'Validation',
    expected: 'Paid on the list; PAYMENT Total = invoice amount; Paid = sum of the payments = Total; Balance due ₹0; progress "Paid 100%"; no Record payment button, only Share with "Share sends a link your customer can open and print."',
    observed: '₹976.92 + ₹100 = ₹1,076.92; Balance due ₹0; Paid 100%.' }),
  tc({ ts: 'TS-MINV-03', scenario: 'Invoice payments', id: 'MINV-009', title: 'A partially paid invoice shows paid, balance and progress that agree with each other and its payments',
    steps: '1. Open INV-004221.\n2. Read the summary, PAYMENT and the payment history.', type: 'Functional', design: 'Validation',
    expected: 'Partially Paid; Total = amount; Paid = "Paid ₹" on the list; Balance due = Total - Paid = Balance in the summary; progress = Paid / Total rounded; Record payment offered (not tapped); the payments listed add up to Paid.',
    observed: 'Total ₹98,500.13, Paid ₹40,381, Balance ₹58,119.13, Paid 41%; one payment of ₹500 listed.' }),
  tc({ ts: 'TS-MINV-02', scenario: 'Invoice detail', id: 'MINV-010', title: 'The invoice links to its sales order and the sales order lists the invoice',
    steps: '1. Open INV-300005.\n2. Scroll to RELATED; tap Sales order.\n3. Read INVOICES; tap Back.', type: 'Functional', design: 'Validation',
    expected: 'RELATED "Sales order, SO-077380"; the sales order opens and lists "Paid, INV-300005, ₹1,076.92" under INVOICES; Back returns to the invoice.',
    observed: 'SO-077380 lists INV-300005 (exploration).' }),
  tc({ ts: 'TS-MINV-02', scenario: 'Invoice detail', id: 'MINV-011', title: 'The actions menu offers status, payment, PDF, share, delivery, expense, notes, task, edit and delete',
    steps: '1. Open INV-004221.\n2. More actions; read it; tap Close.', type: 'Functional', design: 'Positive',
    expected: '"Invoice actions": Change status, Record payment, View PDF, Download PDF, Share link, Create delivery note, Add expense, Notes, Add task, Edit, Delete, all enabled. Nothing is chosen.',
    observed: 'All eleven offered (exploration).' }),
];
