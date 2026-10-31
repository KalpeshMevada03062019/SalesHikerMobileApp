import { loginPage } from '../../../src/pages/LoginPage.js';
import { homePage } from '../../../src/pages/HomePage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { account } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';

describe('Login: valid users can sign in', () => {
  requiresAccount();
  beforeEach(async () => { await launchFresh(); });

  it('MLGN-002 Sign in by pressing Enter on the keyboard', async () => {
    await loginPage.enterEmail(account.email);
    await loginPage.submitWithEnterKey(account.password);
    await homePage.waitForDisplayed(30_000);
    await checkpoint('MLGN-002 home');
  });

  it('MLGN-003 Email is not case-sensitive', async () => {
    await loginPage.signInWith(account.email.toUpperCase(), account.password);
    await homePage.waitForDisplayed(30_000);
    await checkpoint('MLGN-003 home');
  });

  it('MLGN-004 Spaces around the email are ignored', async () => {
    await loginPage.signInWith(`  ${account.email}  `, account.password);
    await homePage.waitForDisplayed(30_000);
    await checkpoint('MLGN-004 home');
  });
});
