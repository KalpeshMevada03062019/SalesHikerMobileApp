// Navigation shared by the Ticket specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { ticketsPage, ticketDetailPage, type TicketRow } from '../../src/pages/TicketsPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Tickets. */
export async function openTickets(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(ticketsPage.selectors.moreEntry);
  await ticketsPage.waitForDisplayed(20_000);
  await ticketsPage.waitForLoaded();
}

/** Opens the ticket with this number; skips when it is not listed. */
export async function openTicket(ctx: Mocha.Context, number: string): Promise<TicketRow> {
  await openTickets();
  const row = (await ticketsPage.visibleRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no ticket ${number}`);
  await ticketsPage.openTicket(row.label);
  await ticketDetailPage.waitForDisplayed(15_000);
  return row;
}
