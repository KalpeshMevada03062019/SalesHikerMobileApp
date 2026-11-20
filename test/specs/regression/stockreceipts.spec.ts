// Stock receipts: search by receipt number, the detail of every receipt (items and total), the receipt received
// against PO-0004 and its link, the actions menu and the New stock receipt form with its line calculation (filled and
// discarded). Create, Reverse stock, Delete and the PDF actions are never tapped, so nothing is changed on beta.
import { expect } from 'chai';
import { stockReceiptsPage, stockReceiptDetailPage, newStockReceiptPage, RECEIPT_ACTIONS, RECEIPT_TEXTS } from '../../../src/pages/StockReceiptsPage.js';
import { purchaseOrderDetailPage } from '../../../src/pages/PurchaseOrdersPage.js';
import { money } from '../../../src/pages/SalesDocumentPages.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { stockReceiptData as sr } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openNewStockReceipt, openStockReceipt, openStockReceipts } from '../../helpers/stockreceipts.js';

const cents = (n: number) => Math.round(n * 100);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const today = () => { const d = new Date(); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

describe('Stock receipts: list, detail and the new receipt form (nothing is saved)', () => {
  requiresAccount();

  it('MSRC-002 Search finds a receipt by its number in any letter case', async () => {
    await openStockReceipts();
    const p = stockReceiptsPage;
    await p.search(sr.search.number);
    const rows = await p.rows();
    await checkpoint('MSRC-002 search');
    expect(rows.map((r) => `${r.number} ${r.supplier} ${r.warehouse}`), `results for "${sr.search.number}"`).to.deep.equal([`${sr.search.match} ${sr.search.supplier} ${sr.search.warehouse}`]);
    expect(await p.count(), 'count').to.equal(1);
  });

  it('MSRC-003 An unknown number finds no receipts and Clear filters restores the list', async () => {
    await openStockReceipts();
    const p = stockReceiptsPage;
    const all = await p.count();
    await p.search(sr.noMatch);
    expect(await p.isEmptyStateShown(), `"${RECEIPT_TEXTS.noReceipts}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${RECEIPT_TEXTS.noReceiptsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MSRC-003 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(RECEIPT_TEXTS.searchHint);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MSRC-004 The receipt detail shows its number, status, amount, date, warehouse, items and notes as on the list', async function () {
    const row = await openStockReceipt(this, sr.po.number);
    const d = stockReceiptDetailPage;
    await checkpoint('MSRC-004 detail');
    expect({ date: row.date, warehouse: row.warehouse, status: row.status }, 'list row').to.deep.equal({ date: sr.po.listDate, warehouse: sr.po.warehouse, status: 'Applied' });
    expect({ number: await d.text(d.selectors.number), status: await d.text(d.selectors.status), amount: await d.text(d.selectors.amount), received: await d.text(d.selectors.title) }, 'header')
      .to.deep.equal({ number: sr.po.number, status: row.status, amount: sr.po.amount, received: sr.po.received });
    expect({ warehouse: await d.field('Warehouse'), purchaseOrder: await d.field('Purchase order'), created: await d.field('Created') }, 'SUMMARY')
      .to.deep.equal({ warehouse: sr.po.warehouse, purchaseOrder: sr.po.purchaseOrder, created: sr.po.created });
    const { lines, total } = await d.items();
    expect(lines, 'ITEMS').to.deep.equal([sr.po.line]);
    expect(Number(await d.text(d.receipt.itemCount)), 'ITEMS count').to.equal(lines.length);
    expect(total, 'Total').to.equal(sr.po.line.total);
    await d.scrollTo(d.receipt.notes);
    expect(await d.text(d.receipt.notes), 'NOTES').to.equal(sr.po.notes);
  });

  it('MSRC-005 Every receipt adds up from its lines to its total and the amount in its header', async function () {
    await openStockReceipts();
    const rows = await stockReceiptsPage.rows();
    const problems: string[] = [];
    for (const row of rows) {
      await openStockReceipt(this, row.number, false);
      const d = stockReceiptDetailPage;
      const { lines, total } = await d.items();
      const amount = money(await d.text(d.selectors.amount));
      if (!lines.length) problems.push(`${row.number}: no lines`);
      for (const l of lines) if (cents(l.quantity * l.cost) !== cents(l.total)) problems.push(`${row.number}: ${l.name} ${l.quantity} x ${l.cost} = ${l.total}`);
      if (cents(total) !== cents(lines.reduce((s, l) => s + l.total, 0))) problems.push(`${row.number}: Total ${total} vs the lines`);
      if (cents(amount) !== cents(total)) problems.push(`${row.number}: header ${amount} vs Total ${total}`);
      if (Number(await d.text(d.receipt.itemCount)) !== lines.length) problems.push(`${row.number}: ITEMS count vs ${lines.length} lines`);
      await d.goBack();
      await stockReceiptsPage.waitForDisplayed(15_000);
      await stockReceiptsPage.waitForLoaded();
    }
    await checkpoint('MSRC-005 last receipt');
    expect(problems, 'receipt totals').to.deep.equal([]);
  });

  it('MSRC-006 A receipt opens the purchase order it was received against', async function () {
    await openStockReceipt(this, sr.po.number);
    const d = stockReceiptDetailPage;
    await $(d.receipt.field('Purchase order')).click();
    const po = purchaseOrderDetailPage;
    await po.waitForDisplayed(15_000);
    await checkpoint('MSRC-006 purchase order');
    expect(await po.text(po.selectors.number), 'purchase order').to.equal(sr.po.purchaseOrder);
    const line = (await po.lines())[0];
    expect({ name: line?.name, quantity: line?.quantity, cost: line?.cost }, 'purchase order line vs the receipt')
      .to.deep.equal({ name: sr.po.line.name, quantity: sr.po.line.quantity, cost: sr.po.line.cost });
    await po.goBack();
    await d.waitForDisplayed(15_000);
    expect(await d.text(d.selectors.number), 'back on the receipt').to.equal(sr.po.number);
  });

  it('MSRC-007 The actions menu offers reverse, PDF and delete and explains why delete is blocked', async function () {
    await openStockReceipt(this, sr.po.number);
    const d = stockReceiptDetailPage;
    expect(await $(d.receipt.footerHint).isExisting(), `"${sr.deleteBlocked}" above the buttons`).to.equal(true);
    expect({ delete: await d.buttonEnabled(d.receipt.deleteButton), reverse: await d.buttonEnabled(d.receipt.reverseButton) }, 'Delete / Reverse stock buttons (not tapped)')
      .to.deep.equal({ delete: false, reverse: true });
    const options = await d.menu();
    await checkpoint('MSRC-007 closed');
    expect(options.map((o) => o.label), 'Stock receipt actions').to.deep.equal([...RECEIPT_ACTIONS.slice(0, 3), `Delete, ${sr.deleteBlocked}`]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label.split(',')[0]), 'disabled actions').to.deep.equal(['Delete']);
    expect(await d.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });

  it('MSRC-008 The new stock receipt form shows its defaults and closes unchanged without asking', async () => {
    await openStockReceipts();
    const before = await stockReceiptsPage.count();
    await $(stockReceiptsPage.selectors.newButton).click();
    const f = newStockReceiptPage;
    await f.waitForDisplayed(15_000);
    const form = await f.read();
    await checkpoint('MSRC-008 new form');
    expect(form, 'New stock receipt').to.deep.equal({ info: true, supplier: RECEIPT_TEXTS.noSupplier, warehouse: RECEIPT_TEXTS.noWarehouse,
      date: `Received date: ${today()}`, lines: 0, notes: '', create: true });
    expect(await f.cancel(), 'discard dialog on an unchanged form').to.equal(false);
    await stockReceiptsPage.waitForDisplayed(10_000);
    await stockReceiptsPage.waitForLoaded();
    expect(await stockReceiptsPage.count(), 'count after Cancel').to.equal(before);
  });

  it('MSRC-009 The supplier and warehouse pickers list the suppliers and the warehouses with their codes', async () => {
    await openNewStockReceipt();
    const f = newStockReceiptPage;
    const suppliers = await f.pickerOptions('Supplier');
    const warehouses = await f.pickerOptions('Warehouse');
    await checkpoint('MSRC-009 pickers closed');
    expect(suppliers, 'suppliers').to.include.members(sr.suppliers);
    expect(warehouses, 'warehouses').to.include(sr.warehouse);
    expect(warehouses.filter((w) => !/, .+/.test(w)), 'warehouses without a code').to.deep.equal([]);
    expect((await f.read()).supplier, 'supplier after closing').to.equal(RECEIPT_TEXTS.noSupplier);
    expect(await f.cancel(), 'discard dialog on an unchanged form').to.equal(false);
  });

  it('MSRC-010 A receipt line takes the product cost and totals quantity times cost', async () => {
    await openNewStockReceipt();
    const f = newStockReceiptPage;
    await f.chooseProduct(sr.productSearch, sr.product);
    expect(await f.readLine(), 'new line').to.deep.equal({ product: `Product: ${sr.product}`, name: sr.product, qty: '1', cost: sr.unitCost });
    await f.setQuantity(sr.line.qty);
    await f.addLine();
    const { rows, total } = await f.lineRows();
    await checkpoint('MSRC-010 line');
    await f.discard();
    expect(rows, 'line').to.deep.equal([sr.line.row]);
    expect(total, 'Lines total').to.equal(sr.line.total);
  });

  it('MSRC-011 A changed new receipt asks before discarding, keeps the line on Cancel and saves nothing on Discard', async () => {
    await openStockReceipts();
    const before = await stockReceiptsPage.count();
    await $(stockReceiptsPage.selectors.newButton).click();
    const f = newStockReceiptPage;
    await f.waitForDisplayed(15_000);
    await f.chooseProduct(sr.productSearch, sr.product);
    await f.addLine();
    const kept = await f.cancelThenKeep();
    expect(kept.message, `"${RECEIPT_TEXTS.discardMessage}"`).to.equal(true);
    expect((await f.lineRows()).rows.length, 'lines after Cancel in the dialog').to.equal(1);
    await checkpoint('MSRC-011 kept');
    await f.discard();
    await stockReceiptsPage.waitForDisplayed(10_000);
    await stockReceiptsPage.waitForLoaded();
    expect(await stockReceiptsPage.count(), 'count after Discard').to.equal(before);
  });
});
