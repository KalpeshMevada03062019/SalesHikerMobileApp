// Purchase orders: status chips, search, the detail of every order (lines, taxes, grand total, paid / balance,
// received quantities and receipts), the actions menu, the Receive stock sheet (cancelled) and the New purchase
// order form with its line calculation (filled and discarded). Save, Receive, Edit and the menu actions are
// never tapped, so nothing is changed on beta.
import { expect } from 'chai';
import {
  purchaseOrdersPage, purchaseOrderDetailPage, receiveStockPage, newPurchaseOrderPage,
  PURCHASE_ORDER_STATUSES, PURCHASE_ORDER_ACTIONS, PURCHASE_ORDER_TEXTS,
} from '../../../src/pages/PurchaseOrdersPage.js';
import { money } from '../../../src/pages/SalesDocumentPages.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { purchaseOrderData as po } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openPurchaseOrder, openPurchaseOrders, openNewPurchaseOrder } from '../../helpers/purchaseorders.js';

const cents = (n: number) => Math.round(n * 100);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const today = () => { const d = new Date(); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const amount = (totals: { label: string; amount: number }[], label: string) => totals.find((t) => t.label === label)?.amount;

/** Opens each purchase order on the list in turn and collects what `read` returns for it. */
async function eachOrder<T>(ctx: Mocha.Context, read: (number: string, listAmount: string, status: string) => Promise<T>): Promise<T[]> {
  await openPurchaseOrders();
  const rows = await purchaseOrdersPage.visibleRows();
  expect(rows.length, 'purchase orders on the list').to.equal(await purchaseOrdersPage.count());
  const out: T[] = [];
  for (const row of rows) {
    await openPurchaseOrder(ctx, row.number, false);
    out.push(await read(row.number, row.amount, row.status));
    await purchaseOrderDetailPage.goBack();
    await purchaseOrdersPage.waitForDisplayed(15_000);
    await purchaseOrdersPage.waitForLoaded();
  }
  return out;
}

describe('Purchase orders: list, detail, receiving and the new order form (nothing is saved)', () => {
  requiresAccount();

  it('MPUR-002 Status counts add up to all purchase orders', async () => {
    await openPurchaseOrders();
    const p = purchaseOrdersPage;
    const all = await p.count();
    const counts: string[] = [];
    let sum = 0;
    for (const s of PURCHASE_ORDER_STATUSES) { const n = await p.selectFilter(s); counts.push(`${s} ${n}`); sum += n; }
    await checkpoint('MPUR-002 last status');
    expect(sum, `${counts.join(' + ')} vs All ${all}`).to.equal(all);
  });

  it('MPUR-003 Each status filter shows only purchase orders with that status', async () => {
    await openPurchaseOrders();
    const p = purchaseOrdersPage;
    const problems: string[] = [];
    for (const s of PURCHASE_ORDER_STATUSES) {
      const n = await p.selectFilter(s);
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (await p.isFilterSelected('All')) problems.push(`${s}: All still selected`);
      const rows = await p.visibleRows();
      if (n === 0 && !(await p.isEmptyStateShown(5_000))) problems.push(`${s}: 0 orders without "${PURCHASE_ORDER_TEXTS.noOrders}"`);
      if (n > 0 && rows.length !== n) problems.push(`${s}: ${rows.length} rows vs count ${n}`);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    await checkpoint('MPUR-003 last status');
    expect(problems, 'status filters').to.deep.equal([]);
  });

  it('MPUR-004 Search finds a purchase order by number or supplier in any letter case', async () => {
    await openPurchaseOrders();
    const p = purchaseOrdersPage;
    await p.search(po.number.toLowerCase());
    const byNumber = await p.visibleRows();
    expect(byNumber.map((r) => r.number), `results for "${po.number.toLowerCase()}"`).to.deep.equal([po.number]);
    expect(byNumber[0]!.title, 'supplier').to.equal(po.supplier);
    await p.search(po.supplierSearch.toUpperCase());
    const bySupplier = await p.visibleRows();
    await checkpoint('MPUR-004 by supplier');
    expect(bySupplier.map((r) => r.number), `results for "${po.supplierSearch.toUpperCase()}"`).to.include(po.number);
    expect(bySupplier.filter((r) => !r.title.toLowerCase().includes(po.supplierSearch)).map((r) => r.label), 'results from other suppliers').to.deep.equal([]);
    expect(await p.count(), 'count vs results').to.equal(bySupplier.length);
  });

  it('MPUR-005 An unknown word finds no purchase orders and Clear filters restores the list', async () => {
    await openPurchaseOrders();
    const p = purchaseOrdersPage;
    const all = await p.count();
    await p.search(po.noMatch);
    expect(await p.isEmptyStateShown(), `"${PURCHASE_ORDER_TEXTS.noOrders}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${PURCHASE_ORDER_TEXTS.noOrdersHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MPUR-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(PURCHASE_ORDER_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MPUR-006 The purchase order detail shows its number, status, amount, supplier, warehouse and order date', async function () {
    const row = await openPurchaseOrder(this, po.number);
    const d = purchaseOrderDetailPage;
    await checkpoint('MPUR-006 detail');
    expect(await d.text(d.selectors.number), 'number').to.equal(row.number);
    expect(await d.text(d.selectors.status), 'status').to.equal(row.status);
    expect(await d.text(d.selectors.amount), 'amount').to.equal(row.amount);
    expect(await d.text(d.selectors.title), 'supplier under the amount').to.equal(row.title);
    expect(await d.field('Vendor'), 'Vendor').to.equal(po.supplier);
    expect(await d.field('Warehouse'), 'Warehouse').to.equal(po.warehouse);
    const orderDate = await d.field('Order date');
    const lines = await d.lines();
    expect(lines.length, 'lines vs ITEMS count').to.equal(Number(await d.text(d.po.itemCount)));
    expect(lines[0], 'line').to.deep.include({ name: po.product, quantity: po.ordered, cost: money(po.unitCost), received: `Received ${po.received} of ${po.ordered}` });
    await d.goBack();
    await purchaseOrdersPage.waitForDisplayed();
    expect((await purchaseOrdersPage.visibleRows()).map((r) => r.number), 'list after Back').to.include(row.number);
    expect(orderDate, 'Order date (web: 10/12/2026)').to.equal(po.orderDate);
  });

  it('MPUR-007 Every purchase order adds up from its lines and taxes to the grand total on the list', async function () {
    const problems = (await eachOrder(this, async (number, listAmount) => {
      const d = purchaseOrderDetailPage;
      const issues: string[] = [];
      const lines = await d.lines();
      for (const l of lines) if (cents(l.quantity * l.cost) !== cents(l.total)) issues.push(`${l.quantity} x ${l.cost} = ${l.total}`);
      const totals = await d.totals();
      const grand = amount(totals, 'Grand total');
      const items = amount(totals, 'Items total') ?? lines.reduce((s, l) => s + l.total, 0);
      if (cents(items) !== cents(lines.reduce((s, l) => s + l.total, 0))) issues.push(`Items total ${items} vs lines`);
      const preTax = amount(totals, 'Pre-tax total') ?? items;
      const tax = amount(totals, '(+) Tax') ?? 0;
      const deducted = amount(totals, '(-) Deducted taxes') ?? 0;
      if (grand === undefined) issues.push('no Grand total');
      else {
        if (cents(preTax + tax - deducted) !== cents(grand)) issues.push(`Grand total ${grand} vs ${preTax} + ${tax} - ${deducted}`);
        if (cents(grand) !== cents(money(listAmount))) issues.push(`Grand total ${grand} vs list ${listAmount}`);
      }
      return issues.map((i) => `${number}: ${i}`);
    })).flat();
    await checkpoint('MPUR-007 last order');
    expect(problems, 'purchase order totals').to.deep.equal([]);
  });

  it('MPUR-008 The balance of every purchase order is its grand total minus the amount paid', async function () {
    const rows = await eachOrder(this, async (number) => {
      const totals = await purchaseOrderDetailPage.totals();
      return { number, grand: amount(totals, 'Grand total'), paid: amount(totals, 'Paid'), balance: amount(totals, 'Balance') };
    });
    await checkpoint('MPUR-008 last order');
    const wrong = rows.filter((r) => r.grand === undefined || r.paid === undefined || r.balance === undefined
      || cents(r.balance) !== cents(r.grand - r.paid)).map((r) => `${r.number}: Grand total ${r.grand}, Paid ${r.paid}, Balance ${r.balance}`);
    expect(wrong, 'orders whose Balance is not Grand total - Paid').to.deep.equal([]);
  });

  it('MPUR-009 Received quantities match the status and the receipts of every purchase order', async function () {
    const problems = (await eachOrder(this, async (number, _amount, status) => {
      const d = purchaseOrderDetailPage;
      const issues: string[] = [];
      const lines = await d.lines();
      let ordered = 0, received = 0;
      for (const l of lines) {
        const m = /^Received ([0-9]+) of ([0-9]+)$/.exec(l.received);
        if (!m) { issues.push(`line "${l.name}" without "Received n of m": "${l.received}"`); continue; }
        received += Number(m[1]); ordered += Number(m[2]);
        if (Number(m[2]) !== l.quantity) issues.push(`"${l.received}" vs quantity ${l.quantity}`);
      }
      const expected = received === 0 ? null : received >= ordered ? 'Received' : 'Partially Received';
      if (expected && status !== expected) issues.push(`received ${received} of ${ordered} but status ${status}`);
      const { rows, noStock } = await d.receipts();
      if (received > 0 && noStock) issues.push(`received ${received} of ${ordered} but "No stock received yet."`);
      if (received > 0 && !rows.length) issues.push(`received ${received} of ${ordered} but no receipt listed`);
      if (received === 0 && rows.length) issues.push(`nothing received but receipts ${rows.join('; ')}`);
      return issues.map((i) => `${number}: ${i}`);
    })).flat();
    await checkpoint('MPUR-009 last order');
    expect(problems, 'received quantities, status and receipts').to.deep.equal([]);
  });

  it('MPUR-010 The actions menu offers edit, receive, PDF, task, notes and delete and explains the disabled ones', async function () {
    await openPurchaseOrder(this, po.number);
    const d = purchaseOrderDetailPage;
    expect(await $(d.po.footerHint).getText(), 'hint above Edit').to.equal(PURCHASE_ORDER_TEXTS.cannotEdit);
    expect(await d.buttonEnabled(d.po.editButton), 'Edit button enabled').to.equal(false);
    expect(await d.buttonEnabled(d.po.receiveButton), 'Receive stock button enabled').to.equal(true);
    const options = await d.menu();
    await checkpoint('MPUR-010 closed');
    expect(options.map((o) => o.label), 'Purchase order actions').to.deep.equal([
      `Edit, ${PURCHASE_ORDER_TEXTS.cannotEdit}`, 'Receive stock', 'View PDF', 'Save PDF', 'Add task', 'Notes', `Delete, ${PURCHASE_ORDER_TEXTS.deleteReason}`]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label.split(',')[0]), 'disabled actions').to.deep.equal(['Edit', 'Delete']);
    expect(PURCHASE_ORDER_ACTIONS.length, 'actions').to.equal(options.length);
    expect(await d.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });

  it('MPUR-011 Receive stock offers the outstanding quantity of each line and cancels without receiving', async function () {
    await openPurchaseOrder(this, po.number);
    const d = purchaseOrderDetailPage;
    await d.openReceiveStock();
    const sheet = await receiveStockPage.read(po.product);
    await checkpoint('MPUR-011 receive stock');
    const outstanding = po.ordered - po.received;
    expect(sheet.intro, 'intro').to.equal(`${po.number}. ${PURCHASE_ORDER_TEXTS.receiveIntro}`);
    expect(sheet.warehouse, 'warehouse').to.equal(`Warehouse: ${po.warehouse}`);
    expect(sheet.quantity, 'quantity to receive').to.equal(String(outstanding));
    expect(sheet.info, 'line info').to.equal(`Ordered ${po.ordered} · received ${po.received} · outstanding ${outstanding}`);
    expect(sheet.receive, 'Receive (not tapped)').to.equal(true);
    expect(await receiveStockPage.cancel(), 'dialog on Cancel').to.equal(false);
    await d.waitForDisplayed(10_000);
    expect((await d.lines())[0]?.received, 'received after Cancel').to.equal(`Received ${po.received} of ${po.ordered}`);
  });

  it('MPUR-012 The new purchase order form shows its defaults and closes unchanged without asking', async () => {
    await openPurchaseOrders();
    const before = await purchaseOrdersPage.count();
    await $(purchaseOrdersPage.selectors.newButton).click();
    const f = newPurchaseOrderPage;
    await f.waitForDisplayed(15_000);
    const form = await f.read();
    await checkpoint('MPUR-012 new form');
    expect(form, 'new purchase order').to.deep.equal({
      supplier: PURCHASE_ORDER_TEXTS.noSupplier, priceBook: PURCHASE_ORDER_TEXTS.noPriceBook, warehouse: PURCHASE_ORDER_TEXTS.noWarehouse,
      draft: true, ordered: false, orderDate: `Order date: ${today()}`, delivery: PURCHASE_ORDER_TEXTS.noDelivery,
      paid: '0', terms: '', notes: '', addProduct: true, save: true,
    });
    expect(await f.cancel(), 'discard dialog on an unchanged form').to.equal(false);
    await purchaseOrdersPage.waitForDisplayed(10_000);
    await purchaseOrdersPage.waitForLoaded();
    expect(await purchaseOrdersPage.count(), 'count after Cancel').to.equal(before);
  });

  it('MPUR-013 A new line takes the product cost and offers the taxes', async () => {
    await openNewPurchaseOrder();
    const f = newPurchaseOrderPage;
    const option = await f.chooseProduct(po.productSearch, po.product);
    expect(option, 'picker option').to.match(new RegExp(`^${po.product}, ${po.productSearch}, ([0-9]+ in stock|Out of stock), ₹${po.unitCost.replace('.', '[.]')}$`));
    const line = await f.readLine();
    expect(line, 'new line').to.deep.equal({ product: `Product: ${po.product}`, name: po.product, qty: '1', cost: po.unitCost, tax: 'Tax: No tax' });
    const taxes = await f.taxOptions();
    await checkpoint('MPUR-013 new line');
    expect(taxes, 'tax options').to.deep.equal(po.taxes);
    await f.closeLineSheet();
    expect((await f.lineRows()).rows, 'lines after closing the sheet').to.deep.equal([]);
    expect(await f.cancel(), 'discard dialog without lines').to.equal(false);
  });

  it('MPUR-014 A line with an added tax totals quantity times cost plus the tax', async () => {
    await openNewPurchaseOrder();
    const f = newPurchaseOrderPage;
    const l = po.addedLine;
    await f.addLine(po.productSearch, po.product, l.qty, l.tax);
    const { rows, total } = await f.lineRows();
    await checkpoint('MPUR-014 added tax');
    expect(rows, 'line').to.deep.equal([`${po.product}, ${l.qty} x ₹${po.unitCost}, ${l.tax}, ${l.total}`]);
    expect(total, 'Lines total').to.equal(l.total);
    await f.discard();
  });

  it('MPUR-015 A line with a deducted tax subtracts the tax from the line and the lines total', async () => {
    await openNewPurchaseOrder();
    const f = newPurchaseOrderPage;
    await f.addLine(po.productSearch, po.product, po.addedLine.qty, po.addedLine.tax);
    await f.addLine(po.productSearch, po.product, po.deductedLine.qty, po.deductedLine.tax);
    const { rows, total } = await f.lineRows();
    await checkpoint('MPUR-015 deducted tax');
    await f.discard();
    expect(rows[1]?.startsWith(`${po.product}, ${po.deductedLine.qty} x ₹${po.unitCost}, ${po.deductedLine.tax}, `), `TDS line "${rows[1]}"`).to.equal(true);
    const tds = rows[1]!.split(', ').pop();
    expect({ line: tds, total }, 'TDS line 2 x 100.12 = 200.24 - 2% (4.00) and Lines total 330.40 + 196.24')
      .to.deep.equal({ line: po.deductedLine.total, total: po.linesTotal });
  });

  it('MPUR-016 A changed new purchase order asks before discarding, keeps the lines on Cancel and saves nothing on Discard', async () => {
    await openPurchaseOrders();
    const before = await purchaseOrdersPage.count();
    await $(purchaseOrdersPage.selectors.newButton).click();
    const f = newPurchaseOrderPage;
    await f.waitForDisplayed(15_000);
    await f.addLine(po.productSearch, po.product, po.addedLine.qty, po.addedLine.tax);
    const kept = await f.cancelThenKeep();
    expect(kept.message, `"${PURCHASE_ORDER_TEXTS.discardMessage}"`).to.equal(true);
    expect((await f.lineRows()).rows.length, 'lines after Cancel in the dialog').to.equal(1);
    await checkpoint('MPUR-016 kept');
    await f.discard();
    await purchaseOrdersPage.waitForDisplayed(10_000);
    await purchaseOrdersPage.waitForLoaded();
    expect(await purchaseOrdersPage.count(), 'count after Discard').to.equal(before);
  });
});
