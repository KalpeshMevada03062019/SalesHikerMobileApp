// App lifecycle helpers shared by all specs.
import { settings } from '../config/settings.js';
import { loginPage } from '../pages/LoginPage.js';
import { homePage } from '../pages/HomePage.js';

const appId = settings.appId;

/**
 * Clears app data (signed out, default theme) and starts the app on the sign-in screen.
 * Other apps' system dialogs and the ColorOS security screen are cleared out of the way;
 * the app's own ANR/crash dialog is not, so it still fails the test.
 */
export async function launchFresh(timeout = 45_000): Promise<void> {
  await driver.execute('mobile: clearApp', { appId });
  await driver.activateApp(appId);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await loginPage.isDisplayed(3_000)) return;
    await loginPage.dismissForeignSystemDialogs();
    if ((await driver.getCurrentPackage()) !== appId) await driver.activateApp(appId);
  }
  await loginPage.waitForDisplayed(1_000);
}

/**
 * Restarts the app on Home, signing in with the test account only if the session is gone.
 * Keeps app data, so suites that only read signed-in screens do not sign in before every test.
 */
export async function launchSignedIn(email: string, password: string, timeout = 45_000): Promise<void> {
  await restartApp();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await homePage.isDisplayed(3_000)) return;
    if (await loginPage.isDisplayed(0)) {
      await loginPage.signInWith(email, password);
      await homePage.waitForDisplayed(30_000);
      return;
    }
    await loginPage.dismissForeignSystemDialogs();
    if ((await driver.getCurrentPackage()) !== appId) await driver.activateApp(appId);
  }
  await homePage.waitForDisplayed(1_000);
}

/** Force-stops and relaunches the app without clearing data. */
export async function restartApp(): Promise<void> {
  await driver.terminateApp(appId);
  await driver.activateApp(appId);
}

export async function relaunchApp(): Promise<void> {
  await driver.activateApp(appId);
}

export async function currentPackage(): Promise<string> {
  return driver.getCurrentPackage();
}

/** Waits until another app (for example the browser) is in the foreground; returns its package. */
export async function waitForOtherAppInForeground(timeout = 15_000): Promise<string> {
  let pkg = appId;
  await driver.waitUntil(async () => (pkg = await driver.getCurrentPackage()) !== appId, {
    timeout, timeoutMsg: `${appId} stayed in the foreground for ${timeout} ms`,
  });
  return pkg;
}

export async function closeApp(packageName: string): Promise<void> {
  await driver.terminateApp(packageName).catch(() => undefined);
}

export async function setAirplaneMode(enabled: boolean): Promise<void> {
  await driver.execute('mobile: setConnectivity', { airplaneMode: enabled });
}
