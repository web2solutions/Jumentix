import { describe, expect, it } from 'bun:test';

import {
  DEFAULT_APP_OPERATIONS,
  appOperations,
  configureAppOperations,
  resolveAppOperations,
  validateAppOperations
} from '@/contracts/appOperations';

/**
 * JUM-780 — the shell's operationIds live in one overridable map validated
 * against the bundled OAS at boot: a generated app with renamed operations
 * fails loudly instead of rendering a blank, permission-less UI.
 */
describe('appOperations', () => {
  it('defaults are all declared by the bundled OAS', () => {
    expect.hasAssertions();
    expect(validateAppOperations(DEFAULT_APP_OPERATIONS)).toStrictEqual([]);
    expect(configureAppOperations()).toStrictEqual(DEFAULT_APP_OPERATIONS);
    expect(appOperations().auth.login).toBe('login');
  });

  it('merges overrides and names every id the contract lacks', () => {
    expect.hasAssertions();
    const merged = resolveAppOperations({ profile: { get: 'getMe' } });
    expect(merged.profile.get).toBe('getMe');
    expect(merged.profile.update).toBe('update');
    expect(validateAppOperations(merged)).toStrictEqual(['profile.get → "getMe"']);
    expect(() => configureAppOperations({ auth: { login: 'signIn' } })).toThrow(
      'appOperations: the bundled OAS declares no operation for auth.login → "signIn".'
    );
    // a failed configure leaves the previous map active
    expect(appOperations().auth.login).toBe('login');
  });
});
