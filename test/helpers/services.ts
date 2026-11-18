// Navigation shared by the Service specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { servicesPage, serviceDetailPage, type ServiceRow } from '../../src/pages/ServicesPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Services. */
export async function openServices(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(servicesPage.selectors.moreEntry);
  await servicesPage.waitForDisplayed(20_000);
  await servicesPage.waitForLoaded();
}

/** Searches a service by number and opens the one with that name; skips when it is not found. */
export async function openService(ctx: Mocha.Context, number: string, name: string): Promise<ServiceRow> {
  await openServices();
  await servicesPage.search(number);
  const row = (await servicesPage.serviceRows()).find((r) => r.name === name);
  if (!row) skipBecause(ctx, `no service ${name}`);
  await servicesPage.open(row.label);
  await serviceDetailPage.waitForDisplayed(60_000);
  return row;
}
