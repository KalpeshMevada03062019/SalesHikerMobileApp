// More > SALES > Quotations: the list (status chips, search) and a quotation's detail with its line items,
// totals, related records and Quotation actions menu. Live app on the phone, 2026-11-05. The screens are the
// shared sales-document screens (SalesDocumentPages.ts).
//
// Read only: Change status, Convert to sales order, View PDF, Share link, Download PDF and Share are never
// tapped.
import { SalesListPage, SalesDetailPage, type SalesRow } from './SalesDocumentPages.js';

export { money } from './SalesDocumentPages.js';
export type QuotationRow = SalesRow;

export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'] as const;
export const QUOTATION_ACTIONS = ['Change status', 'Convert to sales order', 'View PDF', 'Share link'] as const;

export const QUOTATION_TEXTS = {
  searchHint: 'Search quotations',
  noQuotations: 'No quotations found',
  noQuotationsHint: 'Try another search or status.',
  shareHint: 'Share sends a link your customer can open and print.',
  hasSalesOrder: 'This quotation already has a sales order.',
};

export const quotationsPage = new SalesListPage({
  title: 'Quotations',
  searchHint: QUOTATION_TEXTS.searchHint,
  statuses: QUOTATION_STATUSES,
  noResults: QUOTATION_TEXTS.noQuotations,
  noResultsHint: QUOTATION_TEXTS.noQuotationsHint,
});

export const quotationDetailPage = new SalesDetailPage({
  title: 'Quotation',
  summary: 'Quotation summary',
  numberPrefixes: ['QT-', 'QUO-'],
  menuTitle: 'Quotation actions',
});
