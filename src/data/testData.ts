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
