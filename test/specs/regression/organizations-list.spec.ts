// Organizations list, read only: search by name and domain, the empty search and endless scrolling.
import { expect } from 'chai';
import { organizationsPage } from '../../../src/pages/OrganizationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { organizationData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openOrganizations } from '../../helpers/organizations.js';

describe('Organizations: list and search', () => {
  requiresAccount();
  beforeEach(async () => { await openOrganizations(); });

  it('MORG-002 Search by part of a name is case-insensitive and shows how many match', async () => {
    await organizationsPage.search(organizationData.search.toUpperCase());
    const names = (await organizationsPage.visibleRows()).map((r) => r.name);
    expect(names, `results for "${organizationData.search.toUpperCase()}"`).to.include(organizationData.name);
    expect(names.filter((n) => !n.toLowerCase().includes(organizationData.search)), 'results without the search word').to.deep.equal([]);
    const count = await organizationsPage.count();
    expect(await $(organizationsPage.selectors.showing).getText(), '"Showing N of N"').to.match(new RegExp(`^Showing ${count} of ${count} organizations?$`));
    await checkpoint('MORG-002 search name');
  });

  it('MORG-003 Search by website domain finds the organization', async () => {
    await organizationsPage.search(organizationData.domain);
    expect((await organizationsPage.visibleRows()).map((r) => r.name), `results for "${organizationData.domain}"`).to.include(organizationData.name);
    await checkpoint('MORG-003 search domain');
  });

  it('MORG-004 An unknown name finds none and Clear Search restores the list', async () => {
    const all = await organizationsPage.count();
    await organizationsPage.search(organizationData.noMatch);
    expect(await organizationsPage.isEmptyStateShown(), '"No organizations found"').to.equal(true);
    expect(await $(organizationsPage.selectors.noOrgsHint).isExisting(), '"Try another name, domain, email or phone."').to.equal(true);
    expect(await organizationsPage.count(), 'count').to.equal(0);
    await checkpoint('MORG-004 no match');
    await organizationsPage.clearFromEmptyState();
    expect(await organizationsPage.count(), 'count after Clear Search').to.equal(all);
  });

  it('MORG-005 Scrolling the list loads more organizations', async () => {
    const firstScreen = (await organizationsPage.visibleRows()).length;
    const seen = await organizationsPage.scrollAndCollect(8);
    await checkpoint('MORG-005 scrolled');
    expect(seen.length, `organizations seen after 8 scrolls (first screen ${firstScreen})`).to.be.greaterThan(firstScreen * 3);
    expect(await organizationsPage.count(), 'total unchanged').to.be.greaterThan(seen.length);
  });
});
