// Deals tab ("Pipeline"): stage strip, deals by stage, search, Mine; and a deal's detail screen with the
// Move Stage sheet, Mark Won / Mark Lost and the Edit Deal form. Live app on the phone, 2026-11-02,
// compared with the web Deals board (accountsbeta.saleshiker.com/t/<workspace>/deals?view=kanban).
import { BasePage, by } from './BasePage.js';

/** Stages in pipeline order, as the phone names them, with the web's names for comparison. */
export const PIPELINE_STAGES = [
  { mobile: 'Qualification', web: 'Qualification', progress: 17 },
  { mobile: 'Needs Analysis', web: 'Needs Analysis', progress: 33 },
  { mobile: 'Value Proposal', web: 'Value Proposition', progress: 50 },
  { mobile: 'Proposal', web: 'Proposal / Price Quote', progress: 67 },
  { mobile: 'Negotiation', web: 'Negotiation / Review', progress: 83 },
  { mobile: 'Won', web: 'Won', progress: 100 },
  { mobile: 'Lost', web: 'Lost', progress: null },   // what a lost deal should show is MPIP-D03
] as const;
export type StageName = (typeof PIPELINE_STAGES)[number]['mobile'];

export const PIPELINE_TEXTS = {
  noDeals: 'No deals match',
  enterName: 'Enter a deal name.',
  probabilityRange: 'Enter a whole number from 0 to 100.',
  discardTitle: 'Discard changes?',
  discardMessage: 'Your changes to this deal are not saved.',
};

/** "1,00,007" (Indian grouping) / "100,007" -> 100007 */
const num = (t: string) => Number(t.replace(/[^\d]/g, ''));

export interface StageCard { name: string; count: number; amount: string; selected: boolean }
/** Deal card: content-desc "<name>, ₹<amount>, <number>[, <owner or contact>][, <date>][, Overdue]". */
export interface DealCard { name: string; amount: string; number: string; label: string }

export class PipelinePage extends BasePage {
  protected readonly marker = '//android.view.View[@text="Pipeline"]';

  readonly selectors = {
    tab: by.a11y('Deals'),                                         // bottom navigation
    total: by.textMatches('[0-9,]+ deals?'),
    search: by.descClass('Search deals', 'android.widget.EditText'),
    clearSearch: by.a11y('Clear search'),
    mine: by.descClass('Mine', 'android.widget.Button'),
    stageCard: (name: string) => `android=new UiSelector().className("android.view.View").descriptionMatches(${JSON.stringify(`${name}, [0-9,]+ deals?, .*`)})`,
    stageCards: '//android.view.View[contains(@content-desc, " deals, ") or contains(@content-desc, " deal, ")]',
    sectionTitle: (name: string) => `//android.view.View[@text=${JSON.stringify(name.toUpperCase())}]`,
    dealCards: '//android.widget.Button[contains(@content-desc, ", ₹")]',
    dealCard: (number: string) => `//android.widget.Button[contains(@content-desc, ${JSON.stringify(`, ${number}`)})]`,
    progress: '//android.view.View[starts-with(@content-desc, "Deal progress ")]',
    noDeals: by.text(PIPELINE_TEXTS.noDeals),
  };

  async open(): Promise<void> {
    await this.tap(this.selectors.tab);
    await this.waitForDisplayed(30_000);
    await this.waitForVisible(`(${this.selectors.dealCards})[1]`, 30_000, 'Deal cards');
  }

  async total(): Promise<number> {
    return num(await this.el(this.selectors.total).getText());
  }

  /** Brings a stage card into view (the strip scrolls sideways) and returns it. */
  private async stageInView(name: StageName): Promise<WebdriverIO.Element> {
    await $(`android=new UiScrollable(new UiSelector().description("Deal stages")).setAsHorizontalList().scrollIntoView(${this.selectors.stageCard(name).replace('android=', '')})`).isExisting().catch(() => false);
    const card = await this.el(this.selectors.stageCard(name)).getElement();
    await card.waitForExist({ timeout: 10_000, timeoutMsg: `Stage card "${name}" not found` });
    // A card cut off at the screen edge cannot be tapped reliably: centre it with a short swipe.
    const { width } = await driver.getWindowSize();
    const { x, y } = await card.getLocation();
    const { width: w, height: h } = await card.getSize();
    if (x <= 2 || x + w >= width - 2) {
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: y, width: width * 0.8, height: h, direction: x <= 2 ? 'right' : 'left', percent: 0.4 });
    }
    return card;
  }

  async stageCard(name: StageName): Promise<StageCard> {
    const card = await this.stageInView(name);
    const label = (await card.getAttribute('content-desc')) ?? '';
    const [, count, amount] = /^.+, ([0-9,]+) deals?, (.+)$/.exec(label) ?? [];
    return { name, count: num(count ?? ''), amount: amount ?? '', selected: (await card.getAttribute('selected')) === 'true' };
  }

  /** Every stage card, in strip order. */
  async stageCards(): Promise<StageCard[]> {
    const cards: StageCard[] = [];
    for (const s of PIPELINE_STAGES) cards.push(await this.stageCard(s.mobile));
    return cards;
  }

  /** Stage names in strip order, read from the strip itself (not from PIPELINE_STAGES). */
  async stageNamesOnScreen(): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < 6; i++) {
      for (const el of await $$(this.selectors.stageCards)) {
        const name = ((await el.getAttribute('content-desc')) ?? '').split(', ')[0]!;
        if (name && !names.includes(name)) names.push(name);
      }
      const { width } = await driver.getWindowSize();
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: 488, width: width * 0.8, height: 150, direction: 'left', percent: 0.8 });
    }
    return names;
  }

  async selectStage(name: StageName): Promise<void> {
    const card = await this.stageInView(name);
    await card.click();
    await this.waitForVisible(this.selectors.sectionTitle(name), 15_000, `${name} section`);
  }

  async visibleDeals(): Promise<DealCard[]> {
    const deals: DealCard[] = [];
    for (const el of await $$(this.selectors.dealCards)) {
      const label = ((await el.getAttribute('content-desc')) ?? '').replace(/\s+/g, ' ');
      const [name, amount, number] = label.split(', ');
      deals.push({ name: name!, amount: amount!, number: number!, label });
    }
    return deals;
  }

  async firstProgress(): Promise<number | null> {
    const el = this.el(`(${this.selectors.progress})[1]`);
    if (!(await el.isExisting())) return null;
    return Number(((await el.getAttribute('content-desc')) ?? '').replace(/[^\d]/g, ''));
  }

  async search(text: string): Promise<void> {
    const field = this.el(this.selectors.search);
    await field.waitForDisplayed();
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
    await field.click();
    await field.setValue(text);
    await this.hideKeyboard();
    await driver.pause(2_000);   // results load after typing
  }

  async clearSearch(): Promise<void> {
    if (await this.el(this.selectors.clearSearch).isExisting()) await this.tap(this.selectors.clearSearch);
  }

  async toggleMine(): Promise<boolean> {
    await this.tap(this.selectors.mine);
    await driver.pause(2_000);
    return (await this.el(this.selectors.mine).getAttribute('selected')) === 'true';
  }

  async isNoDealsShown(timeout = 15_000): Promise<boolean> {
    try { await this.waitForVisible(this.selectors.noDeals, timeout); return true; } catch { return false; }
  }

  /** Searches a deal by number and returns its card (or null). */
  async findDeal(number: string): Promise<DealCard | null> {
    await this.search(number);
    try { await this.waitForVisible(this.selectors.dealCard(number), 20_000, `Deal ${number}`); } catch { return null; }
    return (await this.visibleDeals()).find((d) => d.number === number) ?? null;
  }

  async openDeal(number: string): Promise<void> {
    await this.tap(this.selectors.dealCard(number));
  }

  /** Name of the stage section the deal is listed under ("NEEDS ANALYSIS" -> "Needs Analysis"). */
  async sectionOf(number: string): Promise<string | null> {
    const titles = await $$('//android.view.View[string-length(@text) > 2 and translate(@text, "ABCDEFGHIJKLMNOPQRSTUVWXYZ /", "") = ""]');
    const card = await this.el(this.selectors.dealCard(number)).getLocation().catch(() => null);
    if (!card) return null;
    let best: string | null = null;
    for (const t of titles) {
      const { y } = await t.getLocation();
      if (y < card.y) best = await t.getText();
    }
    return best ? PIPELINE_STAGES.find((s) => s.mobile.toUpperCase() === best)?.mobile ?? best : null;
  }
}

export class DealPage extends BasePage {
  protected readonly marker = by.descStartsWith('Change Stage, ');

  readonly selectors = {
    back: by.descClass('Back', 'android.widget.Button'),
    number: (n: string) => by.text(n),
    changeStage: by.descStartsWith('Change Stage, '),
    stageLabel: by.textMatches('(Stage [0-9] of [0-9] · .+|Won|Lost)'),
    progress: '//android.view.View[starts-with(@content-desc, "Deal progress ")]',
    probability: by.descStartsWith('Probability '),
    markWon: by.a11y('Mark Won'),
    markLost: by.a11y('Mark Lost'),
    amount: by.descStartsWith('Amount '),
    moveSheet: '//android.view.View[@text="Move Stage"]',
    moveOption: (name: string) => by.descClass(name, 'android.widget.Button'),
    moveOptions: '//android.view.View[@text="Move Stage"]/following::android.widget.Button[@content-desc!="Close"]',
    sheetClose: '//android.widget.Button[@content-desc="Close"]',
    // Edit Deal form
    editTitle: '//android.view.View[@text="Edit Deal"]',
    nameField: by.descClass('Deal name', 'android.widget.EditText'),
    amountField: by.descClass('Amount (₹)', 'android.widget.EditText'),
    probabilityField: by.descClass('Probability %', 'android.widget.EditText'),
    save: by.a11y('Save'),
    cancel: by.descClass('Cancel', 'android.widget.Button'),
    error: (t: string) => `(//*[@text=${JSON.stringify(t)}])[1]`,
    discardTitle: by.text(PIPELINE_TEXTS.discardTitle),
    discardMessage: by.text(PIPELINE_TEXTS.discardMessage),
    discard: by.a11y('Discard'),
  };

  /** Scrolls the detail back to the top, where the stage chip, amount and progress are. */
  async scrollToTop(): Promise<void> {
    await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollToBeginning(5)').isExisting().catch(() => false);
  }

  async stage(): Promise<string> {
    return ((await this.el(this.selectors.changeStage).getAttribute('content-desc')) ?? '').replace('Change Stage, ', '');
  }

  async stageLabel(): Promise<string> {
    await this.scrollToTop();
    return this.el(this.selectors.stageLabel).getText();
  }

  async progress(): Promise<number> {
    await this.scrollToTop();
    return Number(((await this.el(this.selectors.progress).getAttribute('content-desc')) ?? '').replace(/[^\d]/g, ''));
  }

  async probability(): Promise<number | null> {
    const el = this.el(this.selectors.probability);
    if (!(await el.isExisting())) return null;
    return Number(((await el.getAttribute('content-desc')) ?? '').replace(/[^\d]/g, ''));
  }

  async hasMarkButtons(): Promise<boolean> {
    return (await this.el(this.selectors.markWon).isExisting()) && this.el(this.selectors.markLost).isExisting();
  }

  /** Opens Move Stage and returns its options ("Qualification (Current)", "Needs Analysis", ...). */
  async openMoveStage(): Promise<string[]> {
    await this.tap(this.selectors.changeStage);
    await this.waitForVisible(this.selectors.moveSheet, 10_000, 'Move Stage sheet');
    const options: string[] = [];
    for (const el of await $$(this.selectors.moveOptions)) options.push((await el.getAttribute('content-desc')) ?? '');
    return options;
  }

  async closeMoveStage(): Promise<void> {
    await this.tap(this.selectors.sheetClose);
    await this.waitForGone(this.selectors.moveSheet, 5_000, 'Move Stage sheet');
  }

  /** Moves the deal (applies at once; the app asks no confirmation). */
  async moveTo(stage: StageName): Promise<void> {
    await this.openMoveStage();
    await this.tap(this.selectors.moveOption(stage));
    await driver.waitUntil(async () => (await this.stage().catch(() => '')) === stage, { timeout: 15_000, timeoutMsg: `Stage did not change to ${stage}` });
  }

  async markWon(): Promise<void> {
    await this.tap(this.selectors.markWon);
    await driver.waitUntil(async () => (await this.stage().catch(() => '')) === 'Won', { timeout: 15_000, timeoutMsg: 'Deal not marked Won' });
  }

  async markLost(): Promise<void> {
    await this.tap(this.selectors.markLost);
    await driver.waitUntil(async () => (await this.stage().catch(() => '')) === 'Lost', { timeout: 15_000, timeoutMsg: 'Deal not marked Lost' });
  }

  // ---- Edit Deal form
  async openEdit(): Promise<void> {
    await this.scrollToTop();
    await this.tap(this.selectors.amount);
    await this.waitForVisible(this.selectors.nameField, 10_000, 'Edit Deal form');
  }

  async setField(selector: string, value: string): Promise<void> {
    const field = this.el(selector);
    await field.click();
    await field.clearValue();
    if (value) await field.setValue(value);
    await this.hideKeyboard();
  }

  async save(): Promise<void> {
    await this.tap(this.selectors.save);
    await driver.pause(1_500);
  }

  async isErrorShown(t: string): Promise<boolean> {
    return this.el(this.selectors.error(t)).isExisting();
  }

  /** Cancel; when there are unsaved changes the app asks "Discard changes?" and this discards them. */
  async cancelEdit(): Promise<{ asked: boolean; message: boolean }> {
    await this.tap(this.selectors.cancel);
    const asked = await this.el(this.selectors.discardTitle).waitForDisplayed({ timeout: 4_000 }).then(() => true, () => false);
    const message = asked && (await this.el(this.selectors.discardMessage).isExisting());
    if (asked) await this.tap(this.selectors.discard);
    await this.waitForDisplayed(10_000);
    return { asked, message };
  }

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }
}

export const pipelinePage = new PipelinePage();
export const dealPage = new DealPage();
