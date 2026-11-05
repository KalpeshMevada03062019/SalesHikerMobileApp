// Mobile Workflows test cases (More > CRM > Workflows), SalesHiker Android 1.0.0. Expected results come from
// the live app on the Realme RMX3997 (2026-11-03). Read only: no workflow is created, switched, run, renamed,
// duplicated or deleted, and Edit flow on web is not opened.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Workflows open.';
const tc = (fields) => ({ req: 'REQ-MWFL-01', input: 'Test account from config\\.env. Live beta workflows.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MWFL-01', scenario: 'Workflow list', id: 'MWFL-001', title: 'Workflows opens with the count, search, status filters and workflows',
    steps: '1. More > Workflows.', type: 'Smoke', design: 'Positive',
    expected: '"N workflows", New workflow, "Search workflows", filters All / Active / Draft with counts ("All" = N), and rows with name, status, trigger and runs ("No runs yet", "Last run <date>", "N failed runs").',
    observed: 'List shown with counts, filters and rows.' }),
  tc({ ts: 'TS-MWFL-01', scenario: 'Workflow list', id: 'MWFL-002', title: 'Status counts add up to the total',
    steps: '1. Read every filter count.', type: 'Functional', design: 'Validation',
    expected: 'Active + Draft = All.', observed: '2 + 25 = 27.' }),
  tc({ ts: 'TS-MWFL-01', scenario: 'Workflow list', id: 'MWFL-003', title: 'Active and Draft filters show only workflows with that status',
    steps: '1. Tap Active.\n2. Tap Draft.', type: 'Functional', design: 'Equivalence Partitioning',
    expected: 'Only workflows with that status are listed; "N workflows" equals the chip count.', observed: 'Only matching statuses listed.' }),
  tc({ ts: 'TS-MWFL-01', scenario: 'Workflow list', id: 'MWFL-004', title: 'Search is case-insensitive, an unknown name finds none and Clear Search restores the list',
    steps: '1. Search a word of a listed workflow in upper case.\n2. Search qa_no_such_workflow_zz.\n3. Tap Clear Search.', input: 'Search: a word from a listed name (upper case), then qa_no_such_workflow_zz',
    type: 'Functional', design: 'Negative', expected: 'The workflow is found; the unknown name shows "0 workflows", chips at 0, "No workflows found" and "No workflow matches this search or filter."; Clear Search restores all workflows.',
    observed: 'Found; empty state shown; list restored.' }),
  tc({ ts: 'TS-MWFL-02', scenario: 'Workflow detail', id: 'MWFL-005', title: 'An active workflow shows its run stats, trigger, steps and runs',
    steps: '1. Filter Active, open the first workflow.', type: 'Functional', design: 'Positive',
    expected: 'Status Active, switch "Workflow on. Pause" (not tapped); Runs / Completed / Failed with Completed + Failed <= Runs; TRIGGER as on the list with "<module>. N steps."; STEPS N with steps 1..N; Edit flow on web (not tapped); RUNS count = Runs.',
    observed: 'test: Runs 6, Completed 6, Failed 0; Message received; 3 steps.' }),
  tc({ ts: 'TS-MWFL-02', scenario: 'Workflow detail', id: 'MWFL-006', title: 'The failed runs on the list match the workflow detail',
    steps: '1. Filter Active; open the first workflow whose row says "N failed runs".', type: 'Functional', design: 'Validation',
    expected: 'The detail shows Failed N.', observed: 'Lead Creation: list "60 failed runs", detail Failed 60 (Runs 63, Completed 2).' }),
  tc({ ts: 'TS-MWFL-02', scenario: 'Workflow detail', id: 'MWFL-007', title: 'A draft workflow without runs asks to connect the trigger on the web',
    steps: '1. Filter Draft; open the first workflow with "No runs yet".', type: 'Functional', design: 'Positive',
    expected: 'Status Draft; switch "Workflow off. Connect the trigger to an action on the web to activate."; Runs 0; "No runs yet. They show here once the trigger fires."',
    observed: 'Draft with the connect hint and no runs.' }),
  tc({ ts: 'TS-MWFL-02', scenario: 'Workflow detail', id: 'MWFL-008', title: 'The actions menu offers run now, rename, duplicate and delete',
    steps: '1. Open a draft workflow.\n2. Open Workflow actions, read it, close it.', type: 'Functional', design: 'Positive',
    expected: 'Run now, Rename, Duplicate ("The copy starts as a draft"), Delete. Nothing is chosen.', observed: 'All actions offered; menu closed.' }),
  tc({ ts: 'TS-MWFL-03', scenario: 'Workflow runs', id: 'MWFL-009', title: 'A run shows its status, time, steps and run details',
    steps: '1. Open the first active workflow with runs.\n2. Tap its newest run.', type: 'Functional', design: 'Positive',
    expected: 'The run status and "Ran <date>" as on the run row; the steps it went through; Started = the run date. A failed run says "Stopped at step N of <steps>", ends on a Failed step and "Fix the step on the web app."',
    observed: 'Run shown with its steps and details.' }),
];
