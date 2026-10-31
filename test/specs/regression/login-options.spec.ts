import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { launchFresh, waitForOtherAppInForeground, closeApp } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { fake } from '../../../src/data/testData.js';

describe('Login: sign-in screen offers the expected options', () => {
  let opened: string | undefined;
  beforeEach(async () => { opened = undefined; await launchFresh(); });
  afterEach(async () => { if (opened) await closeApp(opened); });

  it('MLGN-017 Password is masked and can be shown and hidden', async () => {
    await loginPage.enterPassword(fake.password);
    expect(await loginPage.isTextVisible(fake.password), 'password readable before "Show"').to.equal(false);
    await loginPage.togglePasswordVisibility();
    expect(await loginPage.isTextVisible(fake.password), 'password readable after "Show"').to.equal(true);
    expect(await loginPage.isPasswordToggleLabelled('Hide password'), 'label "Hide password"').to.equal(true);
    await checkpoint('MLGN-017 shown');
    await loginPage.togglePasswordVisibility();
    expect(await loginPage.isTextVisible(fake.password), 'password readable after "Hide"').to.equal(false);
    expect(await loginPage.isPasswordToggleLabelled('Show password'), 'label "Show password"').to.equal(true);
  });

  // Opens https://accountsbeta.saleshiker.com/... in the device browser.
  it('MLGN-018 Forgot password opens the reset page in the browser', async () => {
    await loginPage.openForgotPassword();
    opened = await waitForOtherAppInForeground();
    await checkpoint('MLGN-018 hand-off');
  });

  it('MLGN-019 Create your workspace opens sign-up in the browser', async () => {
    await loginPage.openCreateWorkspace();
    opened = await waitForOtherAppInForeground();
    await checkpoint('MLGN-019 hand-off');
  });
});
