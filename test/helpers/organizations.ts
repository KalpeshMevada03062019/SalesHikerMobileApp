// Navigation shared by the Organization specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { organizationsPage, organizationDetailPage, type OrgRow } from '../../src/pages/OrganizationsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account, organizationData } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Organizations. */
export async function openOrganizations(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(organizationsPage.selectors.moreEntry);
  await organizationsPage.waitForDisplayed(20_000);
  await organizationsPage.waitForLoaded();
}

/** Finds the reference organization by search and opens it; skips when the account does not have it. */
export async function openReferenceOrganization(ctx: Mocha.Context): Promise<OrgRow> {
  await openOrganizations();
  await organizationsPage.search(organizationData.search);
  const row = (await organizationsPage.visibleRows()).find((r) => r.name === organizationData.name);
  if (!row) skipBecause(ctx, `organization "${organizationData.name}" not found`);
  await organizationsPage.openOrganization(row.name);
  await organizationDetailPage.waitForDisplayed(15_000);
  return row;
}
