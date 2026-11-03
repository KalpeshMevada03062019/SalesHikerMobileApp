import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { launchFresh, goOffline, restoreConnectivity, type Connectivity } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { account } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';

describe('Login: network problems are reported clearly', () => {
  requiresAccount();
  let saved: Connectivity | null = null;
  // Always restore Wi-Fi, mobile data and airplane mode, even when the test fails.
  afterEach(async () => {
    if (saved) await restoreConnectivity(saved);
    saved = null;
  });

  it('MLGN-024 Sign in without network shows a connection error', async () => {
    await launchFresh();
    saved = await goOffline();
    await loginPage.signInWith(account.email, account.password);
    await loginPage.waitForMessage('noConnection', 30_000);
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-024 no connection');
  });
});
