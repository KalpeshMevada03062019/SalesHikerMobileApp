import { expect } from 'chai';
import { productsPage, PRODUCT_TEXTS } from '../../../src/pages/ProductsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openProducts } from '../../helpers/products.js';

describe('Smoke: products', () => {
  requiresAccount();

  it('MPRD-001 Products opens with the count, search, barcode scan, filters and products', async () => {
    await openProducts();
    const p = productsPage;
    expect(await p.count(), 'products').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(PRODUCT_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New product (not tapped)').to.equal(true);
    expect(await $(p.product.scanBarcode).isExisting(), 'Scan barcode (not tapped)').to.equal(true);
    expect(await $(p.product.categoryChip).isExisting(), 'Category chip').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.productRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.name || !/^₹[0-9,]+([.][0-9]{1,2})?$/.test(r.price));
    expect(bad.map((r) => r.label), 'rows without a name or a ₹ price').to.deep.equal([]);
    await checkpoint('MPRD-001 products');
  });
});
