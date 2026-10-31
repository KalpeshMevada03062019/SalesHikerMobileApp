import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { scanCodePage, themeToggle } from '../../../src/pages/ScanCodePage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';

describe('Navigation before sign-in', () => {
  beforeEach(async () => { await launchFresh(); });

  it('REG-NAV-01 Scan-a-code screen opens and Back returns to sign-in', async () => {
    await loginPage.openScanCode();
    await scanCodePage.waitForDisplayed(10_000);
    expect(await scanCodePage.hasInstructions(), 'link-a-phone instructions').to.equal(true);
    await checkpoint('REG-NAV-01 scan screen');
    await scanCodePage.goBack();
    await loginPage.waitForDisplayed(10_000);
  });

  it('REG-NAV-02 Theme toggle switches between dark and light', async () => {
    await themeToggle.switchToDark();
    expect(await themeToggle.isDarkActive(), 'dark theme active').to.equal(true);
    await checkpoint('REG-NAV-02 dark');
    await themeToggle.switchToLight();
    expect(await themeToggle.isLightActive(), 'light theme active').to.equal(true);
  });
});
