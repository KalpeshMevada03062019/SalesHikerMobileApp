import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { fake } from '../../../src/data/testData.js';

describe('Login: the form validates input before sign-in', () => {
  beforeEach(async () => { await launchFresh(); });

  it('MLGN-008 Empty form cannot be submitted', async () => {
    await loginPage.submit();
    await loginPage.waitForMessage('emailRequired', 5_000);
    expect(await loginPage.isMessageShown('passwordRequired'), '"Enter your password"').to.equal(true);
    expect(await loginPage.isSubmitting(), '"Signing in..." state').to.equal(false);
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-008 required');
  });

  it('MLGN-009 Email is required', async () => {
    await loginPage.enterPassword(fake.wrongPassword);
    await loginPage.submit();
    await loginPage.waitForMessage('emailRequired', 5_000);
    expect(await loginPage.isMessageShown('passwordRequired'), '"Enter your password"').to.equal(false);
    await checkpoint('MLGN-009 email required');
  });

  it('MLGN-010 Password is required', async () => {
    await loginPage.enterEmail(fake.wellFormedEmail);
    await loginPage.submit();
    await loginPage.waitForMessage('passwordRequired', 5_000);
    expect(await loginPage.isMessageShown('emailRequired'), '"Enter your email"').to.equal(false);
    await checkpoint('MLGN-010 password required');
  });

  it('MLGN-011 Malformed email shows an inline format error', async () => {
    await loginPage.signInWith(fake.malformedEmail, fake.password);
    await loginPage.waitForMessage('emailMalformed', 5_000);
    expect(await loginPage.isDisplayed(), 'still on sign-in').to.equal(true);
    await checkpoint('MLGN-011 inline error');
  });

  // Guards defect MLGN-D01. Expected to FAIL on build 1.0.0: the form is submitted although the
  // client already flagged the email. Do not relax this assertion; close the defect when fixed.
  it('MLGN-012 Malformed email is not sent to the server', async () => {
    await loginPage.signInWith(fake.malformedEmail, fake.password);
    await loginPage.waitForMessage('emailMalformed', 5_000);
    const serverAnswered = await loginPage.messageAppearsWithin('serverInvalidEmail', 10_000);
    await checkpoint('MLGN-012 after 10 s');
    expect(serverAnswered, 'server banner "Invalid email" (the malformed email was submitted)').to.equal(false);
  });

  it('MLGN-014 Whitespace-only password is treated as empty', async () => {
    await loginPage.signInWith(fake.wellFormedEmail, fake.whitespacePassword);
    await loginPage.waitForMessage('passwordRequired', 5_000);
    expect(await loginPage.isMessageShown('wrongCredentials'), 'sign-in attempted').to.equal(false);
    await checkpoint('MLGN-014 password required');
  });
});
