// New template form, never saved: only invalid or partial input is entered, "Save and send for review"
// is only tapped while the name is empty or invalid, and every test ends with Cancel > Discard.
import { expect } from 'chai';
import { templatesPage, newTemplatePage, HEADER_TYPES, BUTTON_TYPES, TEMPLATE_TEXTS } from '../../../src/pages/TemplatesPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { templateData } from '../../../src/data/testData.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openTemplates, discardNewTemplateIfOpen } from '../../helpers/templates.js';

describe('Templates: New template form (nothing is saved)', () => {
  requiresAccount();
  let countBefore = 0;
  beforeEach(async () => {
    await openTemplates();
    countBefore = await templatesPage.count();
    await templatesPage.openNewTemplate();
    await newTemplatePage.waitForDisplayed(15_000);
  });
  afterEach(async () => { await discardNewTemplateIfOpen(); });

  it('MTPL-010 New template starts as a Meta-approved Marketing template in en_US', async () => {
    const p = newTemplatePage;
    for (const tab of ['Basics', 'Header', 'Body', 'Buttons'] as const) expect(await $(p.selectors.tab(tab)).isExisting(), `"${tab}" tab`).to.equal(true);
    expect(await p.isSelected(p.selectors.type('Meta-approved template')), 'Meta-approved selected').to.equal(true);
    expect(await p.isSelected(p.selectors.category('Marketing')), 'Marketing selected').to.equal(true);
    expect(await p.value(p.selectors.language), 'language').to.equal('en_US');
    await checkpoint('MTPL-010 basics');
  });

  it('MTPL-011 A name and the message text are required', async () => {
    await newTemplatePage.trySubmitInvalid();   // empty name: cannot save
    expect(await newTemplatePage.isTextShown(TEMPLATE_TEXTS.enterName), '"Enter a name"').to.equal(true);
    await newTemplatePage.openTab('Body');
    expect(await newTemplatePage.isTextShown(TEMPLATE_TEXTS.enterBody), '"Enter the message text"').to.equal(true);
    await checkpoint('MTPL-011 required');
  });

  it('MTPL-012 The name is lower-cased as typed and invalid characters are rejected', async () => {
    await newTemplatePage.setText(newTemplatePage.selectors.name, templateData.invalidName);
    expect(await newTemplatePage.value(newTemplatePage.selectors.name), 'name as typed').to.equal(templateData.normalisedInvalidName);
    await newTemplatePage.trySubmitInvalid();   // invalid name: cannot save
    expect(await newTemplatePage.isTextShown(TEMPLATE_TEXTS.nameFormat), 'name format error').to.equal(true);
    await checkpoint('MTPL-012 name format');
  });

  // The web template form also offers a Location header (web scenario TPL-020); mobile does not: MTPL-D01.
  it('MTPL-013 Header offers the same types as the web, including Location', async () => {
    await newTemplatePage.openTab('Header');
    const offered: string[] = [];
    for (const t of [...HEADER_TYPES, 'Location']) if (await $(newTemplatePage.selectors.headerType(t)).isExisting()) offered.push(t);
    await checkpoint('MTPL-013 header types');
    expect(offered, 'header types').to.include.members([...HEADER_TYPES]);
    expect(offered, 'header types').to.include('Location');
  });

  it('MTPL-014 Body text appears in the WhatsApp preview as it is typed', async () => {
    await newTemplatePage.openTab('Body');
    await newTemplatePage.setText(newTemplatePage.selectors.message, templateData.previewBody);
    expect(await newTemplatePage.previewShows(templateData.previewBody), 'preview').to.equal(true);
    await checkpoint('MTPL-014 preview');
  });

  it('MTPL-015 Buttons can be added with a type and text, and removed', async () => {
    const p = newTemplatePage;
    await p.openTab('Buttons');
    expect(await p.isTextShown(TEMPLATE_TEXTS.noButtons), '"No buttons. Up to 10."').to.equal(true);
    await $(p.selectors.addButton).click();
    for (const t of BUTTON_TYPES) expect(await $(p.selectors.buttonType(t)).isExisting(), `"${t}" type`).to.equal(true);
    expect(await $(p.selectors.buttonText).isExisting(), 'button text field').to.equal(true);
    await checkpoint('MTPL-015 button');
    await $(p.selectors.removeButton(1)).click();
    await driver.pause(500);
    expect(await p.isTextShown(TEMPLATE_TEXTS.noButtons), 'button removed').to.equal(true);
  });

  it('MTPL-016 Cancel with changes asks to discard and nothing is saved', async () => {
    await newTemplatePage.setText(newTemplatePage.selectors.name, templateData.invalidName);
    const result = await newTemplatePage.cancelAndDiscard();
    expect(result.asked && result.message, '"Discard changes? Your changes are not saved."').to.equal(true);
    await templatesPage.waitForDisplayed(15_000);
    expect(await templatesPage.count(), 'templates after discard').to.equal(countBefore);
  });
});
