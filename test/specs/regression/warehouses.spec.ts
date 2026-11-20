// Warehouses: status chips, search by name / code / city, the detail of three warehouses (summary fields, stock
// figures that add up from the stock rows and the movements, activity), the actions menu, the Adjust stock sheet
// (closed unchanged) and the Edit / New warehouse forms (cancelled or discarded). Nothing is saved.
import { expect } from 'chai';
import {
  warehousesPage, warehouseDetailPage, adjustStockPage, newWarehousePage, editWarehousePage,
  WAREHOUSE_STATUSES, WAREHOUSE_ACTIONS, WAREHOUSE_TEXTS, ADJUST_TYPES,
} from '../../../src/pages/WarehousesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { warehouseData as wh } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openWarehouse, openWarehouses } from '../../helpers/warehouses.js';

describe('Warehouses: list, detail, stock and forms (nothing is saved)', () => {
  requiresAccount();

  it('MWHS-002 Active and inactive counts add up to all warehouses and each chip lists its own', async () => {
    await openWarehouses();
    const p = warehousesPage;
    const all = await p.count();
    const counts: Record<string, number> = {};
    const problems: string[] = [];
    for (const s of WAREHOUSE_STATUSES) {
      counts[s] = await p.selectFilter(s);
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (counts[s] === 0 && !(await p.isEmptyStateShown(5_000))) problems.push(`${s}: 0 warehouses without "${WAREHOUSE_TEXTS.noWarehouses}"`);
      if (counts[s] > 0 && !(await p.rows()).length) problems.push(`${s}: count ${counts[s]} but no rows`);
    }
    await checkpoint('MWHS-002 last status');
    expect(problems, 'status chips').to.deep.equal([]);
    expect(counts.Active! + counts.Inactive!, `Active ${counts.Active} + Inactive ${counts.Inactive} vs All ${all}`).to.equal(all);
  });

  it('MWHS-003 Search finds warehouses by name, code or city in any letter case', async () => {
    await openWarehouses();
    const p = warehousesPage;
    await p.search(wh.search.name);
    const byName = await p.rows();
    expect(byName.map((r) => r.name), `results for "${wh.search.name}"`).to.deep.equal(wh.search.nameMatches);
    expect(await p.count(), 'count for the name').to.equal(byName.length);
    await p.search(wh.search.code);
    const byCode = await p.rows();
    expect(byCode.map((r) => `${r.name} ${r.code}`), `results for "${wh.search.code}"`).to.deep.equal([`${wh.full.name} ${wh.full.code}`]);
    await p.search(wh.search.city);
    const byCity = await p.rows();
    await checkpoint('MWHS-003 by city');
    expect(byCity.length, `results for "${wh.search.city}"`).to.be.greaterThan(0);
    // The row label holds the whole row; a row cut off at the bottom of the screen has no location text on screen.
    expect(byCity.filter((r) => !r.label.toLowerCase().includes(wh.search.city.toLowerCase())).map((r) => r.label), 'results in another city').to.deep.equal([]);
  });

  it('MWHS-004 An unknown name finds no warehouses and Clear filters restores the list', async () => {
    await openWarehouses();
    const p = warehousesPage;
    const all = await p.count();
    await p.search(wh.noMatch);
    expect(await p.isEmptyStateShown(), `"${WAREHOUSE_TEXTS.noWarehouses}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${WAREHOUSE_TEXTS.noWarehousesHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MWHS-004 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(WAREHOUSE_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MWHS-005 The warehouse detail shows its name, code, address and status as on the list', async function () {
    const row = await openWarehouse(this, wh.full.name);
    const d = warehouseDetailPage;
    await checkpoint('MWHS-005 detail');
    expect({ code: row.code, location: row.location }, 'list row').to.deep.equal({ code: wh.full.code, location: wh.full.location });
    expect({ name: await d.text(d.selectors.name), code: await d.text(d.selectors.code), status: await d.text(d.selectors.status) }, 'header')
      .to.deep.equal({ name: wh.full.name, code: wh.full.code, status: 'Active' });
    const summary = { name: await d.field('Warehouse name'), code: await d.field('Code'), address: await d.field('Address'), status: await d.field('Status') };
    expect(summary, 'SUMMARY').to.deep.equal({ name: wh.full.name, code: wh.full.code, address: wh.full.address, status: 'Active' });
    for (const f of ['Created', 'Updated']) expect(await d.field(f), f).to.match(/^[0-9]{1,2} [A-Z][a-z]{2} [0-9]{4}$/);
    expect(await d.tabLabels(), 'tabs').to.deep.equal(['Summary', 'Stock', 'Movements', 'Activity']);
    await d.goBack();
    await warehousesPage.waitForDisplayed();
    expect((await warehousesPage.rows()).map((r) => r.name), 'list after Back').to.include(wh.full.name);
  });

  it('MWHS-006 The stock figures of a warehouse add up from its stock rows', async function () {
    await openWarehouse(this, wh.stocked);
    const d = warehouseDetailPage;
    const header = { inStock: await d.stat('In stock'), units: await d.stat('Units on hand'), low: await d.stat('Low stock') };
    const tab = (await d.tabLabels())[1];
    await d.openTab('Stock');
    const rows = await d.stockRows();
    await checkpoint('MWHS-006 stock');
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(tab, 'Stock tab count').to.equal(`Stock, ${rows.length}`);
    expect(Number(await d.text(d.selectors.stockCount)), 'STOCK count').to.equal(rows.length);
    expect(header.units, `Units on hand vs ${rows.map((r) => r.qty).join(' + ')}`).to.equal(rows.reduce((s, r) => s + r.qty, 0));
    expect(header.inStock, 'In stock vs products with stock').to.equal(rows.filter((r) => r.qty > 0).length);
    const low = await d.lowStockRows();
    expect(low.count, 'Low stock chip vs Low stock figure').to.equal(header.low);
    if (header.low === 0) expect(low.empty, `"${WAREHOUSE_TEXTS.noProducts}"`).to.equal(true);
  });

  it('MWHS-007 The movements of a warehouse add up to the stock of each product', async function () {
    await openWarehouse(this, wh.stocked);
    const d = warehouseDetailPage;
    await d.openTab('Stock');
    const stock = await d.stockRows();
    await d.openTab('Movements');
    const moves = await d.movements();
    await checkpoint('MWHS-007 movements');
    expect(moves.length, 'movements').to.be.greaterThan(0);
    const wrongDirection = moves.filter((m) => (m.qty > 0 && m.direction === 'Outbound') || (m.qty < 0 && m.direction === 'Inbound')).map((m) => m.label);
    expect(wrongDirection, 'movements whose sign and direction disagree').to.deep.equal([]);
    const net = new Map<string, number>();
    for (const m of moves) net.set(m.product, (net.get(m.product) ?? 0) + m.qty);
    const differ = stock.filter((r) => (net.get(r.product) ?? 0) !== r.qty).map((r) => `${r.product}: stock ${r.qty}, movements ${net.get(r.product) ?? 0}`);
    expect(differ, 'stock vs the sum of its movements').to.deep.equal([]);
    expect([...net.keys()].filter((p) => !stock.some((r) => r.product === p)), 'moved products missing from Stock').to.deep.equal([]);
  });

  it('MWHS-008 A reversed stock receipt shows both movements and leaves no stock', async function () {
    await openWarehouse(this, wh.qa.name);
    const d = warehouseDetailPage;
    expect(await d.field('Assigned to'), 'Assigned to (the account display name)').to.match(wh.qa.owner);
    expect({ inStock: await d.stat('In stock'), units: await d.stat('Units on hand') }, 'stock figures').to.deep.equal({ inStock: 0, units: 0 });
    await d.openTab('Stock');
    expect((await d.stockRows()).map((r) => `${r.product} ${r.qty}`), 'stock').to.deep.equal([`${wh.qa.product} 0`]);
    await d.openTab('Movements');
    const moves = (await d.movements()).filter((m) => m.detail.startsWith(`${wh.qa.grn}, `));
    await checkpoint('MWHS-008 movements');
    expect(moves.map((m) => `${m.product} ${m.qty} ${m.direction} ${m.detail.split(', ')[1]}`).sort(), `${wh.qa.grn} movements`).to.deep.equal([
      `${wh.qa.product} ${-wh.qa.qty} Outbound Stock receipt reversed`, `${wh.qa.product} ${wh.qa.qty} Inbound Stock receipt`].sort());
    await d.openTab('Activity');
    const activity = await d.activity();
    expect(activity.entries.length, 'ACTIVITY count vs entries').to.equal(activity.count);
    expect(activity.entries.some((e) => e.startsWith(`Warehouse "${wh.qa.name}" created, `)), 'created entry').to.equal(true);
  });

  it('MWHS-009 The actions menu offers edit, adjust, PDF and delete and blocks deleting a warehouse in use', async function () {
    await openWarehouse(this, wh.qa.name);
    const d = warehouseDetailPage;
    const options = await d.actionOptions();
    await checkpoint('MWHS-009 closed');
    expect(options.map((o) => o.label), 'Warehouse actions').to.deep.equal([...WAREHOUSE_ACTIONS.slice(0, 4), `Delete, ${wh.deleteBlocked}`]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label.split(',')[0]), 'disabled actions').to.deep.equal(['Delete']);
    expect(await d.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });

  it('MWHS-010 Adjust stock offers the product stock, the types and closes without a change', async function () {
    await openWarehouse(this, wh.qa.name);
    const d = warehouseDetailPage;
    await d.openAction('Adjust stock');
    await adjustStockPage.chooseProduct(wh.qa.productSearch, wh.qa.product);
    const sheet = await adjustStockPage.read();
    await checkpoint('MWHS-010 adjust stock');
    expect(sheet, 'Adjust stock').to.deep.equal({
      product: wh.qa.product, stockNow: `0 in stock now at ${wh.qa.name}`, warehouse: `Warehouse: ${wh.qa.name}`,
      types: Object.fromEntries(ADJUST_TYPES.map((t) => [t, t === 'Inbound (+)'])), quantity: '0', reference: WAREHOUSE_TEXTS.referenceHint, save: true,
    });
    await adjustStockPage.close();
    await d.waitForDisplayed(10_000);
    await d.openTab('Stock');
    expect((await d.stockRows()).map((r) => `${r.product} ${r.qty}`), 'stock after Close').to.deep.equal([`${wh.qa.product} 0`]);
  });

  it('MWHS-011 The edit form shows the saved values and cancels unchanged without asking', async function () {
    await openWarehouse(this, wh.full.name);
    await warehouseDetailPage.openAction('Edit');
    const f = editWarehousePage;
    await f.waitForDisplayed(10_000);
    const form = await f.read();
    await checkpoint('MWHS-011 edit');
    expect(form, 'Edit warehouse').to.deep.equal({ name: wh.full.name, code: wh.full.code, owner: wh.full.owner, active: true,
      street: wh.full.street, city: wh.full.city, state: wh.full.state, country: wh.full.country, save: true });
    expect(await f.cancel(), 'discard dialog on an unchanged form').to.equal(false);
    await warehouseDetailPage.waitForDisplayed(10_000);
    expect(await warehouseDetailPage.field('Warehouse name'), 'detail after Cancel').to.equal(wh.full.name);
  });

  it('MWHS-012 The new warehouse form shows its defaults and closes unchanged without asking', async () => {
    await openWarehouses();
    const before = await warehousesPage.count();
    await $(warehousesPage.selectors.newButton).click();
    const f = newWarehousePage;
    await f.waitForDisplayed(15_000);
    const form = await f.read();
    await checkpoint('MWHS-012 new form');
    expect(form, 'New warehouse').to.deep.equal({ name: WAREHOUSE_TEXTS.nameHint, code: WAREHOUSE_TEXTS.codeHint, owner: 'Assigned to: Me', active: true,
      street: '', city: '', state: '', country: '', save: true });
    expect(await f.cancel(), 'discard dialog on an unchanged form').to.equal(false);
    await warehousesPage.waitForDisplayed(10_000);
    await warehousesPage.waitForLoaded();
    expect(await warehousesPage.count(), 'count after Cancel').to.equal(before);
  });

  it('MWHS-013 A changed new warehouse asks before discarding, keeps the input on Cancel and saves nothing on Discard', async () => {
    await openWarehouses();
    const before = await warehousesPage.count();
    await $(warehousesPage.selectors.newButton).click();
    const f = newWarehousePage;
    await f.waitForDisplayed(15_000);
    await f.setName(wh.formName);
    const kept = await f.cancelThenKeep();
    expect(kept.message, `"${WAREHOUSE_TEXTS.discardMessage}"`).to.equal(true);
    expect((await f.read()).name, 'name after Cancel in the dialog').to.equal(wh.formName);
    await checkpoint('MWHS-013 kept');
    await f.discard();
    await warehousesPage.waitForDisplayed(10_000);
    await warehousesPage.waitForLoaded();
    expect(await warehousesPage.count(), 'count after Discard').to.equal(before);
    await warehousesPage.search(wh.formName);
    expect(await warehousesPage.isEmptyStateShown(), `"${wh.formName}" not saved`).to.equal(true);
  });
});
