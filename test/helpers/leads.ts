// Navigation shared by the Lead specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { leadsPage, leadDetailPage, type LeadRow } from '../../src/pages/LeadsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Leads. */
export async function openLeads(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(leadsPage.selectors.moreEntry);
  await leadsPage.waitForDisplayed(20_000);
  await leadsPage.waitForLoaded();
}

/** Opens the first listed lead that matches; skips when there is none. */
export async function openFirstLead(ctx: Mocha.Context, match: (r: LeadRow) => boolean, what: string, search?: string): Promise<LeadRow> {
  await openLeads();
  if (search) await leadsPage.search(search);
  const row = (await leadsPage.visibleRows()).find(match);
  if (!row) skipBecause(ctx, `no ${what}`);
  await leadsPage.openLead(row.label);
  await leadDetailPage.waitForDisplayed(15_000);
  return row;
}
