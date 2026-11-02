// Chat with the allowlisted recipient and the "Send Template" sheet. Nothing is sent here: every test
// ends with the sheet closed (afterEach makes sure of it).
import { expect } from 'chai';
import { chatPage, INBOX_TEXTS } from '../../../src/pages/InboxPage.js';
import { checkpoint } from '../../../src/utils/evidence.js';
import { requiresAccount } from '../../helpers/hooks.js';
import { openRecipientChat, closeSheetIfOpen } from '../../helpers/inbox.js';
import { skipBecause } from '../../helpers/campaigns.js';

describe('Inbox: chat and template sheet (nothing is sent)', () => {
  requiresAccount();
  afterEach(async () => { await closeSheetIfOpen(); });

  it('MINB-002 Searching the number opens the contact chat', async () => {
    const who = await openRecipientChat();   // fails if the header shows another number
    expect(who.name, 'contact name').to.not.equal('');
    await checkpoint('MINB-002 chat');
  });

  it('MINB-003 With the 24-hour window closed only templates and notes can be sent', async function () {
    await openRecipientChat();
    if (!(await chatPage.isWindowClosed())) skipBecause(this, 'the customer messaged in the last 24 hours, so the window is open');
    expect(await chatPage.isTextShown(INBOX_TEXTS.closedWindowHint), 'closed-window hint').to.equal(true);
    expect(await $(chatPage.selectors.attachDisabled).isExisting(), 'attach disabled ("Needs an open window")').to.equal(true);
    expect(await $(chatPage.selectors.internalNote).isExisting(), 'internal note').to.equal(true);
    expect(await $(chatPage.selectors.composerSendTemplate).isExisting(), 'Send Template').to.equal(true);
    await checkpoint('MINB-003 closed window');
  });

  it('MINB-004 Template sheet lists approved templates and reports no match', async () => {
    await openRecipientChat();
    await chatPage.openTemplateSheet();
    expect(await chatPage.isTextShown(INBOX_TEXTS.chooseTemplate), '"Choose a template to send."').to.equal(true);
    const found = await chatPage.searchTemplates('CALL_PHONE_MESSAGE');
    expect(found, 'upper-case search').to.include('call_phone_message');
    await chatPage.searchTemplates('qa_no_such_template_zz');
    expect(await chatPage.isTextShown(INBOX_TEXTS.noTemplates), '"No templates found"').to.equal(true);
    expect(await chatPage.isTextShown(INBOX_TEXTS.noTemplatesHint), 'no-match hint').to.equal(true);
    await checkpoint('MINB-004 no templates');
  });

  it('MINB-005 Category filters show only templates of that category', async () => {
    await openRecipientChat();
    await chatPage.openTemplateSheet();
    await chatPage.chooseCategory('Authentication');
    await driver.pause(1_000);
    const labels: string[] = [];
    for (const el of await $$(chatPage.selectors.templateRows)) labels.push((await el.getAttribute('content-desc')) ?? '');
    await checkpoint('MINB-005 authentication');
    expect(labels.length, 'authentication templates').to.be.greaterThan(0);
    expect(labels.filter((l) => !l.includes(', Authentication, ')), 'other categories listed').to.deep.equal([]);
  });

  it('MINB-006 Template variables are required and fill the preview', async () => {
    await openRecipientChat();
    await chatPage.selectTemplate('testvarbody');
    expect(await chatPage.variableCount(), 'variables').to.equal(2);
    // Send is never tapped in this spec ("Enter a value." on empty fields was seen live on 2026-11-02).
    await chatPage.fillVariables(['QA', 'preview check']);
    expect(await chatPage.previewContains('Hello QA this is testing template for body'), 'preview with values').to.equal(true);
    await checkpoint('MINB-006 preview');
  });
});
