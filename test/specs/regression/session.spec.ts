import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { homePage } from '../../../src/pages/HomePage.js';
import { morePage } from '../../../src/pages/MorePage.js';
import { launchFresh, restartApp, relaunchApp, currentPackage } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { account } from '../../../src/data/testData.js';
import { settings } from '../../../src/config/settings.js';
import { requiresAccount } from '../../helpers/hooks.js';

describe('Session: stays active until the user signs out', () => {
  requiresAccount();
  beforeEach(async () => {
    await launchFresh();
    await loginPage.signInWith(account.email, account.password);
    await homePage.waitForDisplayed(30_000);
  });

  it('MLGN-020 Session stays active after the app is restarted', async () => {
    await restartApp();
    await homePage.waitForDisplayed(30_000);
    expect(await loginPage.isDisplayed(), 'asked to sign in again').to.equal(false);
    await checkpoint('MLGN-020 home after restart');
  });

  it('MLGN-021 Back on Home leaves the app without signing out', async () => {
    await driver.back();
    await driver.waitUntil(async () => (await currentPackage()) !== settings.appId, { timeout: 10_000, timeoutMsg: 'Back did not leave the app' });
    await relaunchApp();
    await homePage.waitForDisplayed(30_000);
    await checkpoint('MLGN-021 home after relaunch');
  });

  it('MLGN-022 Sign out asks for confirmation and Cancel keeps the session', async () => {
    await homePage.openMore();
    await morePage.waitForDisplayed();
    await morePage.openSignOutDialog();
    expect(await morePage.isDialogMessageShown(), 'dialog message').to.equal(true);
    await checkpoint('MLGN-022 confirmation');
    await morePage.cancelSignOut();
    expect(await morePage.isDialogShown(), 'dialog still open').to.equal(false);
    expect(await morePage.isSignOutListed(), 'still on More').to.equal(true);
    expect(await loginPage.isDisplayed(), 'signed out').to.equal(false);
  });

  it('MLGN-023 Sign out returns to sign-in and the session is not restored', async () => {
    await homePage.openMore();
    await morePage.waitForDisplayed();
    await morePage.openSignOutDialog();
    await morePage.confirmSignOut();
    await loginPage.waitForDisplayed(20_000);
    await restartApp();
    await loginPage.waitForDisplayed(30_000);
    expect(await homePage.isDisplayed(), 'Home reachable after sign-out').to.equal(false);
    await checkpoint('MLGN-023 signed out after relaunch');
  });
});
