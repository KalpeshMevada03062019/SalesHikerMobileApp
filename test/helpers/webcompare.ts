// Compares the totals a sales document shows on the phone with the web reference values (webTotals in testData).
import { checkpoint } from '../../src/utils/evidence.js';
import { newInvoicePage, type NewLine } from '../../src/pages/InvoicesPage.js';
import { newInvoiceData } from '../../src/data/testData.js';

const cents = (n: number) => Math.round(n * 100);

export interface Breakdown { subtotal: number; added: number; deducted: number; total: number }
export interface WebTotals { subtotal?: number; added?: number; deducted?: number; total: number }

/** Phone totals block (Subtotal, tax rows, Total) as subtotal, added taxes, deducted taxes and total. */
export function breakdown(totals: { label: string; amount: number }[]): Breakdown {
  const rows = totals.filter((t) => t.label !== 'Subtotal' && t.label !== 'Total');
  return {
    subtotal: totals.find((t) => t.label === 'Subtotal')?.amount ?? NaN,
    added: rows.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    deducted: -rows.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
    total: totals.find((t) => t.label === 'Total')?.amount ?? NaN,
  };
}

/** "what: phone x, web y" for every value that differs (to the paisa); web values left out are not compared. */
export function differences(what: string, phone: Record<string, number>, web: Record<string, number | undefined>): string[] {
  const out: string[] = [];
  for (const [k, w] of Object.entries(web)) {
    if (w === undefined || typeof w !== 'number') continue;
    const p = phone[k];
    if (p === undefined || Number.isNaN(p) || cents(p) !== cents(w)) out.push(`${what} ${k}: phone ${p?.toFixed(2)}, web ${w.toFixed(2)}`);
  }
  return out;
}

/** On an open New invoice / New sales order form: the two lines of newInvoiceData; returns the line totals and Lines total. */
export async function fillWebComparisonLines(form: typeof newInvoicePage, id: string): Promise<{ lines: number[]; total: number }> {
  for (const l of newInvoiceData.lines as readonly NewLine[]) await form.addLine(l);
  const lines = (await form.formLines()).map((l) => l.total);
  const total = await form.linesTotal();
  await checkpoint(`${id} form`);
  return { lines, total };
}
