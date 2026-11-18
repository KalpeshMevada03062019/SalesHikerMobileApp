import { expect } from 'chai';
import { servicesPage, SERVICE_TEXTS } from '../../../src/pages/ServicesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openServices } from '../../helpers/services.js';

describe('Smoke: services', () => {
  requiresAccount();

  it('MSRV-001 Services opens with the count, search, filters and services', async () => {
    await openServices();
    const p = servicesPage;
    const count = await p.count();
    expect(count, 'services').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(SERVICE_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New service (not tapped)').to.equal(true);
    expect(await $(p.service.categoryChip).isExisting(), 'Category chip').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.serviceRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.name || !/^₹[0-9,]+([.][0-9]{1,2})?$/.test(r.price) || !/^SER-[0-9]+/.test(r.code));
    expect(bad.map((r) => r.label), 'rows without a name, a ₹ price or a SER- number').to.deep.equal([]);
    if (count === rows.length) expect(await p.endOfListText(), 'end of list').to.equal(`End of list. ${count} service${count === 1 ? '' : 's'}.`);
    await checkpoint('MSRV-001 services');
  });
});
