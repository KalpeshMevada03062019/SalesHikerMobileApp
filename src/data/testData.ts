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
