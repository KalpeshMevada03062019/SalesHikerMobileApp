// Mobile Organizations test cases (More > CRM > Organizations), SalesHiker Android 1.0.0. Expected results come
// from the live app on the Realme RMX3997 (2026-11-03/04), with the seed organization "Seed — Acme Corp" as the
// reference record. Read only: no organization is created, edited or deleted, and no call, email, website or
// note is started.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Organizations open.';
const tc = (fields) => ({ req: 'REQ-MORG-01', input: 'Test account from config\\.env. Beta organizations; reference "Seed — Acme Corp".', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MORG-01', scenario: 'Organization list', id: 'MORG-001', title: 'Organizations opens with the count, search, New Organization and organizations',
    steps: '1. More > Organizations.', type: 'Smoke', design: 'Positive',
    expected: '"N organizations", "Search organizations", New Organization, and rows with initials, name, revenue, city / industry and date.',
    observed: '1,00,029 organizations listed.' }),
  tc({ ts: 'TS-MORG-01', scenario: 'Organization list', id: 'MORG-002', title: 'Search by part of a name is case-insensitive and shows how many match',
    steps: '1. Search ACME.', input: 'Search: ACME', type: 'Functional', design: 'Positive',
    expected: '"Seed — Acme Corp" is found; every result contains the word; "Showing N of N organizations" matches "N organizations".', observed: '1 organization, "Showing 1 of 1 organization".' }),
  tc({ ts: 'TS-MORG-01', scenario: 'Organization list', id: 'MORG-003', title: 'Search by website domain finds the organization',
    steps: '1. Search acme.com.', input: 'Search: acme.com', type: 'Functional', design: 'Positive',
    expected: '"Seed — Acme Corp" (website https://acme.com) is found.', observed: 'Found.' }),
  tc({ ts: 'TS-MORG-01', scenario: 'Organization list', id: 'MORG-004', title: 'An unknown name finds none and Clear Search restores the list',
    steps: '1. Search qa_no_such_org_zz.\n2. Tap Clear Search.', input: 'Search: qa_no_such_org_zz', type: 'Functional', design: 'Negative',
    expected: '"0 organizations", "No organizations found", "Try another name, domain, email or phone."; Clear Search restores all organizations.', observed: 'Empty state shown; list restored.' }),
  tc({ ts: 'TS-MORG-01', scenario: 'Organization list', id: 'MORG-005', title: 'Scrolling the list loads more organizations',
    steps: '1. Scroll down the list 8 times.', type: 'Functional', design: 'Positive',
    expected: 'Further organizations keep loading (well over three screens of distinct rows); the total does not change.', observed: 'More rows loaded.' }),
  tc({ ts: 'TS-MORG-02', scenario: 'Organization detail', id: 'MORG-006', title: 'The organization opens on Overview with the same revenue as the list and its details',
    steps: '1. Search acme, open "Seed — Acme Corp".\n2. Scroll through Overview.', type: 'Functional', design: 'Positive',
    expected: 'Call, Email, Website, Edit (not tapped); Overview selected; Owner; Annual Revenue as on the list row; ORGANIZATION INFO Phone, Email, Website (acme.com), Address, Industry, Employees; DESCRIPTION; TAGS.',
    observed: 'Annual Revenue ₹4,00,000 on both; all details shown.' }),
  tc({ ts: 'TS-MORG-02', scenario: 'Organization detail', id: 'MORG-007', title: 'The Contacts, Deals and Notes tabs list as many items as their counts',
    steps: '1. Open "Seed — Acme Corp".\n2. Tap Contacts, Deals, Notes.', type: 'Functional', design: 'Validation',
    expected: 'Contacts 0: "No contacts yet"; Deals N: N deals (name, amount, DEAL-number, stage); Notes N: N notes with author and date, and Add Note (not tapped).',
    observed: 'Contacts 0 empty; Deals 1 (DEAL-000001); Notes 1.' }),
  tc({ ts: 'TS-MORG-02', scenario: 'Organization detail', id: 'MORG-008', title: 'The actions menu offers edit, find duplicates and delete',
    steps: '1. Open "Seed — Acme Corp".\n2. More actions; read it; close it.', type: 'Functional', design: 'Positive',
    expected: '"Organization Actions": Edit, Find duplicates, Delete Organization. Nothing is chosen.', observed: 'All actions offered; menu closed.' }),
];
