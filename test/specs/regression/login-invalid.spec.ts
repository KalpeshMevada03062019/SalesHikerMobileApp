// Each run makes two failed attempts against the real test account (MLGN-005, MLGN-007);
// keep it that way to stay clear of any lockout policy.
import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { homePage } from '../../../src/pages/HomePage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { account, fake, swapCase } from '../../../src/data/testData.js';
import { hasCredentials } from '../../../src/config/settings.js';

describe('Login: invalid credentials are rejected', () => {
  beforeEach(async () => { await launchFresh(); });

  it('MLGN-005 Wrong password for a registered email is rejected', async function () {
    if (!hasCredentials()) this.skip();
    await loginPage.signInWith(account.email, fake.wrongPassword);
    await loginPage.waitForMessage('wrongCredentials');
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    expect(await homePage.isDisplayed(), 'Home shown').to.equal(false);
    await checkpoint('MLGN-005 rejected');
  });

  it('MLGN-006 Unregistered email is rejected with the same generic message', async () => {
    await loginPage.signInWith(fake.unknownEmail, fake.wrongPassword);
    await loginPage.waitForMessage('wrongCredentials');
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-006 rejected');
  });

  it('MLGN-007 Password is case-sensitive', async function () {
    if (!hasCredentials()) this.skip();
    const swapped = swapCase(account.password);
    expect(swapped, 'test password needs letters for this case').to.not.equal(account.password);
    await loginPage.signInWith(account.email, swapped);
    await loginPage.waitForMessage('wrongCredentials');
    expect(await homePage.isDisplayed(), 'Home shown').to.equal(false);
    await checkpoint('MLGN-007 rejected');
  });
});
