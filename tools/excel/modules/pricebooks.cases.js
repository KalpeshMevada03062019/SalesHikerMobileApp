// Mobile Price Book test cases (More > INVENTORY > Price Books), SalesHiker Android 1.0.0. Expected results come
// from the live app on the Realme RMX3997 (2026-11-17): 5 price books, all Active; reference "SalesHiker Pricebook 1"
// (USD, one price). Read only: Save, Remove price, Add organization / contact and the menu actions are never chosen.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Price Books open.';
const tc = (fields) => ({ req: 'REQ-MPBK-01', input: 'Test account from config\\.env. Price book SalesHiker Pricebook 1.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MPBK-01', scenario: 'Price book list', id: 'MPBK-001', title: 'Price Books opens with the count, search, status chips and the price books',
    steps: '1. More > Price Books.', type: 'Smoke', design: 'Positive',
    expected: '"N price books", New price book (not tapped), "Search price books", chips "All, N" (selected) / "Active, n" / "Inactive, n"; rows with name and "currency, n prices[, vendor]".', observed: '5 price books.' }),
  tc({ ts: 'TS-MPBK-01', scenario: 'Price book list', id: 'MPBK-002', title: 'The status chips count all, active and inactive books and each lists its own',
    steps: '1. Read the chip counts.\n2. Tap Active, then Inactive.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'All = header count = Active + Inactive; each chip lists as many as its count; an empty one shows "No price books found" / "Try another search or status."', observed: 'Active 5, Inactive 0 (exploration).' }),
  tc({ ts: 'TS-MPBK-01', scenario: 'Price book list', id: 'MPBK-003', title: 'Search finds price books in any letter case and the chip counts follow the search',
    steps: '1. Search PRICEBOOK.', input: 'PRICEBOOK', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'SalesHiker Pricebook 2 and 1; "2 price books"; chips All 2 = Active + Inactive.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-01', scenario: 'Price book list', id: 'MPBK-004', title: 'An unknown name finds no price books and Clear filters restores the list',
    steps: '1. Search qa_no_such_book_zz.\n2. Tap Clear filters.', input: 'qa_no_such_book_zz', type: 'Functional', design: 'Negative',
    expected: '"0 price books", "No price books found", "Try another search or status." and Clear filters; Clear filters restores the count.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-02', scenario: 'Price book detail', id: 'MPBK-005', title: 'The price book detail shows its name, currency, status and details as on the list',
    steps: '1. Open SalesHiker Pricebook 1.\n2. Tap Details.', type: 'Functional', design: 'Validation',
    expected: 'Header name, USD, Active; "Prices, 1"; DETAILS Currency USD, Status Active, Default No, Vendor SalesHiker Vendor, Products 1, Created / Updated; NOTES "SalesHiker Pricebook 1".', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-02', scenario: 'Price book detail', id: 'MPBK-006', title: 'Each price book on the list has as many prices as its prices tab shows',
    steps: '1. For each book: read "n prices" on the list, open it, read the Prices tab and rows; Back.', type: 'Functional', design: 'Validation',
    expected: 'List count = "Prices, n" = price rows for every book.', observed: '1, 1, 1, 0, 0 (exploration).' }),
  tc({ ts: 'TS-MPBK-03', scenario: 'Prices', id: 'MPBK-007', title: 'A price opens its edit sheet with the saved price and cost and closes unchanged',
    steps: '1. Open SalesHiker Pricebook 1.\n2. Tap the KRI KRI price; read; Close.', type: 'Functional', design: 'Validation',
    expected: 'PRICES 1: "KRI KRI ..., $188.16, Cost $20"; "Edit price" / "SalesHiker Pricebook 1, USD" with the product, Unit price 188.16, Purchase cost 20, Save and Remove price (not tapped); prices unchanged.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-03', scenario: 'Prices', id: 'MPBK-008', title: 'Add price offers the products in the book currency and closes without adding a price',
    steps: '1. Open SalesHiker Pricebook 1.\n2. Add price; read.\n3. Product; search QA-TEST-SKU-R3; Close.\n4. Close.', input: 'QA-TEST-SKU-R3', type: 'Functional', design: 'Validation',
    expected: '"Add price" / "SalesHiker Pricebook 1, USD", "Product: Choose a product", Unit price (USD), the bulk-quantity hint, Save (not tapped), no Remove; the picker finds "QA-TEST Gadget R3, QA-TEST-SKU-R3, ₹100.12"; prices unchanged.',
    observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-03', scenario: 'Customers', id: 'MPBK-009', title: 'The customers tab lists the organizations and contacts that use the book',
    steps: '1. Open SalesHiker Pricebook 1.\n2. Tap Customers.', type: 'Functional', design: 'Validation',
    expected: 'Add organization and Add contact (not tapped); ORGANIZATIONS and CONTACTS counts; "No organizations use this book." / "No contacts use this book." exactly when 0.', observed: '0 and 0 (exploration).' }),
  tc({ ts: 'TS-MPBK-04', scenario: 'Price book actions', id: 'MPBK-010', title: 'The actions menu offers edit, status, PDF and delete actions and closes without a change',
    steps: '1. Open SalesHiker Pricebook 1.\n2. More actions; read it; Close.', type: 'Functional', design: 'Validation',
    expected: '"Price book actions": Edit, Mark inactive, View PDF, Save PDF, Delete, all enabled. Nothing is chosen; still Active.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-04', scenario: 'Price book actions', id: 'MPBK-011', title: 'The edit form shows the saved values and the currencies and cancels unchanged',
    steps: '1. Open SalesHiker Pricebook 1.\n2. More actions > Edit; read.\n3. Currency; read; Close.\n4. Cancel.', type: 'Functional', design: 'Validation',
    expected: '"Edit price book": name, "USD, US Dollar", SalesHiker Vendor, notes, Active on, Workspace default off with their hints; currencies "XXX, name"; Cancel closes without a dialog.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-05', scenario: 'New price book', id: 'MPBK-012', title: 'The new price book form shows its defaults and the suppliers and closes unchanged without asking',
    steps: '1. New price book; read.\n2. Vendor; read; Close.\n3. Cancel.', type: 'Functional', design: 'Validation',
    expected: 'Empty name (hint "For example Wholesale"), "INR, Indian Rupee", No supplier, empty notes, Active on, Workspace default off; suppliers include QA-TEST-R9 Supplier; Cancel closes without a dialog; count unchanged.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MPBK-05', scenario: 'New price book', id: 'MPBK-013', title: 'A changed new price book asks before discarding, keeps the input on Cancel and saves nothing on Discard',
    steps: '1. New price book; name QA-TEST-PB draft.\n2. Cancel > Cancel.\n3. Cancel > Discard.\n4. Search the name.', input: 'QA-TEST-PB draft', type: 'Functional', design: 'Validation',
    expected: '"Discard this price book?" / "This price book is not saved yet."; Cancel keeps the name; Discard returns with the count unchanged; the name finds nothing.', observed: 'As expected (exploration).' }),
];
