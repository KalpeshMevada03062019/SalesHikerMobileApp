// Navigation shared by the AI Agent specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { aiAgentsPage, aiAgentDetailPage, type AgentRow } from '../../src/pages/AiAgentsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > AI Agents. */
export async function openAiAgents(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await $(aiAgentsPage.selectors.moreEntry).click();
  await aiAgentsPage.waitForDisplayed(20_000);
  await aiAgentsPage.waitForLoaded();
}

/** Opens AI Agents, filters by a status and opens the first agent listed; skips when there is none. */
export async function openFirstAgent(ctx: Mocha.Context, status: 'Live' | 'Draft'): Promise<AgentRow> {
  await openAiAgents();
  await aiAgentsPage.selectFilter(status);
  const row = (await aiAgentsPage.visibleRows()).find((r) => r.status === status);
  if (!row) skipBecause(ctx, `no ${status} AI agent`);
  await aiAgentsPage.openAgent(row.name);
  await aiAgentDetailPage.waitForDisplayed(15_000);
  return row;
}
