// New invoice: the form's line and total preview (MINV-021, filled then discarded, nothing saved) and one real
// Draft invoice "QA-TEST-INV <timestamp>" saved on beta and kept for the web comparison (MINV-020, only with
// INVOICE_CREATE=1). Two lines of the QT-301006 product: a percent discount with Sales 10% and an amount
// discount with TDS 2% (deducted).
import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'chai';
import { invoicesPage, invoiceDetailPage, newInvoicePage, money, INVOICE_TAX_RATES, type InvoiceLine, type NewLine } from '../../../src/pages/InvoicesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { settings } from '../../../src/config/settings.js';
import { newInvoiceData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openInvoice, openInvoices } from '../../helpers/invoices.js';
import { skipBecause } from '../../helpers/campaigns.js';

const cents = (n: number) => Math.round(n * 100);
const LINES: readonly NewLine[] = newInvoiceData.lines;
/** Net of a line (after its discount) and its tax, from the line as entered. */
const net = (l: NewLine) => newInvoiceData.unitPrice * l.quantity * (1 - (l.discountPercent ?? 0) / 100) - (l.discountAmount ?? 0);
const tax = (l: NewLine) => cents(net(l) * (INVOICE_TAX_RATES[l.tax ?? 'No tax'] ?? 0) / 100) / 100;
const describeLine = (l: InvoiceLine) => `${l.quantity} x ${l.price}${l.discount ? `, ${l.discount}% off` : ''}${l.discountAmount ? `, ${l.discountAmount} off` : ''}, ${l.tax || 'no tax'} = ${l.total}`;

/** New invoice with the subject and the two lines on the form (not saved). */
async function fillNewInvoice(subject: string): Promise<void> {
  await openInvoices();
  await $(invoicesPage.selectors.newButton).click();
  await newInvoicePage.waitForDisplayed(15_000);
  await newInvoicePage.setSubject(subject);
  for (const l of LINES) await newInvoicePage.addLine(l);
}

describe('Invoices: create an invoice (form preview; one QA-TEST invoice only with INVOICE_CREATE=1)', () => {
  requiresAccount();

  it('MINV-021 The new invoice form shows each line and the lines total with discounts and taxes', async () => {
    await fillNewInvoice(`${newInvoiceData.subjectPrefix} preview`);
    const lines = await newInvoicePage.formLines();
    const total = await newInvoicePage.linesTotal();
    await checkpoint('MINV-021 form');
    await newInvoicePage.discard();
    await invoicesPage.waitForDisplayed(20_000);
    expect(lines.map((l) => [l.quantity, l.price, l.discount, l.discountAmount, l.tax]), 'lines on the form')
      .to.deep.equal(LINES.map((l) => [l.quantity, newInvoiceData.unitPrice, l.discountPercent ?? 0, l.discountAmount ?? 0, l.tax]));
    const wrong = lines.map((l, i) => ({ l, want: net(LINES[i]!) + tax(LINES[i]!) })).filter(({ l, want }) => cents(l.total) !== cents(want));
    expect(wrong.map(({ l, want }) => `${describeLine(l)} (expected ${want.toFixed(2)})`), 'line totals (net + tax, TDS deducted)').to.deep.equal([]);
    expect(cents(total), 'Lines total').to.equal(cents(newInvoiceData.total));
  });

  it('MINV-020 A saved invoice keeps its lines and adds up to the expected total', async function () {
    if (!settings.invoice.create) skipBecause(this, 'INVOICE_CREATE is not 1: no invoice is saved');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const subject = `${newInvoiceData.subjectPrefix} ${stamp}`;
    await fillNewInvoice(subject);
    await checkpoint('MINV-020 before save');
    await newInvoicePage.save();
    // Saved once; never retried. The app opens the new invoice, or returns to the list.
    const d = invoiceDetailPage;
    const opened = await d.waitForDisplayed(60_000).then(() => true, () => false);
    if (!opened) {
      const refused = await $(newInvoicePage.selectors.saveError).getText().catch(() => '');
      expect(refused, 'Save refused (nothing saved)').to.equal('');
      await invoicesPage.waitForDisplayed(30_000);
      await invoicesPage.search(subject);
      const row = (await invoicesPage.invoiceRows()).find((r) => r.title === subject);
      expect(row, `"${subject}" on the list after Save`).to.not.equal(undefined);
      await invoicesPage.open(row!.label);
      await d.waitForDisplayed(60_000);
    }
    const number = await d.text(d.selectors.number);
    const record = { number, subject, savedAt: new Date().toISOString(), run: path.basename(settings.runDir) };
    fs.writeFileSync(path.join(settings.runDir, 'created-invoice.json'), JSON.stringify(record, null, 2));
    console.log(`Created ${number} "${subject}"`);
    expect(number, 'number').to.match(/^INV-[0-9]+$/);
    await checkSavedInvoice('MINV-020', subject);
  });

  it('MINV-022 The saved QA invoice keeps its lines and adds up to the expected total', async function () {
    // Read only: the invoice MINV-020 saved on 2026-11-16, so the check repeats without creating another.
    await openInvoice(this, newInvoiceData.saved);
    await checkSavedInvoice('MINV-022', newInvoiceData.savedSubject);
  });
});

/** On the open invoice: Draft, its subject, both lines (tax included in each line total, TDS deducted),
 *  Subtotal, taxes and Total. Every mismatch is listed together. */
async function checkSavedInvoice(id: string, subject: string): Promise<void> {
  const d = invoiceDetailPage;
  const problems: string[] = [];
  const check = (what: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${what}: ${String(got)} (expected ${String(want)})`); };
  await checkpoint(`${id} saved`);
  check('status', await d.text(d.selectors.status), 'Draft');
  check('subject', await d.text(d.selectors.title), subject);
  check('amount', money(await d.text(d.selectors.amount)), newInvoiceData.total);

  await d.scrollTo(d.invoice.grandTotal);
  const lines = await d.invoiceLines();
  const totals = await d.totals();
  await checkpoint(`${id} totals`);
  check('lines', lines.map((l) => [l.quantity, l.price, l.discount, l.discountAmount]),
    LINES.map((l) => [l.quantity, newInvoiceData.unitPrice, l.discountPercent ?? 0, l.discountAmount ?? 0]));
  lines.forEach((l, i) => LINES[i] && check(`line ${i + 1} total (${describeLine(l)})`, cents(l.total) / 100, cents(net(LINES[i]!) + tax(LINES[i]!)) / 100));
  const get = (label: string) => totals.find((t) => t.label === label)?.amount;
  check('Subtotal', get('Subtotal'), newInvoiceData.subtotal);
  const taxes = totals.filter((t) => t.label !== 'Subtotal' && t.label !== 'Total');
  check(`taxes (${taxes.map((t) => `${t.label} ${t.amount}`).join(', ')})`, cents(taxes.reduce((s, t) => s + t.amount, 0)) / 100, cents(LINES.reduce((s, l) => s + tax(l), 0)) / 100);
  check('Total', get('Total'), newInvoiceData.total);
  expect(problems, `saved invoice: ${problems.join('; ')}`).to.deep.equal([]);
}
