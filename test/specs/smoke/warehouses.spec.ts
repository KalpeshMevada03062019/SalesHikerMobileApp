import { expect } from 'chai';
import { warehousesPage, WAREHOUSE_TEXTS } from '../../../src/pages/WarehousesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openWarehouses } from '../../helpers/warehouses.js';

describe('Smoke: warehouses', () => {
  requiresAccount();

  it('MWHS-001 Warehouses opens with the count, search, status chips and the warehouses', async () => {
    await openWarehouses();
    const p = warehousesPage;
    expect(await p.count(), 'warehouses').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(WAREHOUSE_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New warehouse (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected status').to.deep.equal(['All']);
    const rows = await p.rows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    expect(rows.filter((r) => !r.name).map((r) => r.label), 'rows without a name').to.deep.equal([]);
    await checkpoint('MWHS-001 warehouses');
  });
});
