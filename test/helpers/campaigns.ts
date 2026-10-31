// Navigation shared by the Campaign specs.
import allure from '@wdio/allure-reporter';
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { campaignsPage } from '../../src/pages/CampaignsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

/** Restarts the app signed in and opens More > Campaigns (a fresh list: no search, "All" selected). */
export async function openCampaignList(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openCampaigns();
  await campaignsPage.waitForDisplayed(20_000);
  await campaignsPage.waitForLoaded();
}

/** Skips a data-dependent test (SKIPPED, not FAILED) and records why in the console and Allure. */
export function skipBecause(ctx: Mocha.Context, reason: string): never {
  console.warn(`[skipped] ${ctx.test?.title}: ${reason}`);
  allure.addDescription(`Skipped: ${reason}`, 'text');
  ctx.skip();
}
