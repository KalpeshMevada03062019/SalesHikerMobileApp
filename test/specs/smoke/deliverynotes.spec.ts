import { expect } from 'chai';
import { deliveryNotesPage, DELIVERY_STATUSES, DELIVERY_TEXTS } from '../../../src/pages/DeliveryNotesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openDeliveryNotes } from '../../helpers/deliverynotes.js';

describe('Smoke: delivery notes', () => {
  requiresAccount();

  it('MDLV-001 Delivery notes opens with the count, search, status filters and notes', async () => {
    await openDeliveryNotes();
    const p = deliveryNotesPage;
    const count = await p.count();
    expect(count, 'delivery notes').to.be.greaterThan(0);
    expect(await $(p.selectors.search).getText(), 'search hint').to.equal(DELIVERY_TEXTS.searchHint);
    expect(await $(p.selectors.newButton).isExisting(), 'New delivery note (not tapped)').to.equal(true);
    expect(await p.selectedFilters(), 'selected filter').to.deep.equal(['All']);
    const rows = await p.deliveryRows();
    expect(rows.length, 'rows').to.be.greaterThan(0);
    const bad = rows.filter((r) => !r.title || !/^DN-[0-9]+$/.test(r.number) || !r.date || !(DELIVERY_STATUSES as readonly string[]).includes(r.status));
    expect(bad.map((r) => r.label), 'rows without title, DN- number, date or a known status').to.deep.equal([]);
    await checkpoint('MDLV-001 delivery notes');
    expect(await p.endOfListCount(), `"${DELIVERY_TEXTS.endOfList(count)}"`).to.equal(count);
  });
});
