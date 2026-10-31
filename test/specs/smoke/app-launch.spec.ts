import { expect } from 'chai';
import { loginPage } from '../../../src/pages/LoginPage.js';
import { themeToggle } from '../../../src/pages/ScanCodePage.js';
import { launchFresh } from '../../../src/utils/app.js';
import { checkpoint } from '../../../src/utils/evidence.js';

describe('Smoke: app launch', () => {
  it('MLGN-016 Sign-in screen shows all expected elements', async () => {
    await launchFresh();
    const controls = await loginPage.visibleControls();
    const missing = Object.entries(controls).filter(([, shown]) => !shown).map(([name]) => name);
    expect(missing, 'controls missing from the sign-in screen').to.deep.equal([]);
    expect(await themeToggle.isLightActive(), '"Switch to dark mode" toggle shown').to.equal(true);
    await checkpoint('MLGN-016 sign-in screen');
  });
});
