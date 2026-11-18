// Products, the whole screen: status and category filters, search, the QA product QA-TEST Gadget R3 with every tab
// (summary figures, stock by warehouse, variants, details, related purchase orders, stock movements), the actions
// menu (Delete blocked while in stock) and status picker (opened and closed), and the New product form (filled and
// discarded). Save, Scan barcode, Adjust stock, every menu action and every status are never chosen.
import { expect } from 'chai';
import { productsPage, productDetailPage, newProductPage, PRODUCT_STATUSES, PRODUCT_ACTIONS, PRODUCT_TEXTS } from '../../../src/pages/ProductsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { productData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openProduct, openProducts } from '../../helpers/products.js';

const openQaProduct = (ctx: Mocha.Context) => openProduct(ctx, productData.sku, productData.name);

describe('Products: filters, search, detail tabs, actions and the new product form (nothing is saved)', () => {
  requiresAccount();

  it('MPRD-002 Active and Inactive counts add up to all products and each shows only its status', async () => {
    await openProducts();
    const p = productsPage;
    const all = await p.count();
    const problems: string[] = [];
    let sum = 0;
    const counts: string[] = [];
    for (const s of PRODUCT_STATUSES) {
      const n = await p.selectFilter(s);
      sum += n; counts.push(`${s} ${n}`);
      const rows = await p.productRows();
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      // Inactive products show "Inactive" where active ones show their stock.
      const wrong = rows.filter((r) => (s === 'Inactive') !== (r.stock === 'Inactive')).map((r) => `${r.name} (${r.stock})`);
      if (wrong.length) problems.push(`${s}: ${wrong.join(', ')}`);
    }
    await checkpoint('MPRD-002 last status');
    expect(problems, `status filters: ${problems.join('; ')}`).to.deep.equal([]);
    expect(sum, `${counts.join(' + ')} vs All ${all}`).to.equal(all);
  });

  it('MPRD-003 The category filter narrows the list to that category and Clear restores all products', async () => {
    await openProducts();
    const p = productsPage;
    const all = await p.count();
    const n = await p.selectCategory(productData.category);
    const rows = await p.productRows();
    await checkpoint('MPRD-003 category');
    const after = await p.clearCategory(productData.category);
    expect(n, `${productData.category} count`).to.be.within(1, all - 1);
    expect(rows.length, 'rows in the category').to.be.greaterThan(0);
    expect(rows.filter((r) => r.code && r.code !== productData.category && !r.code.includes(productData.category)).map((r) => `${r.name}: ${r.code}`),
      'rows showing another category').to.deep.equal([]);
    expect(after, 'count after clearing the category').to.equal(all);
  });

  it('MPRD-004 Search finds products by name and SKU in any letter case', async () => {
    await openProducts();
    const p = productsPage;
    const misses: string[] = [];
    for (const term of [productData.sku.toLowerCase(), productData.name.toUpperCase()]) {
      await p.search(term);
      const rows = await p.productRows();
      if (!rows.some((r) => r.name === productData.name)) misses.push(`${term}: ${productData.name} missing`);
      const unrelated = rows.filter((r) => !`${r.name} ${r.code}`.toLowerCase().includes(term.toLowerCase())).map((r) => r.name);
      if (unrelated.length) misses.push(`${term}: ${unrelated.join(', ')}`);
    }
    await checkpoint('MPRD-004 last search');
    expect(misses, 'searches').to.deep.equal([]);
  });

  it('MPRD-005 An unknown word finds no products and Clear filters restores the list', async () => {
    await openProducts();
    const p = productsPage;
    const all = await p.count();
    await p.search(productData.noMatch);
    expect(await p.isEmptyStateShown(), `"${PRODUCT_TEXTS.noResults}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${PRODUCT_TEXTS.noResultsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MPRD-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(PRODUCT_TEXTS.searchHint);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MPRD-006 The product detail shows its name, SKU, status, price and stock figures as on the list', async function () {
    const row = await openQaProduct(this);
    const d = productDetailPage;
    const got = { name: await d.text(d.product.name), sku: await d.text(d.product.sku), price: await d.text(d.product.price),
      status: ((await $(d.product.statusButton).getAttribute('content-desc')) ?? '') };
    const f = { onHand: await d.figure('On hand'), reserved: await d.figure('Reserved'), available: await d.figure('Available'), committed: await d.figure('Committed') };
    await checkpoint('MPRD-006 detail');
    expect(got, 'header').to.deep.equal({ name: row.name, sku: row.code, price: row.price, status: 'Status: Active. Change status' });
    expect(row.stock, 'list stock').to.equal(`${f.onHand} in stock`);
    expect(f.available, 'Available = On hand - Reserved').to.equal(f.onHand - f.reserved);
    if (f.onHand <= productData.reorderLevel) expect(await d.text(d.product.reorderWarning), 'reorder warning').to.equal(PRODUCT_TEXTS.reorderWarning(productData.reorderLevel));
    await d.goBack();
    await productsPage.waitForDisplayed();
    expect((await productsPage.productRows()).map((r) => r.name), 'list after Back').to.include(row.name);
  });

  it('MPRD-007 The summary tab lists number, SKU, prices, tax, stock, vendor and owner', async function () {
    await openQaProduct(this);
    const d = productDetailPage;
    const got = { number: await d.field('Product number'), sku: await d.field('SKU'), unitPrice: await d.field('Unit price'), costPrice: await d.field('Cost price'),
      taxRate: await d.field('Tax rate'), qty: await d.field('Qty in stock'), vendor: await d.field('Vendor'), owner: await d.field('Assigned to') };
    await checkpoint('MPRD-007 summary');
    expect({ ...got, owner: got.owner ? 'set' : '' }, 'SUMMARY').to.deep.equal({ number: productData.number, sku: productData.sku, unitPrice: productData.price,
      costPrice: productData.costPrice, taxRate: productData.taxRate, qty: String(productData.onHand), vendor: productData.vendor, owner: 'set' });
  });

  it('MPRD-008 The stock tab lists each warehouse and they add up to the stock on hand', async function () {
    await openQaProduct(this);
    const d = productDetailPage;
    const onHand = await d.figure('On hand');
    await d.openTab('Stock');
    const tabLabel = (await $(d.product.tab('Stock')).getAttribute('content-desc')) ?? '';
    const rows = await d.describedRows(2);
    await checkpoint('MPRD-008 stock');
    const warehouses = Object.fromEntries(rows.map((r) => { const i = r.lastIndexOf(', '); return [r.slice(0, i), Number(r.slice(i + 2))]; }));
    expect(await $(d.product.adjustStock).isExisting(), 'Adjust stock (not tapped)').to.equal(true);
    expect(warehouses, 'STOCK BY WAREHOUSE').to.deep.equal(productData.warehouses);
    expect(tabLabel, 'Stock tab count').to.equal(`Stock, ${rows.length}`);
    expect(Object.values(warehouses).reduce((s, n) => s + n, 0), 'warehouses vs On hand').to.equal(onHand);
  });

  it('MPRD-009 Variants, details and related tabs show their content and the purchase orders of the product', async function () {
    await openQaProduct(this);
    const d = productDetailPage;
    await d.openTab('Variants');
    const variants = { count: await d.text(d.product.sectionCount('VARIANTS')), empty: await $(d.product.noVariants).isExisting() };
    await d.openTab('Details');
    const details = { sales: await $(d.product.section('SALES AND PURCHASING')).isExisting(), commission: await d.field('Commission rate') };
    await d.toTop();
    await d.openTab('Related');
    const pos: string[] = [];
    for (const el of await $$(d.product.purchaseOrders)) pos.push((await el.getAttribute('content-desc')) ?? '');
    await checkpoint('MPRD-009 related');
    expect(variants, 'Variants').to.deep.equal({ count: '0', empty: true });
    expect(details.sales, 'SALES AND PURCHASING').to.equal(true);
    expect(details.commission, 'Commission rate').to.match(/^[0-9.]+%$/);
    expect(pos.length, 'PURCHASE ORDERS').to.be.greaterThan(0);
    expect(pos.filter((p) => !/^PO-[0-9]+, ₹[0-9,.]+, Qty [0-9]+, [0-9]{1,2} [A-Z][a-z]{2}, .+$/.test(p)), 'purchase order rows').to.deep.equal([]);
  });

  it('MPRD-010 The activity tab lists stock movements that add up to the stock by warehouse', async function () {
    await openQaProduct(this);
    const d = productDetailPage;
    await d.openTab('Activity');
    const count = Number(await d.text(d.product.sectionCount('STOCK MOVEMENTS')));
    // Movement rows only: "warehouse, ±qty, reference, date, direction" (the stock log below has another format).
    const moves = (await d.describedRows()).filter((m) => /^.+, [+-][0-9]+, .+, [0-9]{1,2} [A-Z][a-z]{2}, [A-Za-z ]+$/.test(m));
    await checkpoint('MPRD-010 movements');
    const net: Record<string, number> = {};
    for (const m of moves) { const [wh, qty] = m.split(', '); net[wh!] = (net[wh!] ?? 0) + Number(qty); }
    expect(moves.length, `movements vs STOCK MOVEMENTS ${count}`).to.equal(count);
    expect(Object.fromEntries(Object.keys(productData.warehouses).map((w) => [w, net[w] ?? 0])), `net movements per warehouse: ${moves.join(' | ')}`).to.deep.equal(productData.warehouses);
  });

  it('MPRD-011 The actions menu offers its actions and blocks Delete while the product has stock', async function () {
    await openQaProduct(this);
    const options = await productDetailPage.actionOptions(PRODUCT_ACTIONS);
    await checkpoint('MPRD-011 closed');
    expect(options.map((o) => o.label), 'Product actions').to.deep.equal([...PRODUCT_ACTIONS.slice(0, -1), `Delete, ${PRODUCT_TEXTS.deleteBlocked}`]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled').to.deep.equal([`Delete, ${PRODUCT_TEXTS.deleteBlocked}`]);
    expect(await productDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });

  it('MPRD-012 The status picker lists Active and Inactive with the current one selected and closes without a change', async function () {
    await openQaProduct(this);
    const d = productDetailPage;
    const options = await d.statusOptions();
    await checkpoint('MPRD-012 closed');
    expect(options, 'Status').to.deep.equal([{ label: 'Active', selected: true }, { label: 'Inactive', selected: false }]);
    expect(await $(d.product.statusButton).getAttribute('content-desc'), 'status after closing').to.equal('Status: Active. Change status');
  });

  it('MPRD-013 The new product form shows its defaults, keeps only digits in the barcode and discards without saving', async () => {
    await openProducts();
    const all = await productsPage.count();
    await $(productsPage.selectors.newButton).click();
    const f = newProductPage;
    await f.waitForDisplayed(15_000);
    // Read top to bottom; each read scrolls the field into view with UiScrollable.
    const defaults = { name: await f.inputText('Product name'), barcodeHint: await f.hasText(PRODUCT_TEXTS.barcodeHint), category: await f.pickerText('Category: '),
      price: await f.inputText('Price'), cost: await f.inputText('Cost price'), opening: await f.inputText('Opening stock'),
      warehouse: await f.pickerText('Warehouse: '), supplier: await f.pickerText('Supplier: '), owner: await f.pickerText('Assigned to: ') };
    const sections: string[] = [];
    for (const s of ['DETAILS', 'SALES AND PURCHASING', 'PHYSICAL', 'PHOTOS']) if (await f.hasText(s)) sections.push(s);
    await f.intoView('descriptionStartsWith("Category: ")');
    const categories = await f.pickerOptions(f.selectors.category, 'Category');
    const barcodeField = await f.intoView('description("Barcode")');
    await barcodeField.click();
    await barcodeField.setValue(productData.barcodeTyped);
    await f.hideKeyboard();
    const barcode = await f.inputText('Barcode');
    await checkpoint('MPRD-013 form');
    const dialog = await f.discard();
    await productsPage.waitForDisplayed(20_000);
    await productsPage.waitForLoaded();
    expect(defaults, `defaults ${JSON.stringify(defaults)}`).to.deep.equal({ name: '', barcodeHint: true, category: 'Category: No category', price: '0', cost: '0', opening: '0',
      warehouse: 'Warehouse: No warehouse', supplier: 'Supplier: No supplier', owner: 'Assigned to: Me' });
    expect(sections, 'form sections').to.deep.equal(['DETAILS', 'SALES AND PURCHASING', 'PHYSICAL', 'PHOTOS']);
    expect(categories, 'categories').to.include(productData.category);
    expect(barcode, `barcode after typing "${productData.barcodeTyped}"`).to.equal(productData.barcodeKept);
    expect(dialog, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(await productsPage.count(), 'count after Discard (nothing saved)').to.equal(all);
  });
});
