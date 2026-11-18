// Mobile Category test cases (More > INVENTORY > Categories), SalesHiker Android 1.0.0. Expected results come from
// the live app on the Realme RMX3997 (2026-11-17): 24 categories; reference BEVERAGES (96 products, sort order 5).
// Read only: Save, View PDF, Save PDF and Delete are never chosen; Edit and Rename are closed unchanged.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Categories open.';
const tc = (fields) => ({ req: 'REQ-MCAT-01', input: 'Test account from config\\.env. Category BEVERAGES.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MCAT-01', scenario: 'Category list', id: 'MCAT-001', title: 'Categories opens with the count, search, new category and the categories',
    steps: '1. More > Categories.', type: 'Smoke', design: 'Positive',
    expected: '"N categories", New category (not tapped), "Search categories", one row per category name.', observed: '24 categories.' }),
  tc({ ts: 'TS-MCAT-01', scenario: 'Category list', id: 'MCAT-002', title: 'Scrolling the list shows every category once, as many as the count',
    steps: '1. Scroll to "End of list.".', type: 'Functional', design: 'Validation',
    expected: 'As many names as the count, none twice, "End of list. N categories."; BEVERAGES and Uncategorized listed.', observed: '24 names (exploration).' }),
  tc({ ts: 'TS-MCAT-01', scenario: 'Category list', id: 'MCAT-003', title: 'Search finds categories by part of the name in any letter case',
    steps: '1. Search bread.', input: 'bread', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'BREAD AND BAKERY and BREAD AND BAKERY, FROZEN; "2 categories"; "End of list. 2 categories."', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-01', scenario: 'Category list', id: 'MCAT-004', title: 'An unknown name finds no categories and Clear search restores the list',
    steps: '1. Search qa_no_such_category_zz.\n2. Tap Clear search on the empty state.', input: 'qa_no_such_category_zz', type: 'Functional', design: 'Negative',
    expected: '"0 categories", "No categories found", "Try another name." and Clear search; Clear search empties the search and restores the count.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-02', scenario: 'Category detail', id: 'MCAT-005', title: 'The category detail shows its name, status, product count, sub-categories and details',
    steps: '1. Search and open BEVERAGES.\n2. Tap Back.', type: 'Functional', design: 'Validation',
    expected: 'BEVERAGES, Active; PRODUCTS n with "View n products"; SUB-CATEGORIES 0 "No sub-categories."; Sort order 5; Created and Updated "d Mon, h:mm AM"; Back returns to the list.',
    observed: '96 products (exploration).' }),
  tc({ ts: 'TS-MCAT-02', scenario: 'Category detail', id: 'MCAT-006', title: 'View products opens the products of the category with the same count',
    steps: '1. Open BEVERAGES.\n2. Tap View n products.\n3. Back.', type: 'Functional', design: 'Validation',
    expected: 'Products with the BEVERAGES chip selected and "n products" = PRODUCTS; no row of another category; Back returns to the category.', observed: '96 = 96 (exploration).' }),
  tc({ ts: 'TS-MCAT-03', scenario: 'Category actions', id: 'MCAT-007', title: 'The actions menu offers edit, rename, PDF and delete actions and closes without a change',
    steps: '1. Open BEVERAGES.\n2. More actions; read it; Close.', type: 'Functional', design: 'Validation',
    expected: '"Category actions": Edit, Rename, View PDF, Save PDF, Delete, all enabled. Nothing is chosen.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-03', scenario: 'Category actions', id: 'MCAT-008', title: 'The edit form shows the saved values, leaves the category out of its own parents and cancels unchanged',
    steps: '1. Open BEVERAGES.\n2. More actions > Edit; read the form.\n3. Parent category; search BEVERAGES; Close.\n4. Cancel.', type: 'Functional', design: 'Validation',
    expected: '"Edit category": BEVERAGES, No parent, empty description, Sort order 5 with "Lower numbers show first.", Assigned to No one, Active on; BEVERAGES not offered as its own parent; Cancel closes without a dialog.',
    observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-03', scenario: 'Category actions', id: 'MCAT-009', title: 'Rename shows the current name and closes without renaming',
    steps: '1. Open BEVERAGES.\n2. More actions > Rename; read it; Close.', type: 'Functional', design: 'Positive',
    expected: '"Rename category" with Category name BEVERAGES and Save (not tapped); after Close the name is unchanged.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-04', scenario: 'New category', id: 'MCAT-010', title: 'The new category form shows its defaults, offers every category as parent and closes unchanged without asking',
    steps: '1. New category; read the form.\n2. Parent category; search BEVERAGES; Close.\n3. Cancel.', type: 'Functional', design: 'Validation',
    expected: 'Empty name, No parent, empty description, Sort order 0 with "Lower numbers show first.", Assigned to No one, Active on; BEVERAGES offered as parent; Cancel closes without a dialog; count unchanged.',
    observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-04', scenario: 'New category', id: 'MCAT-011', title: 'A changed new category asks before discarding, keeps the input on Cancel and saves nothing on Discard',
    steps: '1. New category; name QA-TEST-CAT draft.\n2. Cancel > Cancel.\n3. Cancel > Discard.\n4. Search the name.', input: 'QA-TEST-CAT draft', type: 'Functional', design: 'Validation',
    expected: '"Discard this category?" / "This category is not saved yet."; Cancel keeps the name; Discard returns with the count unchanged; the name finds nothing.', observed: 'As expected (exploration).' }),
  tc({ ts: 'TS-MCAT-01', scenario: 'Category list', id: 'MCAT-012', title: 'The list shows lower sort orders first as the form says',
    steps: '1. Open each of the first 6 categories; read Sort order; Back.', type: 'Functional', design: 'Validation',
    expected: 'The form says "Lower numbers show first.": the list in ascending sort order.',
    observed: 'Alphabetical: 4, 1, 5, 7, 1, 6 (exploration; MCAT-D01).', defect: 'MCAT-D01' }),
];
