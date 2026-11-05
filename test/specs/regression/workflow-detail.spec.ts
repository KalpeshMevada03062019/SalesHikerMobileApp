// Workflow detail and runs, read only: an Active and a Draft workflow, the actions menu (opened and closed)
// and a run's steps. Switches, Edit flow on web, Run now, Rename, Duplicate and Delete are never used.
import { expect } from 'chai';
import { workflowDetailPage, workflowRunPage, WORKFLOW_ACTIONS, WORKFLOW_TEXTS } from '../../../src/pages/WorkflowsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openFirstWorkflow } from '../../helpers/workflows.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Workflows: detail and runs (nothing is changed)', () => {
  requiresAccount();

  it('MWFL-005 An active workflow shows its run stats, trigger, steps and runs', async function () {
    const row = await openFirstWorkflow(this, 'Active');
    const s = workflowDetailPage.selectors;
    expect(await workflowDetailPage.isTitled(row.name), 'title').to.equal(true);
    expect(await workflowDetailPage.text(s.status), 'status').to.equal('Active');
    expect(await workflowDetailPage.switchLabel(), 'switch').to.equal(WORKFLOW_TEXTS.liveSwitch);
    const runs = await workflowDetailPage.metric('Runs');
    const done = (await workflowDetailPage.metric('Completed')) + (await workflowDetailPage.metric('Failed'));
    expect(done, `Completed + Failed (Runs ${runs})`).to.be.at.most(runs);
    expect(await workflowDetailPage.text(s.trigger), 'TRIGGER').to.equal(row.trigger);
    const steps = Number(await workflowDetailPage.text(s.stepsCount));
    expect(steps, 'STEPS count').to.be.greaterThan(0);
    expect(await workflowDetailPage.text(s.triggerSummary), 'trigger summary').to.match(new RegExp(`\\. ${steps} steps?\\.$`));
    expect(await $(s.step(steps)).isExisting(), `step "${steps}. ..."`).to.equal(true);
    expect(await $(s.editOnWeb).isExisting(), 'Edit flow on web (not tapped)').to.equal(true);
    await checkpoint('MWFL-005 active');
    if (runs > 0) expect(Number(await workflowDetailPage.text(s.runsCount)), 'RUNS count').to.equal(runs);
  });

  it('MWFL-006 The failed runs on the list match the workflow detail', async function () {
    const row = await openFirstWorkflow(this, 'Active', (r) => /^\d+ failed runs?$/.test(r.runs), 'Active workflow with failed runs');
    const failed = await workflowDetailPage.metric('Failed');
    await checkpoint('MWFL-006 failed runs');
    expect(failed, `list says "${row.runs}"`).to.equal(Number(row.runs.match(/^\d+/)![0]));
  });

  it('MWFL-007 A draft workflow without runs asks to connect the trigger on the web', async function () {
    await openFirstWorkflow(this, 'Draft', (r) => r.runs === WORKFLOW_TEXTS.noRuns, 'Draft workflow without runs');
    const s = workflowDetailPage.selectors;
    expect(await workflowDetailPage.text(s.status), 'status').to.equal('Draft');
    expect(await workflowDetailPage.switchLabel(), 'switch').to.equal(`Workflow off. ${WORKFLOW_TEXTS.connectHint}`);
    expect(await $(s.connectHint).isExisting(), `"${WORKFLOW_TEXTS.connectHint}"`).to.equal(true);
    expect(await workflowDetailPage.metric('Runs'), 'Runs').to.equal(0);
    expect(await $(s.noRuns).isExisting(), `"${WORKFLOW_TEXTS.noRunsDetail}"`).to.equal(true);
    await checkpoint('MWFL-007 draft');
  });

  it('MWFL-008 The actions menu offers run now, rename, duplicate and delete', async function () {
    await openFirstWorkflow(this, 'Draft');
    expect(await workflowDetailPage.actionOptions(), 'Workflow actions').to.deep.equal([...WORKFLOW_ACTIONS]);   // closed without choosing
  });

  it('MWFL-009 A run shows its status, time, steps and run details', async function () {
    await openFirstWorkflow(this, 'Active', (r) => !r.runs.startsWith('No runs'), 'Active workflow with runs');
    const steps = Number(await workflowDetailPage.text(workflowDetailPage.selectors.stepsCount));
    const run = await workflowDetailPage.firstRun();
    if (!run) skipBecause(this, 'no run listed');
    await workflowDetailPage.openFirstRun();
    await workflowRunPage.waitForDisplayed(15_000);
    const s = workflowRunPage.selectors;
    expect(await workflowRunPage.text(s.status), 'status').to.equal(run.status);
    expect(await workflowRunPage.text(s.ran), '"Ran <date>"').to.match(new RegExp(`^Ran ${run.date}\\.`));
    const ran = await workflowRunPage.steps();
    expect(ran.length, 'run steps').to.be.greaterThan(0);
    expect(await workflowRunPage.text(s.detail('Started')), 'Started').to.equal(run.date);
    await checkpoint('MWFL-009 run');
    if (run.status === 'Failed') {
      expect(await workflowRunPage.text(s.stoppedAt), '"Stopped at step N of <steps>"').to.equal(`Stopped at step ${ran.length} of ${steps}`);
      expect(ran[ran.length - 1], 'last run step').to.match(/, Failed$/);
      expect(await $(s.fixOnWeb).isExisting(), `"${WORKFLOW_TEXTS.fixOnWeb}"`).to.equal(true);
    }
  });
});
