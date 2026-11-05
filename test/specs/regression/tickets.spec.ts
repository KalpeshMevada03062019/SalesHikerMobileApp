// Tickets, read only: status chips, the Priority sheet, search, the row status badge and the detail of the
// beta ticket with its Ticket Actions menu (opened and closed). New Ticket, Reopen, Add Note, the note box
// and every menu action are never tapped.
import { expect } from 'chai';
import { ticketsPage, ticketDetailPage, TICKET_STATUSES, TICKET_PRIORITIES, TICKET_ACTIONS, TICKET_TEXTS } from '../../../src/pages/TicketsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { ticketData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTicket, openTickets } from '../../helpers/tickets.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Tickets: filters, search and detail (nothing is changed)', () => {
  requiresAccount();

  it('MTKT-002 Status counts add up to all tickets', async () => {
    await openTickets();
    const p = ticketsPage;
    const all = await p.count();
    let sum = 0;
    for (const s of TICKET_STATUSES) sum += await p.selectFilter(s);
    expect(sum, 'Open + In Progress + Waiting + Closed').to.equal(all);
  });

  it('MTKT-003 Each status filter shows only tickets with that status, or No tickets found', async () => {
    await openTickets();
    const p = ticketsPage;
    const problems: string[] = [];
    for (const s of TICKET_STATUSES) {
      const count = await p.selectFilter(s);
      const selected = await p.selectedFilters();
      if (selected.join() !== s) problems.push(`${s}: selected chips ${selected.join('+')}`);
      const rows = await p.visibleRows();
      if (count === 0 && !(await $(p.selectors.noTickets).isExisting())) problems.push(`${s}: 0 tickets without "${TICKET_TEXTS.noTickets}"`);
      if (count > 0 && !rows.length) problems.push(`${s}: ${count} tickets, none listed`);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    await checkpoint('MTKT-003 last status');
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MTKT-004 The Priority filter lists the priorities and shows the ticket under its own priority only', async () => {
    await openTickets();
    const p = ticketsPage;
    expect(await p.priorityValue(), 'Priority chip').to.equal('');
    const { options, selected } = await p.openPrioritySheet();
    expect(options, 'priority options').to.deep.equal([TICKET_TEXTS.anyPriority, ...TICKET_PRIORITIES]);
    expect(selected, 'selected priority').to.equal(TICKET_TEXTS.anyPriority);
    await checkpoint('MTKT-004 priority sheet');
    await p.choosePriority(ticketData.priority);
    expect(await p.priorityValue(), 'Priority chip').to.equal(ticketData.priority);
    expect((await p.visibleRows()).map((r) => r.number), `tickets with priority ${ticketData.priority}`).to.include(ticketData.number);
    await p.openPrioritySheet();
    expect(await p.choosePriority(ticketData.otherPriority), `tickets with priority ${ticketData.otherPriority}`).to.equal(0);
    expect(await p.isEmptyStateShown(), `"${TICKET_TEXTS.noTickets}"`).to.equal(true);
    await checkpoint('MTKT-004 other priority');
    await p.clearPriority();
    expect(await p.priorityValue(), 'Priority chip after clearing').to.equal('');
    expect((await p.visibleRows()).map((r) => r.number), 'tickets after clearing').to.include(ticketData.number);
  });

  it('MTKT-005 Search finds a ticket by title or number, an unknown word finds none and Clear Filters resets every filter', async () => {
    await openTickets();
    const p = ticketsPage;
    const all = await p.count();
    await p.search(ticketData.title.toUpperCase());
    expect((await p.visibleRows()).map((r) => r.number), `results for "${ticketData.title.toUpperCase()}"`).to.include(ticketData.number);
    await p.search(ticketData.number.toLowerCase());
    const byNumber = await p.visibleRows();
    expect(byNumber.map((r) => r.number), `results for "${ticketData.number.toLowerCase()}"`).to.deep.equal([ticketData.number]);
    await checkpoint('MTKT-005 by number');
    await p.selectFilter('Closed');
    await p.search(ticketData.noMatch);
    expect(await p.isEmptyStateShown(), `"${TICKET_TEXTS.noTickets}"`).to.equal(true);
    expect(await $(p.selectors.noTicketsHint).isExisting(), `"${TICKET_TEXTS.noTicketsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MTKT-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear Filters').to.equal(TICKET_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear Filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear Filters').to.equal(all);
  });

  it('MTKT-006 The ticket list shows a readable status badge', async function () {
    await openTickets();
    const p = ticketsPage;
    const row = (await p.visibleRows())[0];
    if (!row) skipBecause(this, 'no tickets');
    const width = await p.statusWidth(row.label);
    await checkpoint('MTKT-006 status badge');
    expect(row.status, 'status').to.be.oneOf([...TICKET_STATUSES]);
    // "Closed" needs about 80 px at this size (the detail draws it 79 px wide); 2026-11-05 the list drew it 14 px, shown as "...".
    expect(width, `width of the "${row.status}" badge text on ${row.number} (px)`).to.be.at.least(40);
  });

  it('MTKT-007 The ticket detail shows its number, status, priority, people and texts as on the list', async function () {
    const row = await openTicket(this, ticketData.number);
    const d = ticketDetailPage;
    expect(await $(d.selectors.number(row.number)).isExisting(), 'number').to.equal(true);
    expect(await $(d.selectors.title(row.title)).isExisting(), 'title').to.equal(true);
    expect(await d.text(d.selectors.status(row.title)), 'status vs list').to.equal(row.status);
    expect(await d.text(d.selectors.priority(row.title)), 'priority').to.equal(ticketData.priority);
    expect(await d.text(d.selectors.opened), 'opened by').to.match(new RegExp(`^Opened by .+, ${row.date}, [0-9]{1,2}:[0-9]{2} [AP]M$`));
    if (row.status === 'Closed') expect(await $(d.selectors.reopen).isExisting(), 'Reopen (not tapped)').to.equal(true);
    expect(await d.detail('Assignee'), 'Assignee').to.not.equal('');
    expect(await d.detail('Channel'), 'Channel').to.not.equal('');
    expect(await d.text(d.selectors.sectionText('DESCRIPTION')), 'DESCRIPTION').to.not.equal('');
    await checkpoint('MTKT-007 detail');
    await d.scrollTo(d.selectors.noteBox);
    expect(await $(d.selectors.section('ACTIVITY')).isExisting(), 'ACTIVITY').to.equal(true);
    expect(await $$(d.selectors.activityDates).length, 'activity entries').to.be.greaterThan(0);
    expect(await $(d.selectors.addNote).isExisting(), 'Add Note (not tapped)').to.equal(true);
    expect(await $(d.selectors.noteBox).isExisting(), 'note box (nothing typed)').to.equal(true);
    await checkpoint('MTKT-007 activity');
    await d.goBack();
    await ticketsPage.waitForDisplayed();
    expect((await ticketsPage.visibleRows()).map((r) => r.number), 'list after Back').to.include(row.number);
  });

  it('MTKT-008 The ticket actions menu offers change status, change priority, edit and delete', async function () {
    await openTicket(this, ticketData.number);
    const options = await ticketDetailPage.actionOptions();
    expect(options, 'Ticket Actions').to.deep.equal([...TICKET_ACTIONS]);
    await checkpoint('MTKT-008 closed');
    expect(await ticketDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });
});
