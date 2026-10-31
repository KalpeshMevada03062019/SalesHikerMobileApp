// "Scan a code" screen (Sign-in > "Scan a code from the web app") and the shared header controls.
import { BasePage, by } from './BasePage.js';

export class ScanCodePage extends BasePage {
  protected readonly marker = by.text('Scan a code');

  readonly selectors = {
    instructions: 'android=new UiSelector().textContains("Link a phone")',
    back: by.a11y('Back'),
  };

  async hasInstructions(): Promise<boolean> {
    return this.isVisible(this.selectors.instructions);
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

/** Theme toggle in the header of the pre-login screens; its label tells which theme is active. */
export class ThemeToggle extends BasePage {
  protected readonly marker = by.a11y('Switch to dark mode');

  readonly selectors = {
    toDark: by.a11y('Switch to dark mode'),
    toLight: by.a11y('Switch to light mode'),
  };

  async switchToDark(): Promise<void> { await this.tap(this.selectors.toDark); }
  async switchToLight(): Promise<void> { await this.tap(this.selectors.toLight); }
  async isDarkActive(): Promise<boolean> { return this.isVisible(this.selectors.toLight); }
  async isLightActive(): Promise<boolean> { return this.isVisible(this.selectors.toDark); }
}

export const scanCodePage = new ScanCodePage();
export const themeToggle = new ThemeToggle();
