// Navigation shared by the Workflow specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { workflowsPage, workflowDetailPage, type WorkflowRow } from '../../src/pages/WorkflowsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Workflows (below the fold). */
export async function openWorkflows(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(workflowsPage.selectors.moreEntry);
  await workflowsPage.waitForDisplayed(20_000);
  await workflowsPage.waitForLoaded();
}

/** Opens Workflows, filters by status and opens the first row that matches; skips when there is none. */
export async function openFirstWorkflow(ctx: Mocha.Context, status: 'Active' | 'Draft', match: (r: WorkflowRow) => boolean = () => true, what = `${status} workflow`): Promise<WorkflowRow> {
  await openWorkflows();
  await workflowsPage.selectFilter(status);
  const row = (await workflowsPage.visibleRows()).find((r) => r.status === status && match(r));
  if (!row) skipBecause(ctx, `no ${what}`);
  await workflowsPage.openWorkflow(row.label);
  await workflowDetailPage.waitForDisplayed(15_000);
  return row;
}
