// Delivery notes, the whole screen: status chips, search, the detail of DN-0005 (every field) and DN-0006 (no
// subject), the actions menu and Change status sheet (opened and closed), and the New delivery note form (filled
// and discarded). Save, Download PDF, Share, every menu action and every status are never chosen.
import { expect } from 'chai';
import { deliveryNotesPage, deliveryNoteDetailPage, newDeliveryNotePage, DELIVERY_STATUSES, DELIVERY_ACTIONS, DELIVERY_TEXTS } from '../../../src/pages/DeliveryNotesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { deliveryData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openDeliveryNote, openDeliveryNotes } from '../../helpers/deliverynotes.js';

describe('Delivery notes: filters, search, detail, actions and the new note form (nothing is saved)', () => {
  requiresAccount();

  it('MDLV-002 Status counts add up to all delivery notes and All lists every note', async () => {
    await openDeliveryNotes();
    const p = deliveryNotesPage;
    const all = await p.count();
    const listed = await p.deliveryRows();
    const counts: string[] = [];
    let sum = 0;
    for (const s of DELIVERY_STATUSES) { const n = await p.selectFilter(s); counts.push(`${s} ${n}`); sum += n; }
    await checkpoint('MDLV-002 last status');
    expect(sum, `${counts.join(' + ')} vs All ${all}`).to.equal(all);
    // Beta holds a handful of notes: All shows each status as often as its chip counts.
    const byStatus = DELIVERY_STATUSES.map((s) => `${s} ${listed.filter((r) => r.status === s).length}`);
    if (listed.length === all) expect(byStatus, 'statuses on the All list vs the chip counts').to.deep.equal(counts);
  });

  it('MDLV-003 Each status filter shows only notes with that status or the empty state', async () => {
    await openDeliveryNotes();
    const p = deliveryNotesPage;
    const problems: string[] = [];
    for (const s of DELIVERY_STATUSES) {
      const n = await p.selectFilter(s);
      const rows = await p.deliveryRows();
      if (!(await p.isFilterSelected(s))) problems.push(`${s}: chip not selected`);
      if (await p.isFilterSelected('All')) problems.push(`${s}: All still selected`);
      if (n === 0 && !(await p.isEmptyStateShown(5_000))) problems.push(`${s}: count 0 without "${DELIVERY_TEXTS.noNotes}"`);
      if (n > 0 && rows.length === 0) problems.push(`${s}: count ${n} but no notes listed`);
      const other = rows.filter((r) => r.status !== s).map((r) => `${r.number} ${r.status}`);
      if (other.length) problems.push(`${s}: ${other.join(', ')}`);
    }
    await checkpoint('MDLV-003 last status');
    expect(problems, `status filters: ${problems.join('; ')}`).to.deep.equal([]);
  });

  it('MDLV-004 Search finds a delivery note by number or subject in any letter case', async () => {
    await openDeliveryNotes();
    const p = deliveryNotesPage;
    await p.search(deliveryData.full.toLowerCase());
    const byNumber = await p.deliveryRows();
    expect(byNumber.map((r) => r.number), `results for "${deliveryData.full.toLowerCase()}"`).to.deep.equal([deliveryData.full]);
    expect(await p.count(), 'count for the number').to.equal(1);
    await p.search(deliveryData.subjectSearch.toUpperCase());
    const bySubject = await p.deliveryRows();
    await checkpoint('MDLV-004 by subject');
    expect(bySubject.map((r) => r.number), `results for "${deliveryData.subjectSearch.toUpperCase()}"`).to.include(deliveryData.full);
    expect(bySubject.filter((r) => !r.title.toLowerCase().includes(deliveryData.subjectSearch)).map((r) => r.label), 'results without the words').to.deep.equal([]);
    expect(await p.count(), 'count vs results').to.equal(bySubject.length);
  });

  it('MDLV-005 An unknown word finds no delivery notes and Clear filters restores the list', async () => {
    await openDeliveryNotes();
    const p = deliveryNotesPage;
    const all = await p.count();
    await p.search(deliveryData.noMatch);
    expect(await p.isEmptyStateShown(), `"${DELIVERY_TEXTS.noNotes}"`).to.equal(true);
    expect(await $(p.selectors.noResultsHint).isExisting(), `"${DELIVERY_TEXTS.noNotesHint}"`).to.equal(true);
    expect(await p.count(), 'count').to.equal(0);
    await checkpoint('MDLV-005 no match');
    await p.clearFromEmptyState();
    expect(await $(p.selectors.search).getText(), 'search after Clear filters').to.equal(DELIVERY_TEXTS.searchHint);
    expect(await p.selectedFilters(), 'status after Clear filters').to.deep.equal(['All']);
    expect(await p.count(), 'count after Clear filters').to.equal(all);
  });

  it('MDLV-006 The delivery note detail shows its number, status, subject and dispatch date as on the list', async function () {
    const row = await openDeliveryNote(this, deliveryData.full);
    const d = deliveryNoteDetailPage;
    expect(await d.text(d.selectors.number), 'number').to.equal(row.number);
    expect(await d.text(d.selectors.status), 'status').to.equal(row.status);
    expect(await d.text(d.note.subject), 'subject').to.equal(row.title);
    expect(await d.text(d.note.dispatched), 'dispatch date').to.equal(deliveryData.dispatched);
    expect(deliveryData.dispatched.startsWith(row.dispatched), `list "${row.dispatched}" vs detail "${deliveryData.dispatched}"`).to.equal(true);
    expect(await $(d.selectors.button('Download PDF')).isExisting(), 'Download PDF (not tapped)').to.equal(true);
    expect(await $(d.selectors.button('Share')).isExisting(), 'Share (not tapped)').to.equal(true);
    await checkpoint('MDLV-006 detail');
    await d.goBack();
    await deliveryNotesPage.waitForDisplayed();
    expect((await deliveryNotesPage.deliveryRows()).map((r) => r.number), 'list after Back').to.include(row.number);
  });

  it('MDLV-007 Items show name, price, quantity and serial and add up to the total quantity', async function () {
    await openDeliveryNote(this, deliveryData.full);
    const d = deliveryNoteDetailPage;
    const items = await d.items();
    await checkpoint('MDLV-007 items');
    expect(items.length, 'items vs ITEMS count').to.equal(Number(await d.text(d.note.itemCount)));
    expect(items[0], 'item').to.deep.equal(deliveryData.item);
    expect(Number(await d.text(d.note.totalQuantity)), 'Total quantity vs the items').to.equal(items.reduce((s, i) => s + i.quantity, 0));
  });

  it('MDLV-008 Shipping, notes and activity show the tracking number, address, notes and status history', async function () {
    await openDeliveryNote(this, deliveryData.full);
    const d = deliveryNoteDetailPage;
    await d.scrollTo(d.note.notes);
    expect(await d.text(d.note.field('Tracking number')), 'Tracking number').to.equal(deliveryData.tracking);
    expect(await d.text(d.note.field('Shipping address')), 'Shipping address').to.equal(deliveryData.address);
    expect(await d.text(d.note.notes), 'notes (with accents and emoji)').to.equal(deliveryData.notes);
    await d.scrollTo(d.selectors.text(`Delivery note "${deliveryData.full}" created`));
    const activity = await d.activity();
    await checkpoint('MDLV-008 activity');
    expect(activity.length, `ACTIVITY entries vs its count: ${activity.join(' | ')}`).to.equal(Number(await d.text(d.note.activityCount)));
    expect(activity.some((a) => a.startsWith('Status changed from "draft" to "dispatched"')), 'status change in ACTIVITY').to.equal(true);
    expect(activity[activity.length - 1], 'oldest entry').to.match(new RegExp(`^Delivery note "${deliveryData.full}" created, `));
  });

  it('MDLV-009 A delivery note without a subject shows its number instead and only the parts it has', async function () {
    const row = await openDeliveryNote(this, deliveryData.noSubject);
    const d = deliveryNoteDetailPage;
    await checkpoint('MDLV-009 no subject');
    expect(row.title, 'list title').to.equal(deliveryData.noSubject);
    expect(await d.text(d.selectors.status), 'status').to.equal(row.status);
    expect(await $(d.note.subject).isExisting(), 'subject on the detail').to.equal(false);
    expect(await $(d.selectors.text('SHIPPING')).isExisting(), 'SHIPPING without shipping data').to.equal(false);
    expect(await $(d.selectors.text('NOTES')).isExisting(), 'NOTES without notes').to.equal(false);
    const items = await d.items();
    expect(Number(await d.text(d.note.totalQuantity)), 'Total quantity').to.equal(items.reduce((s, i) => s + i.quantity, 0));
  });

  it('MDLV-010 The actions menu offers status, edit, share link, notes, task and delete', async function () {
    await openDeliveryNote(this, deliveryData.full);
    const options = await deliveryNoteDetailPage.actionOptions(DELIVERY_ACTIONS);
    await checkpoint('MDLV-010 closed');
    expect(options.map((o) => o.label), 'Delivery note actions').to.deep.equal([...DELIVERY_ACTIONS]);
    expect(options.filter((o) => !o.enabled).map((o) => o.label), 'disabled actions').to.deep.equal([]);
    expect(await deliveryNoteDetailPage.isDisplayed(5_000), 'detail after closing the menu').to.equal(true);
  });

  it('MDLV-011 Change status lists every status with the current one selected and closes without a change', async function () {
    const row = await openDeliveryNote(this, deliveryData.full);
    const d = deliveryNoteDetailPage;
    const options = await d.statusOptions();
    await checkpoint('MDLV-011 closed');
    expect(options.map((o) => o.label), 'statuses').to.deep.equal([...DELIVERY_STATUSES]);
    expect(options.filter((o) => o.selected).map((o) => o.label), 'selected').to.deep.equal([row.status]);
    expect(await d.text(d.selectors.status), 'status after closing').to.equal(row.status);
  });

  it('MDLV-012 The new delivery note form starts as Draft and shows an added line, then discards without saving', async () => {
    await openDeliveryNotes();
    const all = await deliveryNotesPage.count();
    await $(deliveryNotesPage.selectors.newButton).click();
    const f = newDeliveryNotePage;
    await f.waitForDisplayed(15_000);
    expect(await f.desc(f.selectors.status), 'status').to.equal('Status: Draft');
    expect(await f.desc(f.selectors.dispatchDate), 'dispatch date').to.equal('Dispatch date: No date');
    expect(await f.desc(f.selectors.deliveryDate), 'delivery date').to.equal('Delivery date: No date');
    expect(await f.desc(f.selectors.customer), 'customer').to.equal('Customer: Link a contact');
    expect(await f.desc(f.selectors.owner), 'owner').to.equal('Owner: Me');
    const statuses = await f.statusOptions();
    expect(statuses.map((s) => s.label), 'status options').to.deep.equal([...DELIVERY_STATUSES]);
    expect(statuses.filter((s) => s.selected).map((s) => s.label), 'selected status').to.deep.equal(['Draft']);
    await f.addService(deliveryData.service, deliveryData.serviceQuantity);
    const lines = await f.lineLabels();
    const total = await $(f.selectors.linesTotal).getText();
    await f.scrollTo(f.selectors.carrier);
    const carrierHint = await $(f.selectors.carrier).getText();
    await checkpoint('MDLV-012 form');
    const dialog = await f.discard();
    await deliveryNotesPage.waitForDisplayed(20_000);
    await deliveryNotesPage.waitForLoaded();
    expect(lines, 'lines').to.deep.equal([deliveryData.serviceLine]);
    expect(total, 'Lines total').to.equal(deliveryData.serviceTotal);
    expect(carrierHint, 'Carrier hint').to.equal(DELIVERY_TEXTS.carrierHint);
    expect(dialog, 'discard dialog').to.deep.equal({ title: true, message: true });
    expect(await deliveryNotesPage.count(), 'count after Discard (nothing saved)').to.equal(all);
  });
});
