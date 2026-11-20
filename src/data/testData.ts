// Test inputs. The real account comes from config/.env (TEST_USERNAME / TEST_PASSWORD) and is never
// written here; everything below is deliberately fake (example.com is reserved and never a real user).
import { settings } from '../config/settings.js';

export const account = {
  get email(): string { return settings.testUser.email; },
  get password(): string { return settings.testUser.password; },
};

export const fake = {
  unknownEmail: 'qa.nonexistent.user@example.com',
  wellFormedEmail: 'qa.user@example.com',
  malformedEmail: 'not-an-email',
  wrongPassword: 'WrongPassword123!',
  password: 'Secret123',
  whitespacePassword: '     ',
  injection: "' OR '1'='1",
  /** 250-character local part; RFC 5321 allows 64. */
  overlongEmail: `${'a'.repeat(250)}@example.com`,
};

/** Swaps the case of every letter (used to prove the password is case-sensitive). */
export const swapCase = (value: string): string =>
  [...value].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');

/** Campaign search inputs. Campaign names themselves are read from the live list, never hard-coded. */
export const campaignSearch = {
  noMatch: 'qa-no-such-campaign-zz',
};

/**
 * One approved template per WhatsApp message type, as offered by the Inbox "Send Template" sheet on
 * 2026-11-02. `expect` is text from the template that the sent bubble must contain; `values` fill its
 * "Value for {{n}}" fields. `defect` marks types the app cannot send yet (the test fails until fixed).
 */
export const inboxTemplates = [
  { id: 'MINB-010', type: 'text with quick-reply and call buttons', name: 'call_phone_message', values: [], expect: 'Welcome to SalesHiker!' },
  { id: 'MINB-011', type: 'body variables', name: 'testvarbody', values: ['QA', 'mobile automation'], expect: 'Hello QA this is testing template for body' },
  { id: 'MINB-012', type: 'image header', name: 'image', values: [], expect: 'Hello test new' },
  { id: 'MINB-013', type: 'carousel', name: 'saleshiker_plan_carousel', values: [], expect: 'Grow Your Business with SalesHiker CRM' },
  { id: 'MINB-014', type: 'utility category with a variable', name: 'test_new543', values: ['QA'], expect: 'This template is used for testing purposes only' },
  { id: 'MINB-015', type: 'flow button', name: 'test_flow', values: [], expect: 'Hello world!' },
  { id: 'MINB-016', type: 'text header variable and buttons', name: 'button_template', values: [], expect: 'Track Order', defect: 'MINB-D01' },   // the app offers no field for the header {{1}} (MINB-D01)
  { id: 'MINB-017', type: 'location header', name: 'location_template', values: [], expect: 'Check Our New Loction', defect: 'MINB-D02' },
  { id: 'MINB-018', type: 'authentication (one-time code)', name: 'onetap_otp', values: ['123456'], expect: 'is your verification code', defect: 'MINB-D03' },
] as const;

/**
 * Pipeline: the ONLY deal the tests may change (stage moves, Won/Lost), always put back to Qualification;
 * and a deal assigned to the signed-in user (read-only, for the Mine filter). Both are QA deals in the
 * beta workspace, checked live on 2026-11-02.
 */
export const pipelineData = {
  testDeal: { number: 'DL-100005', name: 'QA-TEST-MGR Deal', homeStage: 'Qualification' as const },
  myDeal: { number: 'DL-100002', owner: 'Yash' },
  noMatch: 'qa-no-such-deal-zz',
};

/** Templates (read only): an approved template with three buttons, and invalid input for the form. */
export const templateData = {
  approved: { name: 'call_phone_message', category: 'Marketing', language: 'English', header: 'Text', buttons: ['Quick Reply', 'Stop Promotions', 'Call Phone Number'] },
  invalidName: 'Bad Name!',
  normalisedInvalidName: 'bad_name!',   // the app lower-cases and replaces spaces as you type, but keeps "!"
  previewBody: 'QA preview check',
  noMatch: 'qa_no_such_template_zz',
};

/** Chatbots (read only). */
export const chatbotData = {
  noMatch: 'qa_no_such_chatbot_zz',
};

export const aiAgentData = {
  noMatch: 'qa_no_such_agent_zz',
};

export const whatsAppLogData = {
  noMatch: 'qa_no_such_log_zz',
};

export const workflowData = {
  noMatch: 'qa_no_such_workflow_zz',
};

/** Leads: a lead with a linked contact, an enquiry and activity on beta (read only). */
export const leadData = {
  withContact: 'Pharmacy chain - WhatsApp CRM Enterprise, 12 users',
  withContactSearch: 'Pharmacy',
  source: 'Manual',
  noMatch: 'qa_no_such_lead_zz',
};

/** Seed organization on beta with every section filled in (read only). */
export const organizationData = {
  name: 'Seed — Acme Corp',
  search: 'acme',
  domain: 'acme.com',
  noMatch: 'qa_no_such_org_zz',
};

/** Beta tasks (read only). "verify" matches two titles and one description ("verifying ..."). */
export const taskData = {
  search: 'verify',
  titleMatch: 'Verify 184-186',
  descriptionMatch: 'QA-TEST-R12 Task 1',
  assignee: 'Yash',
  priority: 'High',
  noMatch: 'qa_no_such_task_zz',
};

/** Beta documents (read only). "qa" matches three names in any letter case. */
export const documentData = {
  search: 'qa',
  noMatch: 'qa_no_such_doc_zz',
};

/** The beta ticket (read only): TT1 "Test", Closed, Normal, assigned to Yash. */
export const ticketData = {
  number: 'TT1',
  title: 'Test',
  priority: 'Normal',
  otherPriority: 'Urgent',
  noMatch: 'qa_no_such_ticket_zz',
};

/** Beta quotation (read only): QT-301006 "QA-TEST-R12 Quote A", Draft, ₹240, with sales order SO-300004. */
export const quotationData = {
  number: 'QT-301006',
  title: 'QA-TEST-R12 Quote A',
  titleSearch: 'qa-test-r12',
  noMatch: 'qa_no_such_quote_zz',
};

/** Beta sales order (read only): SO-300004 "QA-TEST-R12 Quote A", Draft, ₹240, made from quotation QT-301006. */
export const salesOrderData = {
  number: 'SO-300004',
  title: 'QA-TEST-R12 Quote A',
  titleSearch: 'qa-test-r12',
  quotation: 'QT-301006',
  noMatch: 'qa_no_such_order_zz',
};

/** Invoices (More > SALES > Invoices), read only. INV-300005: paid in two payments, one discounted line, a
 *  deducted tax, made from SO-077380. INV-004221: partially paid, due 8 Jul 2026. */
export const invoiceData = {
  paid: 'INV-300005',
  salesOrder: 'SO-077380',
  partial: 'INV-004221',
  titleSearch: 'invoice 4221',
  noMatch: 'qa_no_such_invoice_zz',
};

/** New invoice (MINV-020 saves it with INVOICE_CREATE=1; MINV-021 only fills the form). A service, not a product:
 *  services carry no stock (Save refuses out-of-stock products, and a stocked one would change inventory).
 *  Expected: line 1 2 x 140 = 280 - 10% = 252 + Sales 10% 25.20; line 2 140 - 6 = 134 - TDS 2% 2.68;
 *  Subtotal 386, Total 408.52. */
export const newInvoiceData = {
  subjectPrefix: 'QA-TEST-INV',
  unitPrice: 140,
  lines: [
    { kind: 'service', product: 'test service', quantity: 2, discountPercent: 10, tax: 'Sales 10%' },
    { kind: 'service', product: 'test service', quantity: 1, discountAmount: 6, tax: 'TDS 2%' },
  ],
  subtotal: 386,
  total: 408.52,
  /** Saved by MINV-020 on 2026-11-16 (run 20261116-123643), kept as a Draft; MINV-022 reads it. */
  saved: 'INV-300013',
  savedSubject: 'QA-TEST-INV 20261116-070707',
} as const;

/** Delivery notes (More > SALES > Delivery Notes), read only; 7 on beta (2026-11-16). DN-0005 has every field;
 *  DN-0006 has no subject. The form test adds the service of the invoice tests and discards it. */
export const deliveryData = {
  full: 'DN-0005',
  fullSubject: 'QA-A Delivery Note 1789 allfields INLINE-EDIT',
  subjectSearch: 'qa-a delivery note',
  dispatched: 'Dispatched 15 Sep 2026',
  item: { name: 'QA-A Premium Widget', price: '₹45', quantity: 2, serial: 'Serial #WIDGET-9999' },
  tracking: 'TRK-987654321',
  address: '123 Fulfillment Boulevard, Dock 4',
  notes: 'Fragile shipment. Handle with care. Ünïcødé 📦',
  noSubject: 'DN-0006',
  noMatch: 'qa_no_such_dn_zz',
  service: 'test service',
  serviceQuantity: 3,
  serviceLine: 'test service, 3 x ₹140, ₹420',
  serviceTotal: '₹420',
};

/** Expenses (More > SALES > Expenses). Beta held none on 2026-11-16; MEXP-020 saves one QA expense
 *  (EXPENSE_CREATE=1, approved, kept). Form check: 1000 with Sales 10% = 1100; with the amount including the
 *  tax, 909.09 + 90.91 = 1000; TDS 2% is deducted elsewhere in the app, so 1000 - 20 = 980. */
export const expenseData = {
  descriptionPrefix: 'QA-TEST-EXP',
  reference: 'QA-EXP-001',
  vendorName: 'QA Test Vendor',
  category: 'Other',
  amount: 1000,
  tax: 'Sales 10%',
  total: 1100,
  includedAmount: 909.09,
  includedTax: 90.91,
  tdsTotal: 980,
  noMatch: 'qa_no_such_expense_zz',
  /** Saved by MEXP-020 on 2026-11-16 (run 20261116-171738), kept as Draft; the detail tests read it. */
  saved: 'EXP-0008',
  savedDescription: 'QA-TEST-EXP 20261116-114756',
  savedDate: '16 Nov 2026',
  savedTax: '₹100, Sales 10%',
};

/** Products (More > INVENTORY > Products), read only; 3,332 on beta (2026-11-17). QA reference: QA-TEST Gadget R3. */
export const productData = {
  name: 'QA-TEST Gadget R3',
  sku: 'QA-TEST-SKU-R3',
  number: 'PRD-6040',
  price: '₹100.12',
  costPrice: '₹200',
  taxRate: '18%',
  onHand: 5,
  reorderLevel: 5,
  vendor: 'QA-TEST-R9 Supplier',
  warehouses: { 'Central Warehouse 10': 5, 'QA-TEST-R9 Warehouse': 0 } as Record<string, number>,
  category: 'BEVERAGES',
  barcodeTyped: 'ab12cd34',
  barcodeKept: '1234',
  noMatch: 'qa_no_such_product_zz',
};

/** Services (More > INVENTORY > Services), read only; beta holds one, "test service" SER-0001 (2026-11-17). It is
 *  the service on the QA invoice INV-300013 (MINV-020: two lines, Qty 2 and Qty 1). */
export const serviceData = {
  name: 'test service',
  number: 'SER-0001',
  price: '₹140',
  usageUnit: 'Days',
  units: '1',
  taxRate: '10%',
  commissionRate: '5%',
  category: 'Uncategorized',
  owner: 'Yash',
  salesStart: '12 Oct 2026',
  salesEnd: '31 Oct 2026',
  supportStart: '12 Oct 2026',
  supportExpiry: '12 Oct 2027',
  description: 'description of service',
  invoice: 'INV-300013',
  invoiceQuantities: ['Qty 1', 'Qty 2'],
  createdActivity: 'Service "test service" created',
  otherCategory: 'BEVERAGES',
  formName: 'QA-TEST-SRV draft',
  formUnit: 'Days',
  noMatch: 'qa_no_such_service_zz',
};

/** Categories (More > INVENTORY > Categories), read only; 24 on beta (2026-11-17). BEVERAGES: Active, no parent,
 *  sort order 5, no sub-categories, the category of the Products filter tests. */
export const categoryData = {
  name: 'BEVERAGES',
  sortOrder: '5',
  search: 'bread',
  searchMatches: ['BREAD AND BAKERY', 'BREAD AND BAKERY, FROZEN'],
  always: ['BEVERAGES', 'Uncategorized'],
  formName: 'QA-TEST-CAT draft',
  noMatch: 'qa_no_such_category_zz',
  /** Rows read for the sort-order check (MCAT-012). */
  sortRows: 6,
};

/** Price books (More > INVENTORY > Price Books), read only; 5 on beta (2026-11-17), all Active, none used by a
 *  customer. Reference: "SalesHiker Pricebook 1", USD, one price. */
export const priceBookData = {
  name: 'SalesHiker Pricebook 1',
  currency: 'USD',
  currencyOption: 'USD, US Dollar',
  vendor: 'SalesHiker Vendor',
  notes: 'SalesHiker Pricebook 1',
  priceProduct: 'KRI KRI',                                  // start of the product name (it holds curly quotes)
  unitPrice: '188.16',
  cost: '20',
  priceRow: /^KRI KRI, .+, \$188[.]16, Cost \$20$/,
  search: 'PRICEBOOK',
  searchMatches: ['SalesHiker Pricebook 2', 'SalesHiker Pricebook 1'],
  defaultCurrency: 'Currency: INR, Indian Rupee',
  pickerProduct: 'QA-TEST-SKU-R3',
  pickerOption: 'QA-TEST Gadget R3, QA-TEST-SKU-R3, ₹100.12',
  pickerVendor: 'QA-TEST-R9 Supplier',
  formName: 'QA-TEST-PB draft',
  noMatch: 'qa_no_such_book_zz',
};

/** Purchase orders (More > INVENTORY > Purchase Orders), read only; the new-order form is filled and discarded.
 *  PO-0005: QA-TEST-R9 Supplier / Warehouse, 10 x ₹100.12, received 4 of 10, Partially Received, ₹2,242.69.
 *  Form lines (never saved): 3 x 100.12 + Sales 10% = 330.40; 2 x 100.12 - TDS 2% (a deducted tax) = 196.24. */
export const purchaseOrderData = {
  number: 'PO-0005',
  supplier: 'QA-TEST-R9 Supplier',
  supplierSearch: 'qa-test-r9',
  warehouse: 'QA-TEST-R9 Warehouse',
  orderDate: '12 Oct 2026',                                 // web Order Date 10/12/2026 (the phone shows 11 Oct: MPUR-D04)
  product: 'QA-TEST Gadget R3',
  productSearch: 'QA-TEST-SKU-R3',
  unitCost: '100.12',
  ordered: 10,
  received: 4,
  taxes: ['No tax', 'VAT 4.5%', 'Sales 10%', 'Service 12.5%', 'TDS 2%'],
  addedLine: { qty: '3', tax: 'Sales 10%', total: '₹330.40' },
  deductedLine: { qty: '2', tax: 'TDS 2%', total: '₹196.24' },
  linesTotal: '₹526.64',
  noMatch: 'qa_no_such_po_zz',
};

/** Web reference totals (beta web app, Overview tab / unsaved New forms, read 2026-11-18). The phone must show the same.
 *  added = the "(+)" tax rows, deducted = "(-) Deducted taxes". */
export const webTotals = {
  /** QT-301006 and SO-300004: 2 x ₹96 dumplings, group taxes VAT 4.5% + Sales 10% + Service 12.5%, TDS 2% deducted. */
  quotation: { number: 'QT-301006', subtotal: 192, added: 51.84, deducted: 3.84, total: 240 },
  salesOrder: { number: 'SO-300004', subtotal: 192, added: 51.84, deducted: 3.84, total: 240 },
  invoices: [
    { number: 'INV-300005', subtotal: 1098.90, added: 0, deducted: 21.98, total: 1076.92, paid: 1076.92, balance: 0 },
    { number: 'INV-004221', total: 98500.13, paid: 40381, balance: 58119.13 },
    { number: 'INV-300013', subtotal: 386, added: 27.88, deducted: 0, total: 413.88, paid: 0, balance: 413.88 },
  ],
  /** The two lines of newInvoiceData on the web New invoice and New sales order forms (Individual tax mode):
   *  lines 277.20 and 136.68, Items 386, (+) Tax 27.88, (-) Deducted taxes 7.72 (2% of the order), Grand Total 406.16. */
  form: { lines: [277.20, 136.68], itemsTotal: 386, tax: 27.88, deducted: 7.72, total: 406.16 },
} as const;

/** Warehouses (More > INVENTORY > Warehouses), read only; the new-warehouse form is filled and discarded (2026-11-18:
 *  1,004 warehouses, all Active). */
export const warehouseData = {
  full: { name: 'East Warehouse 641', code: 'WH-0641', street: '641 Logistics Park', city: 'Kolkata', state: 'WB', country: 'India',
    location: 'Kolkata, WB, India', address: '641 Logistics Park, Kolkata, WB, India', owner: 'Assigned to: No owner' },
  /** Holds stock: 4 products, 2 with stock, 6 units, no low stock; its movements add up to each stock figure. */
  stocked: 'Central Warehouse 10',
  /** Used by PO-0005: QA-TEST Gadget R3 received (+4, GRN-0005) and reversed (-4), stock 0; Delete blocked. */
  qa: { name: 'QA-TEST-R9 Warehouse', owner: /^Yash( |$)/, product: 'QA-TEST Gadget R3', productSearch: 'QA-TEST-SKU-R3', grn: 'GRN-0005', qty: 4 },
  deleteBlocked: 'This warehouse is used by 1 purchase order. Move or close them first.',
  search: { name: 'qa-test-r', nameMatches: ['QA-TEST-R12 Warehouse', 'QA-TEST-R9 Warehouse'], code: 'wh-0641', city: 'KOLKATA' },
  formName: 'QA-TEST-WH draft',
  noMatch: 'qa_no_such_warehouse_zz',
};

/** Stock receipts (More > INVENTORY > Stock Receipts), read only; the new-receipt form is filled and discarded
 *  (2026-11-20: 5 receipts, all Applied; reversed receipts are not listed, on the phone or the web). */
export const stockReceiptData = {
  /** Received against PO-0004 (matches the web). */
  po: { number: 'GRN-0004', amount: '₹500.60', received: 'Received 9 Oct 2026', listDate: '9 Oct', warehouse: 'Central Warehouse 10',
    purchaseOrder: 'PO-0004', created: '9 Oct 2026', notes: 'Received against PO-0004', line: { name: 'QA-TEST Gadget R3', quantity: 5, cost: 100.12, total: 500.60 } },
  search: { number: 'grn-0002', match: 'GRN-0002', supplier: 'greek', warehouse: 'East Warehouse 1' },
  suppliers: ['QA-TEST-R9 Supplier', 'SalesHiker Vendor'],
  warehouse: 'Central Warehouse 10, WH-0010',
  product: 'QA-TEST Gadget R3', productSearch: 'QA-TEST-SKU-R3', unitCost: '100.12',
  line: { qty: '3', row: 'QA-TEST Gadget R3, 3 x ₹100.12, ₹300.36', total: '₹300.36' },
  deleteBlocked: 'Reverse the stock, then delete it.',
  noMatch: 'qa_no_such_grn_zz',
};

/** Notifications (More > WORKSPACE > Notifications, or the bell on the More screen) and Settings > Notifications,
 *  read only (2026-11-20). The app pushes new chats, assignments and mentions while it is closed. */
export const notificationData = {
  mention: 'QA mentioned you in a note',            // opens the chat where the note was written
  pushIntro: 'New chats, assignments and mentions arrive as push notifications while the app is closed.',
  webNote: 'Sound and desktop reminders are set per browser, under Settings, Notifications on the web app.',
  device: 'realme RMX3997, Android 16',
  appLabel: /saleshiker/i,
};
