import { expect } from 'chai';
import { organizationsPage } from '../../../src/pages/OrganizationsPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openOrganizations } from '../../helpers/organizations.js';

describe('Smoke: organizations', () => {
  requiresAccount();

  it('MORG-001 Organizations opens with the count, search, New Organization and organizations', async () => {
    await openOrganizations();
    expect(await organizationsPage.count(), 'organizations').to.be.greaterThan(0);
    expect(await $(organizationsPage.selectors.search).getText(), 'search hint').to.equal('Search organizations');
    expect(await $(organizationsPage.selectors.newOrg).isExisting(), 'New Organization (not tapped)').to.equal(true);
    expect((await organizationsPage.visibleRows()).length, 'rows').to.be.greaterThan(0);
    await checkpoint('MORG-001 organizations');
  });
});
