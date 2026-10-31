// Base class for all screens. Holds the shared waits and interactions so page classes only
// declare selectors and screen-specific behaviour.
import type { ChainablePromiseElement } from 'webdriverio';

export const DEFAULT_TIMEOUT = 15_000;

/** UiAutomator selector helpers. Values come from the live app's page source (see page classes). */
export const by = {
  /** content-desc (React Native accessibilityLabel). */
  a11y: (label: string) => `~${label}`,
  text: (text: string) => `android=new UiSelector().text(${JSON.stringify(text)})`,
  textMatches: (regex: string) => `android=new UiSelector().textMatches(${JSON.stringify(regex)})`,
  descClass: (label: string, className: string) =>
    `android=new UiSelector().description(${JSON.stringify(label)}).className(${JSON.stringify(className)})`,
  descStartsWith: (prefix: string) => `android=new UiSelector().descriptionStartsWith(${JSON.stringify(prefix)})`,
  textStartsWith: (prefix: string) => `android=new UiSelector().textStartsWith(${JSON.stringify(prefix)})`,
};

export abstract class BasePage {
  /** Selector that is present only on this screen; used to detect it. */
  protected abstract readonly marker: string;

  protected el(selector: string): ChainablePromiseElement {
    return $(selector);
  }

  async isDisplayed(timeout = 0): Promise<boolean> {
    if (timeout === 0) return this.el(this.marker).isDisplayed();
    try {
      await this.el(this.marker).waitForDisplayed({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  async waitForDisplayed(timeout = DEFAULT_TIMEOUT): Promise<this> {
    await this.el(this.marker).waitForDisplayed({ timeout, timeoutMsg: `${this.constructor.name} not shown within ${timeout} ms` });
    return this;
  }

  protected async tap(selector: string, timeout = DEFAULT_TIMEOUT): Promise<void> {
    const element = this.el(selector);
    await element.waitForDisplayed({ timeout, timeoutMsg: `Element ${selector} not shown within ${timeout} ms` });
    await element.click();
  }

  /** Types into a field, then hides the keyboard only if it is open (a bare BACK can leave the app). */
  protected async type(selector: string, value: string): Promise<void> {
    const element = this.el(selector);
    await element.waitForDisplayed({ timeout: DEFAULT_TIMEOUT });
    await element.click();
    await element.setValue(value);
    await this.hideKeyboard();
  }

  async hideKeyboard(): Promise<void> {
    if (await driver.isKeyboardShown()) await driver.hideKeyboard();
  }

  protected async isVisible(selector: string): Promise<boolean> {
    return this.el(selector).isDisplayed();
  }

  protected async waitForVisible(selector: string, timeout = DEFAULT_TIMEOUT, what = selector): Promise<void> {
    await this.el(selector).waitForDisplayed({ timeout, timeoutMsg: `${what} not shown within ${timeout} ms` });
  }

  protected async waitForGone(selector: string, timeout = DEFAULT_TIMEOUT, what = selector): Promise<void> {
    await this.el(selector).waitForDisplayed({ timeout, reverse: true, timeoutMsg: `${what} still shown after ${timeout} ms` });
  }

  /**
   * Other apps can raise system dialogs over the app on a loaded emulator ("Pixel Launcher isn't
   * responding", "Google keeps stopping"). Dismiss those. The app's own ANR/crash dialog is never
   * dismissed, so it still fails the test.
   */
  async dismissForeignSystemDialogs(appLabel = 'Saleshiker'): Promise<boolean> {
    const dialogTitle = this.el(by.textMatches(`(?!${appLabel}).* (isn.t responding|keeps stopping)`));
    if (!(await dialogTitle.isExisting())) return false;
    for (const button of ['Wait', 'Close app']) {
      const el = this.el(by.text(button));
      if (await el.isExisting()) { await el.click(); return true; }
    }
    return false;
  }
}
