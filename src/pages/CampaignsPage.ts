// WhatsApp > Campaigns list (More > Campaigns). Read-only on mobile: campaigns are built and edited
// on the web app. Selectors and texts come from the live app on the phone, 2026-10-30.
import { BasePage, by } from './BasePage.js';

export const CAMPAIGN_FILTERS = ['All', 'Drip', 'Retarget', 'Active', 'Paused'] as const;
export type CampaignFilter = (typeof CAMPAIGN_FILTERS)[number];
export const CAMPAIGN_TYPES = ['Drip', 'Retarget'] as const;
export const CAMPAIGN_STATUSES = ['Active', 'Paused'] as const;

export const CAMPAIGN_TEXTS = {
  endOfList: 'End of list. Edit steps or build new campaigns on the web app.',
  noResults: 'No campaigns found',
  noResultsHint: 'Try another name, type or status.',
  clearFilters: 'Clear Filters',
};

/** One list row. Its content-desc reads "<name>, <date>, <type>, <n> enrolled, <n> sent, <status>". */
export interface CampaignRow {
  name: string;
  date: string;
  type: string;
  enrolled: number;
  sent: number;
  status: string;
  label: string;
}

// The name may itself contain ", ", so the fixed fields are matched from the end.
const ROW_PATTERN = /^(.*), (\d{1,2} [A-Z][a-z]{2}(?: \d{4})?), ([^,]+), (\d+) enrolled, (\d+) sent, ([^,]+)$/;

export function parseCampaignRow(label: string): CampaignRow | null {
  const m = ROW_PATTERN.exec(label);
  if (!m) return null;
  return { name: m[1]!, date: m[2]!, type: m[3]!, enrolled: Number(m[4]), sent: Number(m[5]), status: m[6]!, label };
}

export class CampaignsPage extends BasePage {
  protected readonly marker = by.a11y('Search campaigns');

  readonly selectors = {
    back: by.a11y('Back'),
    title: '//android.view.View[@text="Campaigns"]',
    // Total under the title; hidden while a search is typed.
    headerCount: '//android.view.View[@text="Campaigns"]/following-sibling::android.widget.TextView[1]',
    search: by.a11y('Search campaigns'),
    clearSearch: by.a11y('Clear search'),
    rows: '//android.widget.Button[contains(@content-desc, " enrolled, ")]',
    endOfList: by.text(CAMPAIGN_TEXTS.endOfList),
    noResults: by.text(CAMPAIGN_TEXTS.noResults),
    noResultsHint: by.text(CAMPAIGN_TEXTS.noResultsHint),
    clearFilters: by.a11y(CAMPAIGN_TEXTS.clearFilters),
    chip: (filter: CampaignFilter) => `android=new UiSelector().descriptionMatches(${JSON.stringify(`${filter}, [0-9]+`)})`,
  };

  async goBack(): Promise<void> {
    await this.tap(this.selectors.back);
  }

  /** Number under the title, or null while it is hidden (during a search). */
  async headerCount(): Promise<number | null> {
    const el = this.el(this.selectors.headerCount);
    if (!(await el.isExisting())) return null;
    const text = await el.getText();
    return /^\d+$/.test(text) ? Number(text) : null;
  }

  // ---- filter chips
  /**
   * Brings a chip fully into view. The chip row scrolls sideways: "Paused" starts off-screen, and after
   * selecting it "All" is off-screen, and UiAutomator cannot see off-screen elements at all.
   */
  private async chipInView(filter: CampaignFilter): Promise<WebdriverIO.Element> {
    const regex = JSON.stringify(`${filter}, [0-9]+`);
    await $(`android=new UiScrollable(new UiSelector().className("android.widget.HorizontalScrollView")).setAsHorizontalList().scrollIntoView(new UiSelector().descriptionMatches(${regex}))`)
      .isExisting().catch(() => false);
    const chip = await this.el(this.selectors.chip(filter)).getElement();
    await chip.waitForExist({ timeout: 10_000, timeoutMsg: `Filter chip "${filter}" not found` });
    // scrollIntoView stops once a sliver is visible; finish with a swipe so the tap lands on the chip.
    const { width } = await driver.getWindowSize();
    // Bounds are clipped to the screen, so a cut-off chip looks complete but touches an edge
    // (seen: "Paused" at x 704-720 of 720, where a tap does not select it).
    for (let i = 0; i < 3; i++) {
      const { x, y } = await chip.getLocation();
      const size = await chip.getSize();
      const cutRight = x + size.width >= width - 2;
      const cutLeft = x <= 2;
      if (!cutRight && !cutLeft) break;
      const direction = cutRight ? 'left' : 'right';
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: y, width: width * 0.8, height: size.height, direction, percent: 0.7 });
    }
    return chip;
  }

  async selectFilter(filter: CampaignFilter): Promise<void> {
    await this.hideKeyboard();
    const chip = await this.chipInView(filter);
    await chip.click();
    // The list re-renders after the tap, so look the chip up again on every check.
    await driver.waitUntil(async () => (await $(this.selectors.chip(filter)).getAttribute('selected').catch(() => null)) === 'true', {
      timeout: 5_000, timeoutMsg: `Filter "${filter}" not marked selected`,
    });
  }

  /** Count shown on the chip ("Drip, 5" -> 5). */
  async filterCount(filter: CampaignFilter): Promise<number> {
    const label = (await (await this.chipInView(filter)).getAttribute('content-desc')) ?? '';
    return Number(label.split(', ').pop());
  }

  async filterCounts(): Promise<Record<CampaignFilter, number>> {
    const counts = {} as Record<CampaignFilter, number>;
    for (const f of CAMPAIGN_FILTERS) counts[f] = await this.filterCount(f);
    return counts;
  }

  async selectedFilter(): Promise<CampaignFilter | null> {
    for (const f of CAMPAIGN_FILTERS) {
      if ((await (await this.chipInView(f)).getAttribute('selected')) === 'true') return f;
    }
    return null;
  }

  // ---- search
  async search(text: string): Promise<void> {
    const field = this.el(this.selectors.search);
    await field.waitForDisplayed();
    await field.click();
    await field.setValue(text);   // the list filters as you type, no submit
    await this.hideKeyboard();
  }

  async searchText(): Promise<string> {
    const text = await this.el(this.selectors.search).getText();
    return text === 'Search campaigns' ? '' : text;   // empty field reports its hint
  }

  /** Taps the X in the search field and waits until it is gone (field empty again). */
  async clearSearch(): Promise<void> {
    await this.tap(this.selectors.clearSearch);
    await this.waitForGone(this.selectors.clearSearch, 5_000, 'Clear search button');
  }

  /** Clear Filters in the empty state. Closes the keyboard first: with it open, the first tap only dismisses it. */
  async clearFilters(): Promise<void> {
    await this.hideKeyboard();
    await this.tap(this.selectors.clearFilters);
    await this.waitForGone(this.selectors.noResults, 5_000, 'Empty state');
  }

  async isEmptyStateShown(timeout = 5_000): Promise<boolean> {
    try {
      await this.waitForVisible(this.selectors.noResults, timeout);
      return this.isVisible(this.selectors.noResultsHint);
    } catch {
      return false;
    }
  }

  async isEndOfListShown(): Promise<boolean> {
    return this.isVisible(this.selectors.endOfList);
  }

  // ---- rows
  /** The screen shows before the campaigns arrive: wait for rows, or for the empty state. */
  async waitForLoaded(timeout = 20_000): Promise<void> {
    await driver.waitUntil(async () => (await $$(this.selectors.rows).length) > 0 || this.el(this.selectors.noResults).isExisting(), {
      timeout, timeoutMsg: `No campaign rows or empty state within ${timeout} ms`,
    });
  }

  async visibleRows(): Promise<CampaignRow[]> {
    const rows: CampaignRow[] = [];
    for (const el of await $$(this.selectors.rows)) {
      const label = (await el.getAttribute('content-desc')) ?? '';
      const row = parseCampaignRow(label);
      if (!row) throw new Error(`Campaign row label not in the expected format: "${label}"`);
      rows.push(row);
    }
    return rows;
  }

  /**
   * All rows of the current list, scrolling down until the end-of-list footer. Rows can be
   * identical (same name, date and counts), so pages are joined on their overlap, not deduplicated.
   */
  async allRows(maxScrolls = 15): Promise<CampaignRow[]> {
    await this.hideKeyboard();
    let all = await this.visibleRows();
    for (let i = 0; i < maxScrolls && !(await this.isEndOfListShown()); i++) {
      const { width, height } = await driver.getWindowSize();
      await driver.execute('mobile: swipeGesture', { left: width * 0.1, top: height * 0.35, width: width * 0.8, height: height * 0.4, direction: 'up', percent: 0.75 });
      const page = await this.visibleRows();
      const labels = page.map((r) => r.label);
      let overlap = Math.min(page.length, all.length);
      while (overlap > 0 && all.slice(-overlap).map((r) => r.label).join('\n') !== labels.slice(0, overlap).join('\n')) overlap--;
      all = all.concat(page.slice(overlap));
    }
    return all;
  }

  /** Opens the row at a position in the visible list (0 = first). */
  async openRow(index = 0): Promise<CampaignRow> {
    await this.hideKeyboard();
    const els = await $$(this.selectors.rows);
    if (index >= els.length) throw new Error(`Only ${els.length} campaign rows visible, cannot open row ${index}`);
    const row = parseCampaignRow((await els[index]!.getAttribute('content-desc')) ?? '')!;
    await els[index]!.click();
    return row;
  }

  /** Opens the first visible row matching a predicate; returns null if none matches. */
  async openFirstRowWhere(match: (row: CampaignRow) => boolean): Promise<CampaignRow | null> {
    const rows = await this.visibleRows();
    const index = rows.findIndex(match);
    return index < 0 ? null : this.openRow(index);
  }
}

export const campaignsPage = new CampaignsPage();
