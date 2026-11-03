// Navigation shared by the Templates specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { templatesPage, newTemplatePage } from '../../src/pages/TemplatesPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';

/** Restarts the app signed in and opens More > Templates. */
export async function openTemplates(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await $(templatesPage.selectors.moreEntry).click();
  await templatesPage.waitForDisplayed(20_000);
  await templatesPage.waitForLoaded();
}

/** afterEach safety net: never leave the New template form open (it is discarded, never saved). */
export async function discardNewTemplateIfOpen(): Promise<void> {
  if (await $(newTemplatePage.selectors.cancel).isExisting().catch(() => false) && await newTemplatePage.isDisplayed(0).catch(() => false)) {
    await newTemplatePage.cancelAndDiscard().catch(() => undefined);
  }
}
