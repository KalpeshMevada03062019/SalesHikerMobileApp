// Organization detail, read only: Overview, the Contacts / Deals / Notes tabs and the actions menu (opened and
// closed). Call, Email, Website, Edit, Add Note, Find duplicates and Delete are never tapped.
import { expect } from 'chai';
import { organizationDetailPage, ORG_ACTIONS, ORG_INFO_FIELDS, ORG_QUICK_ACTIONS, ORG_TEXTS } from '../../../src/pages/OrganizationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { organizationData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openReferenceOrganization } from '../../helpers/organizations.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Organizations: detail (nothing is changed)', () => {
  requiresAccount();

  it('MORG-006 The organization opens on Overview with the same revenue as the list and its details', async function () {
    const row = await openReferenceOrganization(this);
    const p = organizationDetailPage;
    expect(await p.isTitled(row.name), 'title').to.equal(true);
    for (const a of ORG_QUICK_ACTIONS) expect(await $(p.selectors.quickAction(a)).isExisting(), `${a} (not tapped)`).to.equal(true);
    expect(await p.isTabSelected('Overview'), 'Overview selected').to.equal(true);
    expect(await p.value('Owner'), 'Owner').to.not.equal('');
    if (row.revenue) expect(await p.value('Annual Revenue'), 'Annual Revenue vs list').to.equal(row.revenue);
    await checkpoint('MORG-006 overview');
    expect(await p.scrollTo(p.selectors.infoSection), 'ORGANIZATION INFO').to.equal(true);
    const empty: string[] = [];
    for (const f of ORG_INFO_FIELDS) if (!(await p.value(f))) empty.push(f);
    expect(empty, 'ORGANIZATION INFO fields without a value').to.deep.equal([]);
    expect(await p.value('Website'), 'Website').to.include(organizationData.domain);
    expect(await p.scrollTo(p.selectors.tagsSection), 'TAGS').to.equal(true);
    await checkpoint('MORG-006 info');
  });

  it('MORG-007 The Contacts, Deals and Notes tabs list as many items as their counts', async function () {
    await openReferenceOrganization(this);
    const p = organizationDetailPage;
    const contacts = await p.tabCount('Contacts');
    const deals = await p.tabCount('Deals');
    const notes = await p.tabCount('Notes');
    if (contacts + deals + notes === 0) skipBecause(this, 'the organization has no contacts, deals or notes');
    const problems: string[] = [];
    await p.openTab('Contacts');
    if (contacts === 0 && !(await $(p.selectors.noContacts).isExisting())) problems.push(`Contacts 0 without "${ORG_TEXTS.noContacts}"`);
    await checkpoint('MORG-007 contacts');
    await p.openTab('Deals');
    if (deals <= 4 && (await $$(p.selectors.dealRows).length) !== deals) problems.push(`Deals ${deals} but ${await $$(p.selectors.dealRows).length} listed`);
    await checkpoint('MORG-007 deals');
    await p.openTab('Notes');
    if (notes <= 4 && (await $$(p.selectors.noteBylines).length) !== notes) problems.push(`Notes ${notes} but ${await $$(p.selectors.noteBylines).length} listed`);
    if (!(await $(p.selectors.addNote).isExisting())) problems.push('Add Note missing');
    await checkpoint('MORG-007 notes');
    expect(problems, 'tabs').to.deep.equal([]);
  });

  it('MORG-008 The actions menu offers edit, find duplicates and delete', async function () {
    await openReferenceOrganization(this);
    expect(await organizationDetailPage.actionOptions(), 'Organization Actions').to.deep.equal([...ORG_ACTIONS]);   // closed without choosing
  });
});
