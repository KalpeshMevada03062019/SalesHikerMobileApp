// "More" screen (bottom navigation > More) and its sign-out confirmation dialog.
import { BasePage, by } from './BasePage.js';

export class MorePage extends BasePage {
  // "More" alone also matches the tab label; this stat tile exists only on this screen.
  protected readonly marker = by.text('Tasks today');

  readonly selectors = {
    campaigns: by.a11y('Campaigns'),   // WHATSAPP section
    signOut: by.a11y('Sign out'),
    dialogTitle: by.text('Sign out?'),
    dialogMessage: by.text('You stop getting notifications on this phone.'),
    dialogCancel: by.text('Cancel'),
    // Same label as the list item: take the "Sign out" that follows the dialog message.
    dialogConfirm: '//*[@text="You stop getting notifications on this phone."]/following::*[@text="Sign out"][1]',
  };

  /** Scrolls the last list item into view, clear of the floating tab bar that covers the bottom. */
  async scrollToSignOut(): Promise<void> {
    await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description("Sign out"))');
    const { height } = await driver.getWindowSize();
    const item = await this.el(this.selectors.signOut).getLocation();
    if (item.y > height * 0.75) {
      await driver.execute('mobile: swipeGesture', { left: 0, top: height * 0.3, width: 200, height: height * 0.4, direction: 'up', percent: 0.5 });
    }
  }

  async openCampaigns(): Promise<void> {
    await this.tap(this.selectors.campaigns);
  }

  async openSignOutDialog(): Promise<void> {
    await this.scrollToSignOut();
    await this.tap(this.selectors.signOut);
    await this.waitForVisible(this.selectors.dialogTitle, 8_000, 'Sign-out confirmation');
  }

  async cancelSignOut(): Promise<void> {
    await this.tap(this.selectors.dialogCancel);
  }

  async confirmSignOut(): Promise<void> {
    await this.tap(this.selectors.dialogConfirm);
  }

  async isDialogShown(): Promise<boolean> {
    return this.isVisible(this.selectors.dialogTitle);
  }

  async isDialogMessageShown(): Promise<boolean> {
    return this.isVisible(this.selectors.dialogMessage);
  }

  async isSignOutListed(): Promise<boolean> {
    return this.isVisible(this.selectors.signOut);
  }
}

export const morePage = new MorePage();
