// Template detail, read only: preview, details and actions. The actions menu is opened and closed
// without choosing Edit or Delete.
import { expect } from 'chai';
import { templatesPage, templateDetailPage } from '../../../src/pages/TemplatesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { templateData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTemplates } from '../../helpers/templates.js';

describe('Templates: detail', () => {
  requiresAccount();
  beforeEach(async () => {
    await openTemplates();
    await templatesPage.openTemplate(templateData.approved.name);
    await templateDetailPage.waitForDisplayed(15_000);
  });

  it('MTPL-007 Detail shows the preview, status, category, language, header and buttons', async () => {
    const t = templateData.approved;
    expect(await templateDetailPage.isTitled(t.name), 'title').to.equal(true);
    expect(await $(templateDetailPage.selectors.preview).isExisting(), 'WhatsApp preview').to.equal(true);
    await checkpoint('MTPL-007 preview');
    expect(await templateDetailPage.detail('Status'), 'status').to.equal('Approved');
    expect(await templateDetailPage.detail('Category'), 'category').to.equal(t.category);
    expect(await templateDetailPage.detail('Language'), 'language').to.equal(t.language);
    expect(await templateDetailPage.detail('Header'), 'header').to.equal(t.header);
    for (const b of t.buttons) expect(await templateDetailPage.detail(b), `button "${b}"`).to.not.equal(null);
    await checkpoint('MTPL-007 details');
  });

  it('MTPL-008 Detail offers Use in Broadcast, Send Template and Edit or Delete', async () => {
    expect(await $(templateDetailPage.selectors.useInBroadcast).isExisting(), 'Use in Broadcast').to.equal(true);
    expect(await $(templateDetailPage.selectors.sendTemplate).isExisting(), 'Send Template').to.equal(true);
    const options = await templateDetailPage.actionOptions();   // closed again without choosing
    await checkpoint('MTPL-008 actions closed');
    expect(options, 'Template actions').to.deep.equal(['Edit', 'Delete']);
    expect(await templateDetailPage.isTitled(templateData.approved.name), 'still on the template').to.equal(true);
  });
});
