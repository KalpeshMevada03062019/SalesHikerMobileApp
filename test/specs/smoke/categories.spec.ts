import { expect } from 'chai';
import { categoriesPage, CATEGORY_TEXTS } from '../../../src/pages/CategoriesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openCategories } from '../../helpers/categories.js';

describe('Smoke: categories', () => {
  requiresAccount();

  it('MCAT-001 Categories opens with the count, search, new category and the categories', async () => {
    await openCategories();
    const p = categoriesPage;
    expect(await p.count(), 'categories').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(CATEGORY_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New category (not tapped)').to.equal(true);
    const names = await p.visibleNames();
    expect(names.length, 'rows').to.be.greaterThan(0);
    expect(names.filter((n) => !n.trim()), 'rows without a name').to.deep.equal([]);
    await checkpoint('MCAT-001 categories');
  });
});
