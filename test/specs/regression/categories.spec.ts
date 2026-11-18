// Categories, the whole screen: the full list, search and the empty state, the category BEVERAGES (header, product
// count and its products, sub-categories, details), the actions menu, Edit and Rename (opened and closed unchanged),
// the New category form (filled and discarded) and the list order against the sort order. Save, View PDF, Save PDF
// and Delete are never chosen.
import { expect } from 'chai';
import { categoriesPage, categoryDetailPage, newCategoryPage, editCategoryPage, CATEGORY_ACTIONS, CATEGORY_TEXTS } from '../../../src/pages/CategoriesPage.js';
import { productsPage } from '../../../src/pages/ProductsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { categoryData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCategories, openCategory } from '../../helpers/categories.js';

const openBeverages = (ctx: Mocha.Context) => openCategory(ctx, categoryData.name);

describe('Categories: list, search, detail, actions, forms and sort order (nothing is saved)', () => {
  requiresAccount();

  it('MCAT-002 Scrolling the list shows every category once, as many as the count', async () => {
    await openCategories();
    const p = categoriesPage;
    const count = await p.count();
    const names = await p.allNames();
    await checkpoint('MCAT-002 list');
    expect(names.length, `names vs "${count} categories"`).to.equal(count);
    expect(names.filter((n, i) => names.indexOf(n) !== i), 'duplicates').to.deep.equal([]);
    expect(await p.endOfListText().catch(() => ''), 'end of list').to.satisfy((t: string) => t === '' || t === `End of list. ${count} categories.`);
    for (const n of categoryData.always) expect(names, n).to.include(n);
  });

  it('MCAT-003 Search finds categories by part of the name in any letter case', async () => {
    await openCategories();
    const p = categoriesPage;
    await p.search(categoryData.search);
    const names = await p.visibleNames();
    const count = await p.count();
    await checkpoint('MCAT-003 search');
    expect(names, `"${categoryData.search}"`).to.deep.equal(categoryData.searchMatches);
    expect(count, 'count').to.equal(names.length);
    expect(await p.endOfListText(), 'end of list').to.equal(`End of list. ${count} categories.`);
  });

  it('MCAT-004 An unknown name finds no categories and Clear search restores the list', async () => {
    await openCategories();
    const p = categoriesPage;
    const all = await p.count();
    await p.search(categoryData.noMatch);
    expect(await p.isEmptyStateShown(), `"${CATEGORY_TEXTS.noResults}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${CATEGORY_TEXTS.noResultsHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MCAT-004 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear search').to.equal(CATEGORY_TEXTS.searchHint);
    expect(await p.count(), 'count after Clear search').to.equal(all);
  });

  it('MCAT-005 The category detail shows its name, status, product count, sub-categories and details', async function () {
    await openBeverages(this);
    const d = categoryDetailPage;
    const got = { name: await d.text(d.selectors.name), status: await d.text(d.selectors.status), subCount: await d.text(d.selectors.count('SUB-CATEGORIES')),
      noSub: await $(d.selectors.noSubCategories).isExisting(), sortOrder: await d.field('Sort order') };
    const products = Number(await d.text(d.selectors.count('PRODUCTS')));
    const view = await d.viewProductsLabel();
    const created = await d.field('Created');
    const updated = await d.field('Updated');
    await checkpoint('MCAT-005 detail');
    expect(got, 'detail').to.deep.equal({ name: categoryData.name, status: 'Active', subCount: '0', noSub: true, sortOrder: categoryData.sortOrder });
    expect(products, 'PRODUCTS').to.be.greaterThan(0);
    expect(view, 'View products button').to.equal(`View ${products} products`);
    const when = /^[0-9]{1,2} [A-Z][a-z]{2}( [0-9]{4})?, [0-9]{1,2}:[0-9]{2} [AP]M$/;
    expect(created, 'Created').to.match(when);
    expect(updated, 'Updated').to.match(when);
    await d.goBack();
    await categoriesPage.waitForDisplayed(15_000);
    expect(await categoriesPage.visibleNames(), 'list after Back').to.include(categoryData.name);
  });

  it('MCAT-006 View products opens the products of the category with the same count', async function () {
    await openBeverages(this);
    const d = categoryDetailPage;
    const products = Number(await d.text(d.selectors.count('PRODUCTS')));
    await d.openProducts();
    await productsPage.waitForDisplayed(20_000);
    await productsPage.waitForLoaded();
    const listed = await productsPage.count();
    const chip = await $(productsPage.product.selectedCategory(categoryData.name)).isExisting();
    const rows = await productsPage.productRows();
    await checkpoint('MCAT-006 products');
    expect(chip, `Products filtered by ${categoryData.name}`).to.equal(true);
    expect(listed, 'products listed vs PRODUCTS').to.equal(products);
    expect(rows.filter((r) => r.code && !r.code.includes(categoryData.name)).map((r) => `${r.name}: ${r.code}`), 'rows of another category').to.deep.equal([]);
    await categoryDetailPage.goBack();                       // the header Back of the Products screen
    expect(await categoryDetailPage.isDisplayed(15_000), 'category after Back').to.equal(true);
  });

  it('MCAT-007 The actions menu offers edit, rename, PDF and delete actions and closes without a change', async function () {
    await openBeverages(this);
    const d = categoryDetailPage;
    const options = await d.actionOptions(CATEGORY_ACTIONS);
    await checkpoint('MCAT-007 closed');
    expect(options.map((o) => o.label), 'Category actions').to.deep.equal([...CATEGORY_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled').to.deep.equal([]);
    expect(await d.text(d.selectors.name), 'name after closing').to.equal(categoryData.name);
  });

  it('MCAT-008 The edit form shows the saved values, leaves the category out of its own parents and cancels unchanged', async function () {
    await openBeverages(this);
    await categoryDetailPage.openAction('Edit');
    const f = editCategoryPage;
    await f.waitForDisplayed(15_000);
    const got = await f.read();
    const parents = await f.parentOptions(categoryData.name);
    await checkpoint('MCAT-008 edit form');
    const after = await f.read();
    const dialog = await f.cancel();
    expect(got, 'edit form').to.deep.equal({ name: categoryData.name, parent: `Parent category: ${CATEGORY_TEXTS.noParent}`, description: '',
      sortOrder: categoryData.sortOrder, sortHint: true, assignedTo: `Assigned to: ${CATEGORY_TEXTS.noOne}`, active: true });
    expect(parents, `parents matching ${categoryData.name}`).to.not.include(categoryData.name);
    expect(after, 'form after closing the picker').to.deep.equal(got);
    expect(dialog, 'discard dialog on an unchanged form').to.equal(false);
    expect(await categoryDetailPage.isDisplayed(15_000), 'detail after Cancel').to.equal(true);
  });

  it('MCAT-009 Rename shows the current name and closes without renaming', async function () {
    await openBeverages(this);
    const d = categoryDetailPage;
    const sheet = await d.readRename();
    await checkpoint('MCAT-009 closed');
    expect(sheet, 'Rename category').to.deep.equal({ name: categoryData.name, save: true });
    expect(await d.text(d.selectors.name), 'name after closing').to.equal(categoryData.name);
  });

  it('MCAT-010 The new category form shows its defaults, offers every category as parent and closes unchanged without asking', async () => {
    await openCategories();
    const all = await categoriesPage.count();
    await $(categoriesPage.selectors.newButton).click();
    const f = newCategoryPage;
    await f.waitForDisplayed(15_000);
    const got = await f.read();
    const parents = await f.parentOptions(categoryData.name);
    await checkpoint('MCAT-010 new form');
    const dialog = await f.cancel();
    await categoriesPage.waitForDisplayed(20_000);
    await categoriesPage.waitForLoaded();
    expect(got, 'defaults').to.deep.equal({ name: '', parent: `Parent category: ${CATEGORY_TEXTS.noParent}`, description: '', sortOrder: '0', sortHint: true,
      assignedTo: `Assigned to: ${CATEGORY_TEXTS.noOne}`, active: true });
    expect(parents, `parents matching ${categoryData.name}`).to.include(categoryData.name);
    expect(dialog, 'discard dialog on an unchanged form').to.equal(false);
    expect(await categoriesPage.count(), 'count after Cancel').to.equal(all);
  });

  it('MCAT-011 A changed new category asks before discarding, keeps the input on Cancel and saves nothing on Discard', async () => {
    await openCategories();
    const all = await categoriesPage.count();
    await $(categoriesPage.selectors.newButton).click();
    const f = newCategoryPage;
    await f.waitForDisplayed(15_000);
    await f.setName(categoryData.formName);
    const kept = await f.cancelThenKeep();
    const name = (await f.read()).name;
    await checkpoint('MCAT-011 kept after Cancel');
    const dialog = await f.discard();
    await categoriesPage.waitForDisplayed(20_000);
    await categoriesPage.waitForLoaded();
    expect(kept, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(name, 'name after Cancel on the dialog').to.equal(categoryData.formName);
    expect(dialog, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(await categoriesPage.count(), 'count after Discard (nothing saved)').to.equal(all);
    await categoriesPage.search(categoryData.formName);
    expect(await categoriesPage.isEmptyStateShown(), `"${categoryData.formName}" not saved`).to.equal(true);
  });

  it('MCAT-012 The list shows lower sort orders first as the form says', async () => {
    await openCategories();
    const p = categoriesPage;
    const names = (await p.visibleNames()).slice(0, categoryData.sortRows);
    const orders: { name: string; sort: number }[] = [];
    for (const name of names) {
      await p.open(name);
      await categoryDetailPage.waitForDisplayed(30_000);
      orders.push({ name, sort: Number(await categoryDetailPage.field('Sort order')) });
      await categoryDetailPage.goBack();
      await p.waitForDisplayed(15_000);
    }
    await checkpoint('MCAT-012 list');
    const listed = orders.map((o) => `${o.name} (${o.sort})`).join(', ');
    const sorted = [...orders].sort((a, b) => a.sort - b.sort).map((o) => `${o.name} (${o.sort})`).join(', ');
    // "Lower numbers show first." (Sort order hint on the category form); MCAT-D01.
    expect(listed, `list order "${listed}" vs ascending sort order "${sorted}"`).to.equal(sorted);
  });
});
