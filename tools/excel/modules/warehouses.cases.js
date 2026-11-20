// Mobile Warehouse test cases (More > INVENTORY > Warehouses), SalesHiker Android 1.0.0. Expected results come from the
// live app on the Realme RMX3997 (2026-11-18): 1,004 warehouses, all Active. References: East Warehouse 641 (every
// field), Central Warehouse 10 (holds stock), QA-TEST-R9 Warehouse (used by PO-0005). Read only: Save, Adjust stock
// Save, Delete and the PDF actions are never chosen; forms and sheets are closed unchanged or discarded.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Warehouses open.';
const tc = (fields) => ({ req: 'REQ-MWHS-01', input: 'Test account from config\\.env. Beta warehouses.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MWHS-01', scenario: 'Warehouse list', id: 'MWHS-001', title: 'Warehouses opens with the count, search, status chips and the warehouses',
    steps: '1. More > Warehouses.', type: 'Smoke', design: 'Positive',
    expected: '"Warehouses" with the count, New warehouse (not tapped), "Search warehouses", chip All selected; rows with name[, code][, city, state, country].', observed: '1,004 warehouses.' }),
  tc({ ts: 'TS-MWHS-01', scenario: 'Warehouse list', id: 'MWHS-002', title: 'Active and inactive counts add up to all warehouses and each chip lists its own',
    steps: '1. Tap Active, then Inactive; read the counts.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Active + Inactive = All; a chip with 0 shows "No warehouses found".', observed: 'Active 1,004, Inactive 0 (exploration).' }),
  tc({ ts: 'TS-MWHS-01', scenario: 'Warehouse list', id: 'MWHS-003', title: 'Search finds warehouses by name, code or city in any letter case',
    steps: '1. Search qa-test-r.\n2. Search wh-0641.\n3. Search KOLKATA.', input: 'qa-test-r; wh-0641; KOLKATA', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'qa-test-r: QA-TEST-R12 Warehouse and QA-TEST-R9 Warehouse, count 2; wh-0641: East Warehouse 641 only; KOLKATA: only warehouses in Kolkata.', observed: 'As expected (exploration; 166 in Kolkata).' }),
  tc({ ts: 'TS-MWHS-01', scenario: 'Warehouse list', id: 'MWHS-004', title: 'An unknown name finds no warehouses and Clear filters restores the list',
    steps: '1. Search qa_no_such_warehouse_zz.\n2. Tap Clear filters.', input: 'qa_no_such_warehouse_zz', type: 'Functional', design: 'Negative',
    expected: 'Count 0, "No warehouses found", "Try another search or status."; Clear filters empties the search, selects All and restores the count.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-02', scenario: 'Warehouse detail', id: 'MWHS-005', title: 'The warehouse detail shows its name, code, address and status as on the list',
    steps: '1. Search and open East Warehouse 641; read.\n2. Back.', type: 'Functional', design: 'Validation',
    expected: 'List row WH-0641, "Kolkata, WB, India"; header name, WH-0641, Active; SUMMARY name, Code, Address "641 Logistics Park, Kolkata, WB, India", Status Active, Created / Updated dates; tabs Summary, Stock, Movements, Activity.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-03', scenario: 'Stock', id: 'MWHS-006', title: 'The stock figures of a warehouse add up from its stock rows',
    steps: '1. Open Central Warehouse 10; read In stock, Units on hand, Low stock.\n2. Stock tab: read the rows; tap Low stock and back.', type: 'Functional', design: 'Validation',
    expected: '"Stock, n" = STOCK count = rows; Units on hand = sum of the quantities; In stock = products with stock; Low stock chip lists as many as the Low stock figure.', observed: '4 rows (1 + 0 + 5 + 0 = 6 units, 2 in stock, 0 low) (exploration).' }),
  tc({ ts: 'TS-MWHS-03', scenario: 'Stock', id: 'MWHS-007', title: 'The movements of a warehouse add up to the stock of each product',
    steps: '1. Open Central Warehouse 10.\n2. Stock tab: read; Movements tab: read all.', type: 'Functional', design: 'Validation',
    expected: 'Inbound movements are positive and outbound negative; for each product the movements add up to its stock; every moved product is on the Stock tab.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-03', scenario: 'Stock', id: 'MWHS-008', title: 'A reversed stock receipt shows both movements and leaves no stock',
    steps: '1. Open QA-TEST-R9 Warehouse; read.\n2. Stock, Movements and Activity tabs.', type: 'Functional', design: 'Validation',
    expected: 'Assigned to Yash; In stock 0, Units on hand 0; Stock: QA-TEST Gadget R3 0; Movements: GRN-0005 +4 Inbound "Stock receipt" and -4 Outbound "Stock receipt reversed"; ACTIVITY count = entries, with "Warehouse "QA-TEST-R9 Warehouse" created".', observed: 'As expected (exploration). PO-0005 still shows the 4 as received: MPUR-D02.' }),
  tc({ ts: 'TS-MWHS-04', scenario: 'Warehouse actions', id: 'MWHS-009', title: 'The actions menu offers edit, adjust, PDF and delete and blocks deleting a warehouse in use',
    steps: '1. Open QA-TEST-R9 Warehouse.\n2. More actions; read; Close.', type: 'Functional', design: 'Validation',
    expected: '"Warehouse actions": Edit, Adjust stock, View PDF, Save PDF, Delete (disabled: "This warehouse is used by 1 purchase order. Move or close them first."). Nothing chosen.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-04', scenario: 'Warehouse actions', id: 'MWHS-010', title: 'Adjust stock offers the product stock, the types and closes without a change',
    steps: '1. Open QA-TEST-R9 Warehouse.\n2. More actions > Adjust stock; search QA-TEST-SKU-R3; choose it; read.\n3. Close.', input: 'QA-TEST-SKU-R3', type: 'Functional', design: 'Validation',
    expected: '"Adjust stock" / QA-TEST Gadget R3, "0 in stock now at QA-TEST-R9 Warehouse", Warehouse QA-TEST-R9 Warehouse, type Inbound (+) selected (Outbound (-), Adjustment), Quantity 0, Reference "For example PO-123", Save (not tapped); Close leaves the stock at 0.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-04', scenario: 'Warehouse actions', id: 'MWHS-011', title: 'The edit form shows the saved values and cancels unchanged without asking',
    steps: '1. Open East Warehouse 641.\n2. More actions > Edit; read.\n3. Cancel.', type: 'Functional', design: 'Validation',
    expected: '"Edit warehouse": East Warehouse 641, WH-0641, Assigned to No owner, Active on, 641 Logistics Park, Kolkata, WB, India; Cancel closes without a dialog.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-05', scenario: 'New warehouse', id: 'MWHS-012', title: 'The new warehouse form shows its defaults and closes unchanged without asking',
    steps: '1. New warehouse; read.\n2. Cancel.', type: 'Functional', design: 'Validation',
    expected: 'Name hint "Main store", Code hint "WH-001", Assigned to Me, Active on, empty address; Save (not tapped); Cancel closes without a dialog; count unchanged.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MWHS-05', scenario: 'New warehouse', id: 'MWHS-013', title: 'A changed new warehouse asks before discarding, keeps the input on Cancel and saves nothing on Discard',
    steps: '1. New warehouse; name QA-TEST-WH draft.\n2. Cancel > Cancel.\n3. Cancel > Discard.\n4. Search the name.', input: 'QA-TEST-WH draft', type: 'Functional', design: 'Validation',
    expected: '"Discard this warehouse?" / "This warehouse is not saved yet."; Cancel keeps the name; Discard returns with the count unchanged; the name finds nothing.', observed: 'As expected (exploration).' }),
];
