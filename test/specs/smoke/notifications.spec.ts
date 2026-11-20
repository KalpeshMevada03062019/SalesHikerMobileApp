import { expect } from 'chai';
import { notificationsPage } from '../../../src/pages/NotificationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openNotifications } from '../../helpers/notifications.js';

describe('Smoke: notifications', () => {
  requiresAccount();

  it('MNTF-001 Notifications opens from More with each notification showing a title, date and text', async () => {
    await openNotifications('list');
    const rows = await notificationsPage.rows();
    await checkpoint('MNTF-001 notifications');
    expect(rows.length, 'notifications').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.title || !/^([0-9]{1,2} [A-Z][a-z]{2}|Today|Yesterday|[0-9]{1,2}:[0-9]{2})$/.test(r.date) || !r.text);
    expect(bad.map((r) => r.label), 'rows without a title, date or text').to.deep.equal([]);
    expect(await $(notificationsPage.selectors.endOfList).isExisting(), 'End of list').to.equal(true);
  });
});
