// Home ("Today") dashboard, the first screen after a successful sign-in.
// The greeting ("Good afternoon, <first name>") is not used: it depends on time and user.
import { BasePage, by } from './BasePage.js';

export class HomePage extends BasePage {
  // Label under the unread-chats ring, pluralised from live data: "Unread chats" (0 or many),
  // "Unread chat" (exactly 1, seen on the phone on 2026-10-30).
  protected readonly marker = by.textMatches('Unread chats?');

  readonly selectors = {
    title: by.text('Today'),
    unreadChats: this.marker,
    moreTab: by.a11y('More'),   // bottom navigation, right-most tab
  };

  async openMore(): Promise<void> {
    await this.tap(this.selectors.moreTab);
  }
}

export const homePage = new HomePage();
