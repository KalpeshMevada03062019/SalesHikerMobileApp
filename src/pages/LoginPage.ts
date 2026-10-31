// Sign-in screen: the first screen after a clean launch.
// Selectors and texts were read from the live app (build 1.0.0) in the UiAutomator hierarchy:
// React Native accessibilityLabel -> content-desc (`by.a11y`), plain labels -> text (`by.text`).
// Build 1.0.0 has no resource-ids; when testIDs are added, only this file changes.
import { BasePage, by } from './BasePage.js';

export const LOGIN_MESSAGES = {
  emailRequired: 'Enter your email',
  passwordRequired: 'Enter your password',
  emailMalformed: 'Enter a full email, like you@company.com.',
  wrongCredentials: 'Email or password is wrong.',   // also for unknown accounts (no user enumeration)
  serverInvalidEmail: 'Invalid email',                // server banner, see defect MLGN-D01
  noConnection: 'Check your connection and try again.',
} as const;
export type LoginMessage = keyof typeof LOGIN_MESSAGES;

export class LoginPage extends BasePage {
  protected readonly marker = by.text('Welcome back to SalesHiker');

  readonly selectors = {
    logo: by.a11y('SalesHiker'),
    subtitle: this.marker,
    email: by.a11y('Email address'),
    password: by.a11y('Password'),
    showPassword: by.a11y('Show password'),
    hidePassword: by.a11y('Hide password'),
    // "Sign in" is also the screen title; the button is the Button with that label.
    submit: by.descClass('Sign in', 'android.widget.Button'),
    submitting: 'android=new UiSelector().textStartsWith("Signing in")',
    forgotPassword: by.a11y('Forgot password?'),
    scanCode: by.a11y('Scan a code from the web app'),
    createWorkspace: by.a11y('New here? Create your workspace'),
  };

  async enterEmail(email: string): Promise<void> {
    await this.type(this.selectors.email, email);
  }

  async enterPassword(password: string): Promise<void> {
    await this.type(this.selectors.password, password);
  }

  async submit(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.submit);
  }

  /** Types the password and submits with the keyboard's Enter key instead of the button. */
  async submitWithEnterKey(password: string): Promise<void> {
    const field = this.el(this.selectors.password);
    await field.click();
    await field.setValue(password);
    await driver.pressKeyCode(66);   // KEYCODE_ENTER
  }

  async signInWith(email: string, password: string): Promise<void> {
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.submit();
  }

  messageSelector(message: LoginMessage): string {
    return by.text(LOGIN_MESSAGES[message]);
  }

  async isMessageShown(message: LoginMessage): Promise<boolean> {
    return this.isVisible(this.messageSelector(message));
  }

  async waitForMessage(message: LoginMessage, timeout = 20_000): Promise<void> {
    await this.waitForVisible(this.messageSelector(message), timeout, `Message "${LOGIN_MESSAGES[message]}"`);
  }

  /** Waits up to `timeout` for a message that must NOT appear; returns true if it appeared. */
  async messageAppearsWithin(message: LoginMessage, timeout: number): Promise<boolean> {
    try {
      await this.el(this.messageSelector(message)).waitForDisplayed({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  async isSubmitting(): Promise<boolean> {
    return this.isVisible(this.selectors.submitting);
  }

  /** True when the given plain text is visible, i.e. the password is not masked. */
  async isTextVisible(text: string): Promise<boolean> {
    return this.isVisible(by.text(text));
  }

  async togglePasswordVisibility(): Promise<void> {
    const show = this.el(this.selectors.showPassword);
    await ((await show.isDisplayed()) ? show.click() : this.tap(this.selectors.hidePassword));
  }

  async isPasswordToggleLabelled(label: 'Show password' | 'Hide password'): Promise<boolean> {
    return this.isVisible(by.a11y(label));
  }

  async openForgotPassword(): Promise<void> { await this.tap(this.selectors.forgotPassword); }
  async openCreateWorkspace(): Promise<void> { await this.tap(this.selectors.createWorkspace); }
  async openScanCode(): Promise<void> { await this.tap(this.selectors.scanCode); }

  /** Every control the sign-in screen must offer, keyed for readable assertion messages. */
  async visibleControls(): Promise<Record<string, boolean>> {
    const s = this.selectors;
    const entries = Object.entries({ logo: s.logo, subtitle: s.subtitle, email: s.email, password: s.password, showPassword: s.showPassword, submit: s.submit, forgotPassword: s.forgotPassword, scanCode: s.scanCode, createWorkspace: s.createWorkspace });
    const result: Record<string, boolean> = {};
    for (const [name, selector] of entries) result[name] = await this.isVisible(selector);
    return result;
  }
}

export const loginPage = new LoginPage();
