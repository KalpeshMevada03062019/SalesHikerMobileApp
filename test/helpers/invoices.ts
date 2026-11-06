// Navigation shared by the Invoice specs.
import { homePage } from '../../src/pages/HomePage.js';
import { morePage } from '../../src/pages/MorePage.js';
import { invoicesPage, invoiceDetailPage, type InvoiceRow } from '../../src/pages/InvoicesPage.js';
import { launchSignedIn } from '../../src/utils/app.js';
import { account } from '../../src/data/testData.js';
import { skipBecause } from './campaigns.js';

/** Restarts the app signed in and opens More > Invoices. */
export async function openInvoices(): Promise<void> {
  await launchSignedIn(account.email, account.password);
  await homePage.openMore();
  await morePage.waitForDisplayed();
  await morePage.openEntry(invoicesPage.selectors.moreEntry);
  await invoicesPage.waitForDisplayed(20_000);
  await invoicesPage.waitForLoaded();
}

/** Searches an invoice number and opens it (the detail can take 30 s to load); skips when it is not found. */
export async function openInvoice(ctx: Mocha.Context, number: string): Promise<InvoiceRow> {
  await openInvoices();
  await invoicesPage.search(number);
  const row = (await invoicesPage.invoiceRows()).find((r) => r.number === number);
  if (!row) skipBecause(ctx, `no invoice ${number}`);
  await invoicesPage.open(row.label);
  await invoiceDetailPage.waitForDisplayed(60_000);
  return row;
}
