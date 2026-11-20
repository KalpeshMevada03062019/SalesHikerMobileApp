// Mobile Stock Receipt test cases (More > INVENTORY > Stock Receipts), SalesHiker Android 1.0.0. Expected results come
// from the live app on the Realme RMX3997 (2026-11-20): 5 receipts, all Applied (the same on the web; reversed receipts
// are not listed). Reference GRN-0004, received against PO-0004. Read only: Create, Reverse stock, Delete and the PDF
// actions are never chosen; the new-receipt form is discarded.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Stock Receipts open.';
const tc = (fields) => ({ req: 'REQ-MSRC-01', input: 'Test account from config\\.env. Stock receipt GRN-0004.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MSRC-01', scenario: 'Stock receipt list', id: 'MSRC-001', title: 'Stock Receipts opens with the count, search and the receipts',
    steps: '1. More > Stock Receipts.', type: 'Smoke', design: 'Positive',
    expected: '"Stock receipts" with the count, New stock receipt (not tapped), "Search receipt number"; rows supplier (or "No supplier"), date, "GRN-n, warehouse", status; "End of list. N stock receipts."', observed: '5 receipts, as on the web.' }),
  tc({ ts: 'TS-MSRC-01', scenario: 'Stock receipt list', id: 'MSRC-002', title: 'Search finds a receipt by its number in any letter case',
    steps: '1. Search grn-0002.', input: 'grn-0002', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only GRN-0002 (greek, East Warehouse 1); count 1.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-01', scenario: 'Stock receipt list', id: 'MSRC-003', title: 'An unknown number finds no receipts and Clear filters restores the list',
    steps: '1. Search qa_no_such_grn_zz.\n2. Tap Clear filters.', input: 'qa_no_such_grn_zz', type: 'Functional', design: 'Negative',
    expected: 'Count 0, "No stock receipts found", "Try another search or status." and Clear filters; Clear filters empties the search and restores the count.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-02', scenario: 'Stock receipt detail', id: 'MSRC-004', title: 'The receipt detail shows its number, status, amount, date, warehouse, items and notes as on the list',
    steps: '1. Open GRN-0004; read.', type: 'Functional', design: 'Validation',
    expected: 'List 9 Oct, Central Warehouse 10, Applied; header GRN-0004, Applied, ₹500.60, "Received 9 Oct 2026"; Warehouse Central Warehouse 10, Purchase order PO-0004, Created 9 Oct 2026; ITEMS 1: QA-TEST Gadget R3 5 x ₹100.12 = ₹500.60; Total ₹500.60; NOTES "Received against PO-0004" (as on the web).', observed: 'As expected (exploration and web).' }),
  tc({ ts: 'TS-MSRC-02', scenario: 'Calculation', id: 'MSRC-005', title: 'Every receipt adds up from its lines to its total and the amount in its header',
    steps: '1. Open each receipt; read the items, Total and the header amount; Back.', type: 'Functional', design: 'Validation',
    expected: 'Each line = qty x unit cost; Total = sum of the lines = the header amount; ITEMS count = lines.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-02', scenario: 'Stock receipt detail', id: 'MSRC-006', title: 'A receipt opens the purchase order it was received against',
    steps: '1. Open GRN-0004.\n2. Tap Purchase order PO-0004.\n3. Back.', type: 'Functional', design: 'Validation',
    expected: 'PO-0004 opens with QA-TEST Gadget R3, 5 x ₹100.12, as on the receipt; Back returns to GRN-0004.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-03', scenario: 'Stock receipt actions', id: 'MSRC-007', title: 'The actions menu offers reverse, PDF and delete and explains why delete is blocked',
    steps: '1. Open GRN-0004.\n2. More actions; read; Close.', type: 'Functional', design: 'Validation',
    expected: '"Reverse the stock, then delete it." above Delete (disabled) and Reverse stock (enabled, not tapped); "Stock receipt actions": Reverse stock, View PDF, Save PDF, Delete (disabled, same reason). Nothing chosen.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-04', scenario: 'New stock receipt', id: 'MSRC-008', title: 'The new stock receipt form shows its defaults and closes unchanged without asking',
    steps: '1. New stock receipt; read.\n2. Cancel.', type: 'Functional', design: 'Validation',
    expected: '"The stock goes into the warehouse when you save.", Choose a supplier, Choose a warehouse, Received date today, no lines, empty notes, Create (not tapped); Cancel closes without a dialog; count unchanged.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-04', scenario: 'New stock receipt', id: 'MSRC-009', title: 'The supplier and warehouse pickers list the suppliers and the warehouses with their codes',
    steps: '1. New stock receipt.\n2. Supplier; read; Close.\n3. Warehouse; read; Close.\n4. Cancel.', type: 'Functional', design: 'Validation',
    expected: 'Suppliers include QA-TEST-R9 Supplier and SalesHiker Vendor (names only in the report); warehouses "name, code" including "Central Warehouse 10, WH-0010"; nothing chosen.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-04', scenario: 'New stock receipt', id: 'MSRC-010', title: 'A receipt line takes the product cost and totals quantity times cost',
    steps: '1. New stock receipt > Add product; search QA-TEST-SKU-R3; choose it; read.\n2. Qty 3; Add line; read.\n3. Discard.', input: 'QA-TEST-SKU-R3, Qty 3', type: 'Functional', design: 'Validation',
    expected: 'New line: Product QA-TEST Gadget R3, Name, Qty 1, Unit cost 100.12; after Qty 3: "QA-TEST Gadget R3, 3 x ₹100.12, ₹300.36", Lines total ₹300.36.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MSRC-04', scenario: 'New stock receipt', id: 'MSRC-011', title: 'A changed new receipt asks before discarding, keeps the line on Cancel and saves nothing on Discard',
    steps: '1. New stock receipt; add a line.\n2. Cancel > Cancel.\n3. Cancel > Discard.', type: 'Functional', design: 'Validation',
    expected: '"Discard this receipt?" / "This receipt is not saved yet."; Cancel keeps the line; Discard returns with the count unchanged.', observed: 'As expected (exploration).' }),
];
