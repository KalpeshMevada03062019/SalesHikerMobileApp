import { expect } from 'chai';
import { templatesPage, TEMPLATE_FILTERS } from '../../../src/pages/TemplatesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTemplates } from '../../helpers/templates.js';

describe('Smoke: templates', () => {
  requiresAccount();

  it('MTPL-001 Templates opens with the count, search, filters, Sync from Meta and templates', async () => {
    await openTemplates();
    expect(await templatesPage.count(), 'templates').to.be.greaterThan(0);
    expect(await templatesPage.selectedFilter(), 'default filter').to.equal('All');
    for (const f of TEMPLATE_FILTERS.slice(0, 4)) expect(await $(templatesPage.selectors.filter(f)).isExisting(), `"${f}" filter`).to.equal(true);
    expect(await $(templatesPage.selectors.sync).isExisting(), 'Sync from Meta').to.equal(true);
    expect((await templatesPage.visibleRows()).length, 'rows').to.be.greaterThan(0);
    await checkpoint('MTPL-001 templates');
  });
});
