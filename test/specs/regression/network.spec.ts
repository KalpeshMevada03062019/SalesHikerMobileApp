import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { launchFresh, setAirplaneMode } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { account } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';

describe('Login: network problems are reported clearly', () => {
  requiresAccount();
  // Always restore the network, even when the test fails.
  afterEach(async () => { await setAirplaneMode(false); });

  it('MLGN-024 Sign in without network shows a connection error', async () => {
    await launchFresh();
    await setAirplaneMode(true);
    await loginPage.signInWith(account.email, account.password);
    await loginPage.waitForMessage('noConnection', 30_000);
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-024 no connection');
  });
});
