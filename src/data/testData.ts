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
