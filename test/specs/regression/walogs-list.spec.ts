// WhatsApp Logs list, read only: direction, status and date filters, and search.
import { expect } from 'chai';
import { whatsAppLogsPage, LOG_STATUS_FILTERS, type LogStatus } from '../../../src/pages/WhatsAppLogsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { whatsAppLogData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openWhatsAppLogs } from '../../helpers/walogs.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('WhatsApp logs: filters and search', () => {
  requiresAccount();
  beforeEach(async () => { await openWhatsAppLogs(); });

  it('MWLG-002 Outbound and Inbound counts add up to all messages', async () => {
    const all = await whatsAppLogsPage.count();
    const outbound = await whatsAppLogsPage.selectFilter('Outbound');
    const inbound = await whatsAppLogsPage.selectFilter('Inbound');
    expect(outbound + inbound, `Outbound ${outbound} + Inbound ${inbound}`).to.equal(all);
  });

  it('MWLG-003 Outbound and Inbound show only messages in that direction', async () => {
    const problems: string[] = [];
    for (const [filter, direction] of [['Outbound', 'Outgoing'], ['Inbound', 'Incoming']] as const) {
      await whatsAppLogsPage.selectFilter(filter);
      const rows = await whatsAppLogsPage.visibleRows();
      if (!rows.length) problems.push(`${filter}: no messages`);
      const other = rows.filter((r) => r.direction !== direction).length;
      if (other) problems.push(`${filter}: ${other} ${direction === 'Outgoing' ? 'incoming' : 'outgoing'} message(s) listed`);
      await checkpoint(`MWLG-003 ${filter}`);
    }
    expect(problems, 'direction filters').to.deep.equal([]);
  });

  it('MWLG-004 Status filters include outgoing messages with that status', async function () {
    await whatsAppLogsPage.selectFilter('Outbound');
    const seen = [...new Set((await whatsAppLogsPage.visibleRows()).map((r) => r.status))]
      .filter((s): s is LogStatus => (LOG_STATUS_FILTERS as readonly string[]).includes(s));
    if (!seen.length) skipBecause(this, 'no outgoing message with a Sent, Delivered, Read or Failed status on screen');
    const problems: string[] = [];
    for (const status of seen) {
      const count = await whatsAppLogsPage.selectFilter(status);
      const rows = await whatsAppLogsPage.visibleRows();
      await checkpoint(`MWLG-004 ${status}`);
      const wrong = rows.filter((r) => r.status !== status).length;
      if (wrong) problems.push(`${status}: ${wrong} message(s) with another status`);
      if (!rows.some((r) => r.direction === 'Outgoing')) problems.push(`${status}: no outgoing message (filter shows ${count}) although Outbound lists "${status}" messages`);
    }
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MWLG-005 Today lists the messages logged today', async function () {
    const today = (await whatsAppLogsPage.visibleRows()).filter((r) => /^\d{1,2}:\d{2}$/.test(r.time));
    if (!today.length) skipBecause(this, 'no message logged today');
    const count = await whatsAppLogsPage.selectFilter('Today');
    await checkpoint('MWLG-005 today');
    expect(count, `"Today" count (All lists ${today.length}+ messages timed today)`).to.be.at.least(today.length);
  });

  it('MWLG-006 Search by phone finds that number only, an unknown text finds none and Clear Search restores the list', async function () {
    const all = await whatsAppLogsPage.count();
    const first = (await whatsAppLogsPage.visibleRows())[0];
    if (!first) skipBecause(this, 'no messages listed');
    const digits = first.phone.replace(/\D/g, '').slice(-10);
    await whatsAppLogsPage.search(digits);
    const rows = await whatsAppLogsPage.visibleRows();
    expect(rows.length, 'results for the first message phone').to.be.greaterThan(0);
    expect(rows.filter((r) => !r.phone.replace(/\D/g, '').endsWith(digits)).length, 'results with another phone').to.equal(0);
    expect(await whatsAppLogsPage.count(), 'filtered count').to.be.lessThan(all);
    await whatsAppLogsPage.search(whatsAppLogData.noMatch);
    expect(await whatsAppLogsPage.isEmptyStateShown(), '"No messages found"').to.equal(true);
    expect(await $(whatsAppLogsPage.selectors.noMessagesHint).isExisting(), '"No message matches this search or filter."').to.equal(true);
    expect(await whatsAppLogsPage.count(), 'count').to.equal(0);
    await checkpoint('MWLG-006 no match');
    await whatsAppLogsPage.clearFromEmptyState();
    expect(await whatsAppLogsPage.count(), 'count after Clear Search').to.equal(all);
  });
});
