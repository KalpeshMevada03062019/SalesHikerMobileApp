// More > SALES > Sales orders: the list (status chips, search) and a sales order's detail with its line
// items, totals, related records (the quotation it came from) and Sales order actions menu. Live app on the
// phone, 2026-11-05. The screens are the shared sales-document screens (SalesDocumentPages.ts).
//
// Read only: New sales order, Download PDF, Edit and every menu action (Change status, Convert to invoice,
// Create delivery note, Add expense, View PDF, Notes, Add task, Edit, Delete) are never tapped.
import { SalesListPage, SalesDetailPage, type SalesRow } from './SalesDocumentPages.js';

export type SalesOrderRow = SalesRow;

export const SALES_ORDER_STATUSES = ['Draft', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'] as const;
export const SALES_ORDER_ACTIONS = ['Change status', 'Convert to invoice', 'Create delivery note', 'Add expense', 'View PDF', 'Notes', 'Add task', 'Edit', 'Delete'] as const;

export const SALES_ORDER_TEXTS = {
  searchHint: 'Search order number or subject',
  noOrders: 'No sales orders found',
  noOrdersHint: 'Try another search or status.',
};

export const salesOrdersPage = new SalesListPage({
  title: 'Sales orders',
  searchHint: SALES_ORDER_TEXTS.searchHint,
  statuses: SALES_ORDER_STATUSES,
  noResults: SALES_ORDER_TEXTS.noOrders,
  noResultsHint: SALES_ORDER_TEXTS.noOrdersHint,
  newButton: 'New sales order',
});

export const salesOrderDetailPage = new SalesDetailPage({
  title: 'Sales order',
  summary: 'Sales order summary',
  numberPrefixes: ['SO-', 'E2E-SO-'],
  menuTitle: 'Sales order actions',
});
