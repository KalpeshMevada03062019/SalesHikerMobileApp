import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { homePage } from '../../../src/pages/HomePage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { fake } from '../../../src/data/testData.js';

describe('Login: unusual input is handled safely', () => {
  beforeEach(async () => { await launchFresh(); });

  it('MLGN-013 SQL-injection style input does not sign in', async () => {
    await loginPage.signInWith(fake.injection, fake.injection);
    await loginPage.waitForMessage('emailMalformed', 5_000);
    await driver.pause(5_000);   // give a (wrong) sign-in time to happen before checking it did not
    expect(await homePage.isDisplayed(), 'Home shown').to.equal(false);
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-013 rejected');
  });

  // No client-side length check exists (observation MLGN-D02); the server rejects it.
  it('MLGN-015 Over-long email is rejected without a crash', async () => {
    await loginPage.signInWith(fake.overlongEmail, fake.password);
    await loginPage.waitForMessage('wrongCredentials');
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-015 rejected');
  });
});
