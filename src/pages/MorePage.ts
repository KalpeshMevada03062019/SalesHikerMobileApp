// "More" screen (bottom navigation > More) and its sign-out confirmation dialog.
import { BasePage, by } from './BasePage.js';

export class MorePage extends BasePage {
  // "More" alone also matches the tab label; this stat tile exists only on this screen.
  protected readonly marker = by.text('Tasks today');

  readonly selectors = {
    campaigns: by.a11y('Campaigns'),   // WHATSAPP section
    tasksToday: 'android=new UiSelector().descriptionMatches("[0-9,]+ Tasks today")',   // stat tile at the top
    calendar: by.a11y('Calendar'),     // CRM section: the task calendar
    signOut: by.a11y('Sign out'),
    dialogTitle: by.text('Sign out?'),
    dialogMessage: by.text('You stop getting notifications on this phone.'),
    dialogCancel: by.text('Cancel'),
    // Same label as the list item: take the "Sign out" that follows the dialog message.
    dialogConfirm: '//*[@text="You stop getting notifications on this phone."]/following::*[@text="Sign out"][1]',
  };

  /** "0 Tasks today" -> 0 (scrolls back to the top first). */
  async tasksToday(): Promise<number> {
    await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollToBeginning(5)').isExisting();
    return Number(((await this.el(this.selectors.tasksToday).getAttribute('content-desc')) ?? '').replace(/[^\d]/g, ''));
  }

  /** Scrolls the last list item into view, clear of the floating tab bar that covers the bottom. */
  async scrollToSignOut(): Promise<void> {
    await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().description("Sign out"))');
    const { height } = await driver.getWindowSize();
    const item = await this.el(this.selectors.signOut).getLocation();
    if (item.y > height * 0.75) {
      await driver.execute('mobile: swipeGesture', { left: 0, top: height * 0.3, width: 200, height: height * 0.4, direction: 'up', percent: 0.5 });
    }
  }

  /**
   * Opens a list entry (e.g. "~Workflows"), first scrolling in short steps until it sits clear of the tab bar.
   * UiScrollable.scrollIntoView and swipeGesture fling past entries in the middle of the list.
   */
  async openEntry(selector: string): Promise<void> {
    const { width, height } = await driver.getWindowSize();
    for (let i = 0; i < 8; i++) {
      const found = await $$(selector);   // queried afresh after each scroll
      if (found.length) {
        const { y } = await found[0]!.getLocation();
        if (y > 150 && y < height * 0.8) break;
      }
      await driver.execute('mobile: scrollGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction: 'down', percent: 0.5 });
    }
    await this.tap(selector);
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
