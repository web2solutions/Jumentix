import { describe, expect, it } from 'bun:test';

import { loadCanonicalSpec } from '@/contracts/sharedContractsBrowserShim';

/**
 * Browser shim for @jumentix/shared-contracts (requirement 136): the frontend
 * consumes the bundled OAS as data, so the disk loader must fail loudly.
 */
describe('sharedContractsBrowserShim (requirement 136)', () => {
  it('fails loudly instead of reading the spec from disk', () => {
    expect.hasAssertions();
    expect(() => loadCanonicalSpec('spec/1.0.0.yml')).toThrow(/unavailable in the browser/);
  });
});
