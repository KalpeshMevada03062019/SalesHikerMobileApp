// Mobile Pipeline test cases (Deals tab), SalesHiker Android 1.0.0, live app on the Realme RMX3997 on
// 2026-11-02, with the web Deals board (Deals > board view) as the reference. Only the QA deal DL-100005
// is ever changed, and it is always put back to Qualification. No personal data here.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; Deals tab ("Pipeline") open.';
const DEAL_PRE = 'Registered beta test account (config\\.env).\nQA deal DL-100005 "QA-TEST-MGR Deal" exists in Qualification.\nThe deal is opened via search; its number and name are checked first.';
const tc = (fields) => ({ req: 'REQ-MPIP-01', input: 'Test account from config\\.env. Live beta deals.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MPIP-01', scenario: 'Pipeline overview matches the web', id: 'MPIP-001', title: 'Pipeline opens with all stages and their counts add up to the total',
    steps: '1. Open the Deals tab.\n2. Read "N deals" and every stage card (swipe the strip).', type: 'Smoke', design: 'Positive',
    expected: 'Stages Qualification, Needs Analysis, Value Proposal, Proposal, Negotiation, Won, Lost, each with a count and amount; the counts add up to "N deals". (Web check 2026-11-02: 100,007 deals in both; Qualification 14,288 in both, same first deals in the same order.)',
    observed: 'Seven stages; counts add up to the total.' }),
  tc({ ts: 'TS-MPIP-01', scenario: 'Pipeline overview matches the web', id: 'MPIP-002', title: 'Stage names match the web pipeline (shortened at most)',
    steps: '1. Read the stage names in the strip.\n2. Compare with the web board columns.', type: 'Functional', design: 'Validation',
    expected: 'Same stages in the same order as the web; a mobile name may shorten the web name (e.g. "Proposal" for "Proposal / Price Quote") but not use a different word.',
    observed: 'Stage names match the web.', defect: 'MPIP-D02' }),
  tc({ ts: 'TS-MPIP-02', scenario: 'Stage filter and progress', id: 'MPIP-003', title: 'Selecting a stage marks it and lists only its deals with that stage progress',
    steps: '1. Tap each stage card from Qualification to Won.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'The tapped card is marked selected and the list shows that stage heading; deal progress is 17 / 33 / 50 / 67 / 83 / 100% from Qualification to Won.',
    observed: 'Each stage selected with the expected progress.' }),
  tc({ ts: 'TS-MPIP-02', scenario: 'Stage filter and progress', id: 'MPIP-004', title: 'Lost deals do not show a full progress bar',
    steps: '1. Tap the Lost stage.\n2. Read the deals\' progress bars.', type: 'Functional', design: 'Validation',
    expected: 'A lost deal does not show 100% progress (that reads as won); its own detail says Probability 0%.',
    observed: 'Lost deals show no full progress.', defect: 'MPIP-D03' }),
  tc({ ts: 'TS-MPIP-03', scenario: 'Search and Mine', id: 'MPIP-005', title: 'Search by deal number finds that deal and an unknown text finds none',
    steps: '1. Search DL-100005.\n2. Search qa-no-such-deal-zz.', input: 'Search: DL-100005, then qa-no-such-deal-zz', type: 'Functional', design: 'Negative',
    expected: 'The number finds "QA-TEST-MGR Deal"; the unknown text shows "0 deals", all stage counts 0 and "No deals match".', observed: 'Deal found; empty state shown.' }),
  tc({ ts: 'TS-MPIP-03', scenario: 'Search and Mine', id: 'MPIP-006', title: 'Mine lists the deals assigned to the signed-in user',
    steps: '1. Search DL-100002 (assigned to the signed-in user on the web).\n2. Tap Mine.', input: 'Search: DL-100002', type: 'Functional', design: 'Positive',
    expected: 'Mine lists DL-100002 and only deals owned by the signed-in user.', observed: 'Assigned deal listed under Mine.' }),
  tc({ ts: 'TS-MPIP-04', scenario: 'Deal detail', id: 'MPIP-007', title: 'Deal detail shows the card details, stage and progress', pre: DEAL_PRE,
    steps: '1. Open DL-100005.', type: 'Functional', design: 'Positive',
    expected: 'Stage Qualification, "Stage 1 of 5 · Qualification", progress 17%, Mark Won and Mark Lost buttons. (Web: same deal, stage and empty amount, contact, organization.)',
    observed: 'Detail shown as expected.' }),
  tc({ ts: 'TS-MPIP-04', scenario: 'Deal detail', id: 'MPIP-008', title: 'Move Stage lists every stage with the current one marked', pre: DEAL_PRE,
    steps: '1. Tap Change Stage.\n2. Close the sheet.', type: 'Functional', design: 'Positive',
    expected: 'Move Stage lists all seven stages, "Qualification (Current)" first; closing changes nothing.', observed: 'All stages listed; nothing changed.' }),
  tc({ ts: 'TS-MPIP-04', scenario: 'Deal detail', id: 'MPIP-009', title: 'Edit Deal rejects an empty name and a probability over 100, and Cancel discards', pre: DEAL_PRE,
    steps: '1. Tap the amount (opens Edit Deal).\n2. Clear the name, set probability 150, tap Save.\n3. Tap Cancel > Discard.', input: 'Name: empty; Probability: 150', type: 'Functional', design: 'Validation',
    expected: '"Enter a deal name." and "Enter a whole number from 0 to 100."; nothing saved. Cancel asks "Discard changes? Your changes to this deal are not saved."; after Discard the deal is unchanged.',
    observed: 'Both errors shown; discard prompt; deal unchanged.' }),
  tc({ ts: 'TS-MPIP-05', scenario: 'Move the QA deal through the pipeline', id: 'MPIP-020', title: 'Moving a deal to the next stage updates it and is kept after a restart', pre: DEAL_PRE,
    steps: '1. Change Stage > Needs Analysis.\n2. Restart the app, search DL-100005.\n(After: back to Qualification.)', type: 'Regression', design: 'Positive',
    expected: '"Stage 2 of 5 · Needs Analysis", progress 33%; after a restart the deal is listed under NEEDS ANALYSIS. (Web check: the web shows the new stage after up to about a minute.)',
    observed: 'Stage changed and kept after restart.' }),
  tc({ ts: 'TS-MPIP-05', scenario: 'Move the QA deal through the pipeline', id: 'MPIP-021', title: 'Mark Won closes the deal and Change Stage reopens it', pre: DEAL_PRE,
    steps: '1. Tap Mark Won.\n2. Change Stage > Qualification.', type: 'Regression', design: 'Positive',
    expected: 'Stage Won, progress 100%, Mark Won / Mark Lost hidden; after moving back to Qualification they are shown again.', observed: 'Won, then reopened.' }),
  tc({ ts: 'TS-MPIP-05', scenario: 'Move the QA deal through the pipeline', id: 'MPIP-022', title: 'Mark Lost closes the deal with 0% probability', pre: DEAL_PRE,
    steps: '1. Tap Mark Lost.\n(After: back to Qualification.)', type: 'Regression', design: 'Positive',
    expected: 'Stage Lost, Probability 0%, Mark Won / Mark Lost hidden.', observed: 'Lost with 0% probability.' }),
];
