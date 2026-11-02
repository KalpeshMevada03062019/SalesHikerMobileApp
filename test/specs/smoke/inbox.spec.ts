import { expect } from 'chai';
import { inboxPage } from '../../../src/pages/InboxPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openInbox } from '../../helpers/inbox.js';

describe('Smoke: inbox', () => {
  requiresAccount();

  it('MINB-001 Inbox opens with chat counts, views and search', async () => {
    await openInbox();
    const { chats, unread } = await inboxPage.counts();
    expect(chats, 'chats').to.be.at.least(0);
    expect(unread, 'unread').to.be.at.most(chats);
    for (const view of ['All', 'Mine', 'Unassigned'] as const) {
      expect(await $(inboxPage.selectors.views(view)).isExisting(), `"${view}" view`).to.equal(true);
    }
    expect(await $(inboxPage.selectors.openSearch).isExisting(), 'search').to.equal(true);
    await checkpoint('MINB-001 inbox');
  });
});
