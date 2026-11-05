// Mobile Documents test cases (More > CRM > Documents), SalesHiker Android 1.0.0. Expected results come from
// the live app on the Realme RMX3997 (2026-11-05). Read only: Upload document, Open, Download, Share, Rename
// and Delete are never tapped; a row is never tapped (it may open the file), the detail is reached through
// Actions > Details.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Documents open.';
const tc = (fields) => ({ req: 'REQ-MDOC-01', input: 'Test account from config\\.env. Beta documents.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MDOC-01', scenario: 'Document list', id: 'MDOC-001', title: 'Documents opens with the count, search, upload and the documents',
    steps: '1. More > Documents.', type: 'Smoke', design: 'Positive',
    expected: 'Title Documents with the count under it, Upload document (not tapped), "Search documents", rows with name, date, size and folder, and "Showing N of N documents".',
    observed: '5 documents, all in Default; "Showing 5 of 5 documents".' }),
  tc({ ts: 'TS-MDOC-01', scenario: 'Document list', id: 'MDOC-002', title: 'Each document shows its name, a readable date, its size and folder, and an actions button',
    steps: '1. Read every row.', type: 'Functional', design: 'Validation',
    expected: 'Date as a weekday (this week) or "d Mon"; size as "N B / KB / MB"; a folder; "Actions for <name>".',
    observed: 'Fri, 29 Oct, 22 Oct, 8 Oct, 1 Oct; 27 B to 2.4 MB.' }),
  tc({ ts: 'TS-MDOC-01', scenario: 'Document list', id: 'MDOC-003', title: 'Search finds documents by name in any letter case and updates the counts',
    steps: '1. Search QA.', input: 'Search: QA', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only documents with "qa" in the name (any case); the count under the title and "Showing N of N documents" equal the rows, fewer than all.',
    observed: '3 documents: QA-contacts-att.txt, QA-TEST-R12 doc b lowercase, qa-test-doc.txt.' }),
  tc({ ts: 'TS-MDOC-01', scenario: 'Document list', id: 'MDOC-004', title: 'An unknown name finds no documents and Clear Filters restores the list',
    steps: '1. Search qa_no_such_doc_zz.\n2. Tap Clear Filters.', input: 'Search: qa_no_such_doc_zz', type: 'Functional', design: 'Negative',
    expected: 'Count 0, "No documents found", "Try another search or folder." and Clear Filters; Clear Filters empties the search and restores every document.',
    observed: 'Empty state shown; list restored (with the keyboard open, the first tap only closes it).' }),
  tc({ ts: 'TS-MDOC-02', scenario: 'Document actions and detail', id: 'MDOC-005', title: 'The actions sheet offers open, download, share and details',
    steps: '1. Tap the actions button of the first document.\n2. Read the sheet; tap Close.', type: 'Functional', design: 'Positive',
    expected: 'Sheet titled with the document name: Open, Download, Share, Details. Nothing is chosen.', observed: 'All four offered; sheet closed.' }),
  tc({ ts: 'TS-MDOC-02', scenario: 'Document actions and detail', id: 'MDOC-006', title: 'Details shows the file name, size, folder and creation as on the list',
    steps: '1. Actions > Details on the first document.\n2. Read the detail.\n3. Tap Back.', type: 'Functional', design: 'Validation',
    expected: '"Document" with the name, a DOC code and Active; File name, Size and Folder as on the list; Created by; Created on the list date; Downloads; "Opens on this phone. Download saves or shares the file." with Download and Open (not tapped). Back returns to the list.',
    observed: 'QA-contacts-att.txt: DOC10, Active, 27 B, Default, Yash, 30 Oct 9:51 PM (list "Fri"), 0 downloads.' }),
  tc({ ts: 'TS-MDOC-02', scenario: 'Document actions and detail', id: 'MDOC-007', title: 'The detail menu offers rename and delete',
    steps: '1. Actions > Details on the first document.\n2. Tap More actions; read it; tap Close.', type: 'Functional', design: 'Positive',
    expected: 'Rename and Delete. Nothing is chosen; the detail stays open.', observed: 'Rename and Delete offered; menu closed.' }),
];
