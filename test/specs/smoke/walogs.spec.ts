import { expect } from 'chai';
import { whatsAppLogsPage, LOG_FILTERS } from '../../../src/pages/WhatsAppLogsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openWhatsAppLogs } from '../../helpers/walogs.js';

describe('Smoke: WhatsApp logs', () => {
  requiresAccount();

  it('MWLG-001 WhatsApp Logs opens with the message count, search, filters and messages', async () => {
    await openWhatsAppLogs();
    expect(await whatsAppLogsPage.count(), 'messages').to.be.greaterThan(0);
    expect(await $(whatsAppLogsPage.selectors.search).getText(), 'search hint').to.equal('Search by phone or template');
    expect(await $(whatsAppLogsPage.selectors.filter('All')).getAttribute('selected'), '"All" selected').to.equal('true');
    for (const f of LOG_FILTERS.slice(0, 4)) expect(await $(whatsAppLogsPage.selectors.filter(f)).isExisting(), `"${f}" filter`).to.equal(true);
    const rows = await whatsAppLogsPage.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.contact || !r.status || !/^(\d{1,2}:\d{2}|\w{3}|\d{1,2} \w{3}( \d{4})?)$/.test(r.time)).map((r) => r.label);
    expect(bad, 'rows without contact, status or time').to.deep.equal([]);
    await checkpoint('MWLG-001 WhatsApp logs');
  });
});
