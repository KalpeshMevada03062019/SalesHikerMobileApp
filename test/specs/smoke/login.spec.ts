import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { homePage } from '../../../src/pages/HomePage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { account } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';

describe('Smoke: sign in', () => {
  requiresAccount();

  it('MLGN-001 Sign in with valid credentials', async () => {
    await launchFresh();
    await loginPage.signInWith(account.email, account.password);
    await homePage.waitForDisplayed(30_000);
    expect(await homePage.isDisplayed(), 'Home ("Today") dashboard').to.equal(true);
    expect(await loginPage.isDisplayed(), 'sign-in screen still shown').to.equal(false);
    await checkpoint('MLGN-001 home after sign-in');
  });
});
