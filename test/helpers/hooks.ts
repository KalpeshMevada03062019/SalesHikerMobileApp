// Small Mocha helpers shared by specs.
import { hasCredentials } from '../../src/config/settings.js';

/** Call inside describe(): skips the suite (reported as SKIPPED) when no test account is configured. */
export function requiresAccount(): void {
  before(function () {
    if (!hasCredentials()) this.skip();
  });
}
