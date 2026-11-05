// Lead detail, read only: a lead without a contact, a lead with a contact and its tabs, and the actions menu
// (opened and closed). Status, WhatsApp, Call, Convert, Set, Edit, Add Note and Convert Lead are never tapped.
import { expect } from 'chai';
import { leadDetailPage, LEAD_ACTIONS, LEAD_QUICK_ACTIONS, LEAD_TEXTS } from '../../../src/pages/LeadsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { leadData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openFirstLead } from '../../helpers/leads.js';

describe('Leads: detail (nothing is changed)', () => {
  requiresAccount();

  it('MLED-007 A lead without a contact shows its status, progress, quick actions and lead info', async function () {
    const row = await openFirstLead(this, (r) => !r.contact && r.status === 'Won', 'Won lead without a contact');
    const p = leadDetailPage;
    expect(await p.isTitled(row.name), 'title').to.equal(true);
    expect(await p.status(), 'status vs list').to.equal(row.status);
    expect(await p.progress(), 'Lead progress of a Won lead').to.equal(100);
    for (const a of LEAD_QUICK_ACTIONS) expect(await $(p.selectors.quickAction(a)).isExisting(), `${a} (not tapped)`).to.equal(true);
    expect(await $(p.selectors.noContact).isExisting(), `"${LEAD_TEXTS.noContact}"`).to.equal(true);
    expect(await p.isTabSelected('Overview'), 'Overview selected').to.equal(true);
    expect(await p.value('Owner'), 'Owner').to.not.equal('');
    expect(await p.value('Next Follow-up'), 'Next Follow-up').to.not.equal('');
    expect(await $(p.selectors.leadInfo).isExisting(), 'LEAD INFO').to.equal(true);
    expect(await p.value('Priority'), 'Priority').to.match(/^(Low|Medium|High|Urgent)$/);
    expect(await p.value('Lead Score'), 'Lead Score').to.not.equal('');
    expect(await $(p.selectors.convertLead).isExisting(), 'Convert Lead (not tapped)').to.equal(true);
    await checkpoint('MLED-007 lead');
  });

  it('MLED-008 A lead with a contact shows the contact, its enquiry, activity and notes', async function () {
    const row = await openFirstLead(this, (r) => r.name === leadData.withContact, `lead "${leadData.withContact}"`, leadData.withContactSearch);
    const p = leadDetailPage;
    expect(await p.text(p.selectors.contact(row.name)), 'contact vs list').to.equal(row.contact);
    expect(await $(p.selectors.noContact).isExisting(), 'no-contact hint').to.equal(false);
    expect(await $(p.selectors.enquiry).isExisting(), 'ENQUIRY').to.equal(true);
    await checkpoint('MLED-008 overview');
    await p.openTab('Activity');
    expect(await $$(p.selectors.activity).length, 'activity entries').to.be.greaterThan(0);
    await checkpoint('MLED-008 activity');
    await p.openTab('Notes');
    const empty = await $(p.selectors.noNotes).isExisting();
    expect(await $(p.selectors.addNote).isExisting(), 'Add Note (not tapped)').to.equal(true);
    if (!empty) expect(await $$(p.selectors.activity).length, 'notes').to.be.greaterThan(0);
    await checkpoint('MLED-008 notes');
  });

  it('MLED-009 The actions menu offers edit, change status, find duplicates and delete', async function () {
    await openFirstLead(this, () => true, 'lead');
    expect(await leadDetailPage.actionOptions(), 'Lead Actions').to.deep.equal([...LEAD_ACTIONS]);   // closed without choosing
  });
});
