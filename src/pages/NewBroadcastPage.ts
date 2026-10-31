// New Broadcast wizard (Broadcasts > New Broadcast): 1 Audience, 2 Template, 3 Review, then the
// "Send this broadcast?" confirmation. Live app on the phone, 2026-10-31.
//
// Nothing here sends on its own. Only confirmSend() taps "Send Now", and the send spec calls it once,
// after its allowlist checks, and only when BROADCAST_SEND=true.
import { BasePage, by } from './BasePage.js';

export type AudienceKind = 'All contacts' | 'Saved list' | 'Segment' | 'Tags';
export type WizardStep = 'Audience' | 'Template' | 'Review';

export const BROADCAST_TEXTS = {
  nameTooShort: 'Enter at least 2 characters.',
  addTag: 'Add at least one tag.',
  chooseList: 'Choose a list.',
  chooseSegment: 'Choose a segment.',
  pickTemplate: 'Pick a template.',
  noTemplates: 'No templates found',
  noTemplatesHint: 'Try another name.',
  sendNowHint: 'Sending starts as soon as you confirm.',
  confirmTitle: 'Send this broadcast?',
  discardTitle: 'Discard this broadcast?',
  discardMessage: 'This broadcast is not saved yet.',
};

export class NewBroadcastPage extends BasePage {
  protected readonly marker = by.textMatches('Step [0-9] of 3 · .*');

  readonly selectors = {
    step: this.marker,
    // Sheets have their own Close button; the wizard's is the first one.
    close: `(${'//android.widget.Button[@content-desc="Close"]'})[1]`,
    sheetClose: `(${'//android.widget.Button[@content-desc="Close"]'})[last()]`,
    name: by.a11y('Broadcast name'),
    sendFrom: by.descStartsWith('Send from: '),
    // Sheet options follow the sheet title; the first one is the first connected number.
    sheetOptions: (title: string) => `//android.view.View[@text=${JSON.stringify(title)}]/following::android.widget.Button[@content-desc!="Close"]`,
    audience: (kind: AudienceKind) => by.descClass(kind, 'android.widget.RadioButton'),
    allContactsCount: by.textStartsWith('Everyone opted in: '),
    listPicker: by.descStartsWith('List: '),
    segmentPicker: by.descStartsWith('Segment: '),
    matchCount: by.textMatches('[0-9,]+ contacts? match\\.'),
    addTag: by.a11y('Add tag'),
    removeTag: (tag: string) => by.a11y(`Remove tag ${tag}`),
    next: by.a11y('Next'),
    back: by.descClass('Back', 'android.widget.Button'),
    // Some messages exist twice (a View and a TextView): take the first.
    error: (text: string) => `(//*[@text=${JSON.stringify(text)}])[1]`,
    templatePicker: by.descStartsWith('Template: '),
    templateSearch: by.a11y('Search templates'),
    clearSearch: by.a11y('Clear search'),
    templateOption: (name: string) => by.descStartsWith(`${name}, `),
    approved: by.text('Approved'),
    preview: by.a11y('WhatsApp preview'),
    reviewAudience: by.descStartsWith('Audience, '),
    reviewTemplate: by.descStartsWith('Template, '),
    reviewSender: by.descStartsWith('Sender number, '),
    sendNow: by.descClass('Send now', 'android.widget.RadioButton'),
    schedule: by.descClass('Schedule', 'android.widget.RadioButton'),
    sendBroadcast: by.a11y('Send Broadcast'),
    confirmTitle: by.text(BROADCAST_TEXTS.confirmTitle),
    confirmSend: by.a11y('Send Now'),
    cancel: by.a11y('Cancel'),
    discardTitle: by.text(BROADCAST_TEXTS.discardTitle),
    discard: by.a11y('Discard'),
  };

  async step(): Promise<WizardStep> {
    return (await this.el(this.selectors.step).getText()).split(' · ')[1] as WizardStep;
  }

  async waitForStep(step: WizardStep, timeout = 10_000): Promise<void> {
    await driver.waitUntil(async () => (await this.step().catch(() => null)) === step, {
      timeout, timeoutMsg: `Wizard not on step "${step}" within ${timeout} ms`,
    });
  }

  private async scrollTo(selector: string): Promise<void> {
    const el = this.el(selector);
    for (let i = 0; i < 4 && !(await el.isDisplayed()); i++) {
      const { width, height } = await driver.getWindowSize();
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction: i < 2 ? 'down' : 'up', percent: 0.8 });
    }
  }

  // ---- step 1: audience
  async enterName(name: string): Promise<void> {
    await this.scrollTo(this.selectors.name);
    const field = this.el(this.selectors.name);
    await field.click();
    await field.clearValue();
    if (name) await field.setValue(name);
    await this.hideKeyboard();
  }

  async senderNumber(): Promise<string> {
    return ((await this.el(this.selectors.sendFrom).getAttribute('content-desc')) ?? '').replace('Send from: ', '');
  }

  /** Numbers offered in "Send from", in order. Leaves the sheet open. */
  async openSenderOptions(): Promise<string[]> {
    await this.scrollTo(this.selectors.sendFrom);
    await this.tap(this.selectors.sendFrom);
    await this.waitForVisible(`(${this.selectors.sheetOptions('Send from')})[1]`, 10_000, 'Send from options');
    const numbers: string[] = [];
    for (const el of await $$(this.selectors.sheetOptions('Send from'))) numbers.push((await el.getAttribute('content-desc')) ?? '');
    return numbers;
  }

  /** Picks the first connected number in "Send from" and returns it. */
  async chooseFirstSender(): Promise<string> {
    const numbers = await this.openSenderOptions();
    if (!numbers.length) throw new Error('No connected number offered in "Send from"');
    await (await $$(this.selectors.sheetOptions('Send from')))[0]!.click();
    await this.waitForGone('//android.view.View[@text="Send from"]', 5_000, 'Send from sheet');
    return numbers[0]!;
  }

  async chooseAudience(kind: AudienceKind): Promise<void> {
    if (kind === 'All contacts') throw new Error('Refusing to target All contacts from automation');
    await this.scrollTo(this.selectors.audience(kind));
    await this.tap(this.selectors.audience(kind));
  }

  async isAudienceChecked(kind: AudienceKind): Promise<boolean> {
    return (await this.el(this.selectors.audience(kind)).getAttribute('checked')) === 'true';
  }

  async allContactsCount(): Promise<number> {
    const text = await this.el(this.selectors.allContactsCount).getText();
    return Number(text.replace(/[^\d]/g, ''));
  }

  /** Options of the Saved list / Segment picker as { name, count }. Leaves the sheet open. */
  async pickerOptions(kind: 'Saved list' | 'Segment'): Promise<Array<{ name: string; count: number; label: string }>> {
    await this.tap(kind === 'Saved list' ? this.selectors.listPicker : this.selectors.segmentPicker);
    await this.waitForVisible(`(${this.selectors.sheetOptions(kind)})[1]`, 10_000, `${kind} options`);
    const options = [];
    for (const el of await $$(this.selectors.sheetOptions(kind))) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const m = /^(.*) \(([\d,]+)\)$/.exec(label);
      if (m) options.push({ name: m[1]!, count: Number(m[2]!.replace(/,/g, '')), label });
    }
    return options;
  }

  async chooseOption(label: string): Promise<void> {
    await this.tap(by.a11y(label));
  }

  async closeSheet(): Promise<void> {
    await this.tap(this.selectors.sheetClose);
  }

  async matchCount(): Promise<number | null> {
    const el = this.el(this.selectors.matchCount);
    if (!(await el.isExisting())) return null;
    return Number((await el.getText()).replace(/[^\d]/g, ''));
  }

  async addTag(tag: string): Promise<void> {
    await this.scrollTo(this.selectors.addTag);
    const field = this.el(this.selectors.addTag);
    await field.click();
    await field.setValue(tag);
    await driver.pressKeyCode(66);   // Enter turns the text into a tag chip
    await this.waitForVisible(this.selectors.removeTag(tag), 5_000, `Tag chip "${tag}"`);
    await this.hideKeyboard();
  }

  async next(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.next);
  }

  /**
   * Messages near the bottom sit behind the Next/Back bar until the form is scrolled, and UiAutomator
   * only sees on-screen elements, so the form is swiped up (at most 3 times) until the text shows.
   */
  async isErrorShown(text: string): Promise<boolean> {
    const el = this.el(this.selectors.error(text));
    for (let i = 0; i < 4; i++) {
      if (await el.isExisting()) return true;
      const { width, height } = await driver.getWindowSize();
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.3, width: width * 0.8, height: height * 0.4, direction: 'up', percent: 0.8 });
    }
    return false;
  }

  // ---- step 2: template
  /**
   * Opens the template sheet. Sometimes only its dimmed backdrop appears and the sheet never slides up
   * (seen in run 20261031-133943); then the backdrop is tapped away and the picker opened once more.
   */
  private async openTemplatePicker(): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.hideKeyboard();
      await this.tap(this.selectors.templatePicker);
      if (await this.el(this.selectors.templateSearch).waitForDisplayed({ timeout: 8_000 }).then(() => true, () => false)) return;
      const backdrop = this.el('//android.view.ViewGroup[@content-desc="Close"]');
      if (await backdrop.isExisting()) await backdrop.click();
      await driver.pause(1_000);
    }
    await this.waitForVisible(this.selectors.templateSearch, 1_000, 'Template picker');
  }

  /** Opens the picker and searches; returns the names offered. Leaves the sheet open. */
  async searchTemplates(text: string): Promise<string[]> {
    if (!(await this.el(this.selectors.templateSearch).isExisting())) await this.openTemplatePicker();
    const field = this.el(this.selectors.templateSearch);
    await field.waitForDisplayed();
    // The field keeps the last search; clear it with its X (typing into it inserts mid-text).
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await driver.pause(1_500);   // results filter as you type
    const names: string[] = [];
    for (const el of await $$('//android.widget.Button[contains(@content-desc, ", ") and @content-desc!="Close"]')) {
      names.push(((await el.getAttribute('content-desc')) ?? '').split(', ')[0]!);
    }
    return names;
  }

  async isNoTemplatesShown(): Promise<boolean> {
    return (await this.el(by.text(BROADCAST_TEXTS.noTemplates)).isExisting()) && this.el(by.text(BROADCAST_TEXTS.noTemplatesHint)).isExisting();
  }

  async chooseTemplate(name: string): Promise<void> {
    await this.searchTemplates(name);
    await this.tap(this.selectors.templateOption(name));
    await this.waitForVisible(by.a11y(`Template: ${name}`), 10_000, `Template "${name}" selected`);
  }

  /** "Marketing", "Approved", "English" chips and whether the WhatsApp preview is shown. */
  async templateDetails(): Promise<{ approved: boolean; preview: boolean }> {
    return { approved: await this.el(this.selectors.approved).isExisting(), preview: await this.el(this.selectors.preview).isExisting() };
  }

  async backToPreviousStep(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.back);
  }

  // ---- step 3: review
  async review(): Promise<{ audience: string; template: string; sender: string; sendNow: boolean }> {
    const desc = async (sel: string, prefix: string) => ((await this.el(sel).getAttribute('content-desc')) ?? '').replace(prefix, '');
    return {
      audience: await desc(this.selectors.reviewAudience, 'Audience, '),
      template: await desc(this.selectors.reviewTemplate, 'Template, '),
      sender: await desc(this.selectors.reviewSender, 'Sender number, '),
      sendNow: (await this.el(this.selectors.sendNow).getAttribute('checked')) === 'true',
    };
  }

  /** Taps "Send Broadcast" and waits for the confirmation; returns its message. Sends nothing. */
  async openSendConfirmation(): Promise<string> {
    await this.tap(this.selectors.sendBroadcast);
    await this.waitForVisible(this.selectors.confirmTitle, 10_000, 'Send confirmation');
    return this.el(`${'//android.view.View[@text="Send this broadcast?"]'}/following-sibling::android.widget.TextView[1]`).getText();
  }

  async cancelConfirmation(): Promise<void> {
    await this.tap(this.selectors.cancel);
    await this.waitForGone(this.selectors.confirmTitle, 5_000, 'Send confirmation');
  }

  /** The only call that sends. Taps "Send Now" exactly once; never retried. */
  async confirmSend(): Promise<void> {
    await this.tap(this.selectors.confirmSend);
  }

  // ---- leaving
  async close(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.close);
    await this.waitForVisible(this.selectors.discardTitle, 5_000, 'Discard confirmation');
  }

  async isDiscardMessageShown(): Promise<boolean> {
    return this.el(by.text(BROADCAST_TEXTS.discardMessage)).isExisting();
  }

  async discard(): Promise<void> {
    await this.tap(this.selectors.discard);
  }

  async keepEditing(): Promise<void> {
    await this.tap(this.selectors.cancel);
    await this.waitForGone(this.selectors.discardTitle, 5_000, 'Discard confirmation');
  }
}

export const newBroadcastPage = new NewBroadcastPage();
