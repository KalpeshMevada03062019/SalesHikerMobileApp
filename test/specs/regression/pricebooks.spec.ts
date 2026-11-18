// Price books, the whole screen: status chips and their counts, search, the price book "SalesHiker Pricebook 1"
// (header, details, prices, the Edit price and Add price sheets with the product picker, customers), the price
// count of every book, the actions menu, the Edit form (cancelled unchanged) and the New price book form
// (discarded). Save, Remove price, Add organization, Add contact and the other menu actions are never chosen.
import { expect } from 'chai';
import { priceBooksPage, priceBookDetailPage, newPriceBookPage, editPriceBookPage, PRICE_BOOK_STATUSES, PRICE_BOOK_ACTIONS,
  PRICE_BOOK_TEXTS } from '../../../src/pages/PriceBooksPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { priceBookData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openPriceBook, openPriceBooks } from '../../helpers/pricebooks.js';

const openReference = (ctx: Mocha.Context) => openPriceBook(ctx, priceBookData.name);
const when = /^[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?, [0-9]{1,2}:[0-9]{2} [AP]M$/;

describe('Price books: chips, search, detail tabs, price sheets, actions and forms (nothing is saved)', () => {
  requiresAccount();

  it('MPBK-002 The status chips count all, active and inactive books and each lists its own', async () => {
    await openPriceBooks();
    const p = priceBooksPage;
    const all = await p.count();
    const chips = await p.chipCounts();
    const listed: Record<string, number> = {};
    const problems: string[] = [];
    for (const s of PRICE_BOOK_STATUSES) {
      listed[s] = await p.selectChip(s);
      if (listed[s] !== chips[s]) problems.push(`${s}: chip ${chips[s]} vs "${listed[s]} price books"`);
      if (listed[s] === 0 && !(await p.isEmptyStateShown())) problems.push(`${s}: 0 without "${PRICE_BOOK_TEXTS.noResults}"`);
      if (listed[s] === 0 && !(await $(p.selectors.noResultsHint).isExisting())) problems.push(`${s}: no "${PRICE_BOOK_TEXTS.noResultsHint}"`);
    }
    await checkpoint('MPBK-002 last status');
    expect(problems, problems.join('; ')).to.deep.equal([]);
    expect(chips.All, 'All chip').to.equal(all);
    expect(chips.Active! + chips.Inactive!, `Active ${chips.Active} + Inactive ${chips.Inactive} vs All ${all}`).to.equal(all);
  });

  it('MPBK-003 Search finds price books in any letter case and the chip counts follow the search', async () => {
    await openPriceBooks();
    const p = priceBooksPage;
    await p.search(priceBookData.search);
    const names = (await p.rowsOnScreen()).map((r) => r.name);
    const count = await p.count();
    const chips = await p.chipCounts();
    await checkpoint('MPBK-003 search');
    expect(names, `"${priceBookData.search}"`).to.deep.equal(priceBookData.searchMatches);
    expect(count, 'count').to.equal(names.length);
    expect(chips.All, 'All chip during the search').to.equal(count);
    expect(chips.Active! + chips.Inactive!, 'Active + Inactive during the search').to.equal(count);
  });

  it('MPBK-004 An unknown name finds no price books and Clear filters restores the list', async () => {
    await openPriceBooks();
    const p = priceBooksPage;
    const all = await p.count();
    await p.search(priceBookData.noMatch);
    expect(await p.isEmptyStateShown(), `"${PRICE_BOOK_TEXTS.noResults}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${PRICE_BOOK_TEXTS.noResultsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MPBK-004 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(PRICE_BOOK_TEXTS.searchHint);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MPBK-005 The price book detail shows its name, currency, status and details as on the list', async function () {
    const row = await openReference(this);
    const d = priceBookDetailPage;
    const header = { name: await d.text(d.selectors.name), currency: await d.text(d.selectors.currency), status: await d.text(d.selectors.status) };
    const prices = await d.tabLabel('Prices');
    await d.openTab('Details');
    const details = { currency: await d.field('Currency'), status: await d.field('Status'), default: await d.field('Default'), vendor: await d.field('Vendor'),
      products: await d.field('Products') };
    const created = await d.field('Created');
    const updated = await d.field('Updated');
    const notes = await d.text(d.selectors.notes);
    await checkpoint('MPBK-005 details');
    expect(header, 'header').to.deep.equal({ name: row.name, currency: priceBookData.currency, status: 'Active' });
    expect(row.info, 'list row').to.equal(`${priceBookData.currency}, ${row.prices} price${row.prices === 1 ? '' : 's'}, ${priceBookData.vendor}`);
    expect(prices, 'Prices tab').to.equal(`Prices, ${row.prices}`);
    expect(details, 'DETAILS').to.deep.equal({ currency: priceBookData.currency, status: 'Active', default: 'No', vendor: priceBookData.vendor, products: String(row.prices) });
    expect(created, 'Created').to.match(when);
    expect(updated, 'Updated').to.match(when);
    expect(notes, 'NOTES').to.equal(priceBookData.notes);
  });

  it('MPBK-006 Each price book on the list has as many prices as its prices tab shows', async () => {
    await openPriceBooks();
    const p = priceBooksPage;
    const rows = await p.rowsOnScreen();
    const problems: string[] = [];
    for (const row of rows) {
      await p.open(row.label);
      await priceBookDetailPage.waitForDisplayed(30_000);
      const tab = await priceBookDetailPage.tabLabel('Prices');
      const listed = (await priceBookDetailPage.priceLabels()).length;
      // The tab shows no count when the book has no prices ("Prices").
      if (tab !== (row.prices ? `Prices, ${row.prices}` : 'Prices') || listed !== row.prices) problems.push(`${row.name}: list ${row.prices}, tab "${tab}", rows ${listed}`);
      await priceBookDetailPage.goBack();
      await p.waitForDisplayed(15_000);
    }
    await checkpoint('MPBK-006 list');
    expect(rows.length, 'books checked').to.be.greaterThan(0);
    expect(problems, problems.join('; ')).to.deep.equal([]);
  });

  it('MPBK-007 A price opens its edit sheet with the saved price and cost and closes unchanged', async function () {
    await openReference(this);
    const d = priceBookDetailPage;
    const rows = await d.priceLabels();
    const count = Number(await d.text(d.selectors.sectionCount('PRICES')));
    const sheet = await d.readEditPrice(priceBookData.priceProduct);
    await checkpoint('MPBK-007 closed');
    const after = await d.priceLabels();
    expect(rows.length, `rows vs PRICES ${count}`).to.equal(count);
    expect(rows.some((r) => priceBookData.priceRow.test(r)), `price row in ${rows.join(' | ')}`).to.equal(true);
    expect({ ...sheet, product: sheet.product.startsWith(priceBookData.priceProduct) }, 'Edit price').to.deep.equal({ title: 'Edit price',
      subtitle: `${priceBookData.name}, ${priceBookData.currency}`, product: true, unitPrice: priceBookData.unitPrice, cost: priceBookData.cost, save: true, remove: true });
    expect(after, 'prices after closing').to.deep.equal(rows);
  });

  it('MPBK-008 Add price offers the products in the book currency and closes without adding a price', async function () {
    await openReference(this);
    const d = priceBookDetailPage;
    const before = await d.priceLabels();
    const { sheet, qtyHint, options } = await d.readAddPrice(priceBookData.pickerProduct);
    await checkpoint('MPBK-008 closed');
    const label = await d.text(d.selectors.unitPriceLabel).catch(() => '');
    expect({ title: sheet.title, subtitle: sheet.subtitle, product: sheet.product, save: sheet.save, remove: sheet.remove }, 'Add price').to.deep.equal({ title: 'Add price',
      subtitle: `${priceBookData.name}, ${priceBookData.currency}`, product: PRICE_BOOK_TEXTS.chooseProduct, save: true, remove: false });
    expect(qtyHint, `"${PRICE_BOOK_TEXTS.qtyHint}"`).to.equal(true);
    expect(options, `products for "${priceBookData.pickerProduct}"`).to.include(priceBookData.pickerOption);
    expect(label, 'sheet closed').to.equal('');
    expect(await d.priceLabels(), 'prices after closing').to.deep.equal(before);
  });

  it('MPBK-009 The customers tab lists the organizations and contacts that use the book', async function () {
    await openReference(this);
    const d = priceBookDetailPage;
    await d.openTab('Customers');
    const got = { organizations: await d.text(d.selectors.sectionCount('ORGANIZATIONS')), contacts: await d.text(d.selectors.sectionCount('CONTACTS')),
      addOrganization: await $(d.selectors.addOrganization).isExisting(), addContact: await $(d.selectors.addContact).isExisting() };
    const empty = { organizations: await $(d.selectors.noOrganizations).isExisting(), contacts: await $(d.selectors.noContacts).isExisting() };
    await checkpoint('MPBK-009 customers');
    expect({ addOrganization: got.addOrganization, addContact: got.addContact }, 'buttons (not tapped)').to.deep.equal({ addOrganization: true, addContact: true });
    expect(got.organizations, 'ORGANIZATIONS count').to.match(/^[0-9]+$/);
    expect(got.contacts, 'CONTACTS count').to.match(/^[0-9]+$/);
    expect(empty.organizations, `"${PRICE_BOOK_TEXTS.noOrganizations}" exactly when 0`).to.equal(got.organizations === '0');
    expect(empty.contacts, `"${PRICE_BOOK_TEXTS.noContacts}" exactly when 0`).to.equal(got.contacts === '0');
  });

  it('MPBK-010 The actions menu offers edit, status, PDF and delete actions and closes without a change', async function () {
    await openReference(this);
    const d = priceBookDetailPage;
    const options = await d.actionOptions(PRICE_BOOK_ACTIONS);
    await checkpoint('MPBK-010 closed');
    expect(options.map((o) => o.label), 'Price book actions').to.deep.equal([...PRICE_BOOK_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled').to.deep.equal([]);
    expect(await d.text(d.selectors.status), 'status after closing').to.equal('Active');
  });

  it('MPBK-011 The edit form shows the saved values and the currencies and cancels unchanged', async function () {
    await openReference(this);
    await priceBookDetailPage.openEdit();
    const f = editPriceBookPage;
    await f.waitForDisplayed(15_000);
    const got = await f.read();
    const currencies = await f.pickerOptions('Currency');
    await checkpoint('MPBK-011 edit form');
    const after = await f.read();
    const dialog = await f.cancel();
    expect(got, 'edit form').to.deep.equal({ name: priceBookData.name, currency: `Currency: ${priceBookData.currencyOption}`, vendor: `Vendor: ${priceBookData.vendor}`,
      notes: priceBookData.notes, active: true, workspaceDefault: false, hints: true });
    expect(currencies.length, 'currencies').to.be.greaterThan(5);
    expect(currencies.filter((c) => !/^[A-Z]{3}, .+$/.test(c)), 'currency options "XXX, name"').to.deep.equal([]);
    expect(after, 'form after closing the picker').to.deep.equal(got);
    expect(dialog, 'discard dialog on an unchanged form').to.equal(false);
    expect(await priceBookDetailPage.isDisplayed(15_000), 'detail after Cancel').to.equal(true);
  });

  it('MPBK-012 The new price book form shows its defaults and the suppliers and closes unchanged without asking', async () => {
    await openPriceBooks();
    const all = await priceBooksPage.count();
    await $(priceBooksPage.selectors.newButton).click();
    const f = newPriceBookPage;
    await f.waitForDisplayed(15_000);
    const got = await f.read();
    const vendors = await f.pickerOptions('Vendor');
    await checkpoint('MPBK-012 new form');
    const dialog = await f.cancel();
    await priceBooksPage.waitForDisplayed(20_000);
    await priceBooksPage.waitForLoaded();
    // An empty name reads as its hint "For example Wholesale".
    expect({ ...got, name: got.name === PRICE_BOOK_TEXTS.nameHint ? '' : got.name }, 'defaults').to.deep.equal({ name: '', currency: priceBookData.defaultCurrency,
      vendor: 'Vendor: No supplier', notes: '', active: true, workspaceDefault: false, hints: true });
    expect(vendors, 'suppliers').to.include(priceBookData.pickerVendor);
    expect(dialog, 'discard dialog on an unchanged form').to.equal(false);
    expect(await priceBooksPage.count(), 'count after Cancel').to.equal(all);
  });

  it('MPBK-013 A changed new price book asks before discarding, keeps the input on Cancel and saves nothing on Discard', async () => {
    await openPriceBooks();
    const all = await priceBooksPage.count();
    await $(priceBooksPage.selectors.newButton).click();
    const f = newPriceBookPage;
    await f.waitForDisplayed(15_000);
    await f.setName(priceBookData.formName);
    const kept = await f.cancelThenKeep();
    const name = (await f.read()).name;
    await checkpoint('MPBK-013 kept after Cancel');
    const dialog = await f.discard();
    await priceBooksPage.waitForDisplayed(20_000);
    await priceBooksPage.waitForLoaded();
    expect(kept, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(name, 'name after Cancel on the dialog').to.equal(priceBookData.formName);
    expect(dialog, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(await priceBooksPage.count(), 'count after Discard (nothing saved)').to.equal(all);
    await priceBooksPage.search(priceBookData.formName);
    expect(await priceBooksPage.isEmptyStateShown(), `"${priceBookData.formName}" not saved`).to.equal(true);
  });
});
