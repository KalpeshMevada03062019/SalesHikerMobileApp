import { expect } from 'chai';
import { ticketsPage, TICKET_TEXTS } from '../../../src/pages/TicketsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTickets } from '../../helpers/tickets.js';

describe('Smoke: tickets', () => {
  requiresAccount();

  it('MTKT-001 Tickets opens with the count, search, status filters and tickets', async () => {
    await openTickets();
    const p = ticketsPage;
    const count = await p.count();
    expect(count, 'tickets').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(TICKET_TEXTS.searchHint);
    expect(await $(p.selectors.newTicket).isExisting(), 'New Ticket (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.visibleRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(rows.filter((r) => !r.title || !r.date || !r.number || !r.status).map((r) => r.label), 'rows without title, date, number or status').to.deep.equal([]);
    if (count <= rows.length) expect(await p.footer(), 'footer').to.deep.equal({ shown: count, total: count });
    await checkpoint('MTKT-001 tickets');
  });
});
