// Mobile Leads test cases (More > CRM > Leads), SalesHiker Android 1.0.0. Expected results come from the live
// app on the Realme RMX3997 (2026-11-04). Read only: no lead is created, edited, converted, re-statused or
// deleted, and no WhatsApp, call or note is started. New leads keep arriving on beta, so totals can grow
// during a test.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Leads open.';
const tc = (fields) => ({ req: 'REQ-MLED-01', input: 'Test account from config\\.env. Beta leads.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MLED-01', scenario: 'Lead list', id: 'MLED-001', title: 'Leads opens with the count, search, status filters and leads',
    steps: '1. More > Leads.', type: 'Smoke', design: 'Positive',
    expected: '"N leads", "Search leads", New Lead, chips All (selected) / New / Contacted / Qualified / Proposal / Won / Lost / Converted / Source, and rows with name, age or date, contact and source, and status.',
    observed: '3,00,044 leads listed.' }),
  tc({ ts: 'TS-MLED-01', scenario: 'Lead list', id: 'MLED-002', title: 'Status counts add up to all leads',
    steps: '1. Read All.\n2. Tap each status and read "N leads".\n3. Tap All again.', type: 'Functional', design: 'Validation',
    expected: 'New + Contacted + Qualified + Proposal + Won + Lost = All (between the readings before and after).', observed: '50,004 + 50,007 + 50,003 + 50,000 + 50,029 + 50,001 = 3,00,044.' }),
  tc({ ts: 'TS-MLED-01', scenario: 'Lead list', id: 'MLED-003', title: 'Each status filter shows only leads with that status',
    steps: '1. Tap New, Contacted, Qualified, Proposal, Won and Lost in turn.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only the tapped chip is selected and only leads with that status are listed.', observed: 'Only matching statuses listed.' }),
  tc({ ts: 'TS-MLED-01', scenario: 'Lead list', id: 'MLED-004', title: 'Converted shows only converted leads',
    steps: '1. Scroll the chips; tap Converted.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only converted leads are listed (or "No leads found"); the count is below All.',
    observed: 'Converted is selected but every lead is still listed (New, Won...) and the count, 3,00,047, is above All, 3,00,044 (MLED-D01).',
    defect: 'MLED-D01' }),
  tc({ ts: 'TS-MLED-01', scenario: 'Lead list', id: 'MLED-005', title: 'The Source filter lists sources and shows only leads from the chosen one',
    steps: '1. Tap Source.\n2. Choose Manual.', input: 'Source: Manual', type: 'Functional', design: 'Equivalence Partitioning',
    expected: '"Filter by Source" with Any Source (selected), Instagram bot, Instagram giveaway, Import, Manual, Referral, ai_agent, Full tour bot, Web, Campaign, Website; after Manual only Manual leads, fewer than All.',
    observed: 'Sources listed; Manual leads only.' }),
  tc({ ts: 'TS-MLED-01', scenario: 'Lead list', id: 'MLED-006', title: 'Search finds a lead by name, an unknown name finds none and Clear Filters restores the list',
    steps: '1. Search PHARMACY.\n2. Search qa_no_such_lead_zz.\n3. Tap Clear Filters.', input: 'Search: PHARMACY, then qa_no_such_lead_zz', type: 'Functional', design: 'Negative',
    expected: 'The Pharmacy chain lead is found; the unknown name shows "0 leads", "No leads found", "Try another name, number or filter."; Clear Filters restores all leads.', observed: 'Found; empty state shown; list restored.' }),
  tc({ ts: 'TS-MLED-02', scenario: 'Lead detail', id: 'MLED-007', title: 'A lead without a contact shows its status, progress, quick actions and lead info',
    steps: '1. Open the first Won lead without a contact.', type: 'Functional', design: 'Positive',
    expected: '"Status Won. Change" as on the list; Lead progress 100%; WhatsApp, Call, Convert (not tapped); "No contact linked. Edit the lead to link one."; Overview selected with Owner, Next Follow-up; LEAD INFO Priority and Lead Score; Convert Lead.',
    observed: 'Lead 202143: Won, 100%, High / Warm.' }),
  tc({ ts: 'TS-MLED-02', scenario: 'Lead detail', id: 'MLED-008', title: 'A lead with a contact shows the contact, its enquiry, activity and notes',
    steps: '1. Search Pharmacy; open "Pharmacy chain - WhatsApp CRM Enterprise, 12 users".\n2. Tap Activity, then Notes.', type: 'Functional', design: 'Positive',
    expected: 'The contact as on the list (Rahul Mehta); ENQUIRY; Activity entries with what changed, date and who; Notes with Add Note (not tapped).',
    observed: 'Contact, enquiry and 3 activity entries; no notes yet.' }),
  tc({ ts: 'TS-MLED-02', scenario: 'Lead detail', id: 'MLED-009', title: 'The actions menu offers edit, change status, find duplicates and delete',
    steps: '1. Open a lead.\n2. More actions; read it; close it.', type: 'Functional', design: 'Positive',
    expected: '"Lead Actions": Edit, Change Status, Find duplicates, Delete Lead. Nothing is chosen.', observed: 'All actions offered; menu closed.' }),
];
