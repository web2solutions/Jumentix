import { RestAPI } from '@src/interface/HTTP/RestAPI';

/**
 * JUM-698 — the Express fallback has to recognise a missing module on every
 * runtime that runs these suites.
 *
 * It used to test `error.code === 'MODULE_NOT_FOUND'` alone. Bun and Node set
 * that code; Jest's resolver does not — it throws its own error with an
 * undefined `code` and the message `Cannot find module ... from ...`. The
 * Adonis-JS and Total-JS suites therefore passed under `bun test` and failed
 * under Jest, on adapters that have no per-framework handler of their own.
 *
 * These run against the failing input rather than the fixed one (Requirement
 * 135 §3): the Jest-shaped error is the case that used to be rethrown.
 */
const isModuleNotFound = (
  RestAPI as unknown as { isModuleNotFound: (error: unknown) => boolean }
).isModuleNotFound.bind(RestAPI);

describe('restAPI handler resolution across runtimes (JUM-698)', () => {
  it('recognises the Node and Bun shape', () => {
    expect.hasAssertions();

    const error = Object.assign(new Error('Cannot find module x'), { code: 'MODULE_NOT_FOUND' });

    expect(isModuleNotFound(error)).toBe(true);
  });

  it('recognises the Jest resolver shape, which carries no code', () => {
    expect.hasAssertions();

    // The message Jest produced, minus its quoting — the lint rule owns the
    // quotes here, and the substring the check matches on is unchanged.
    const error = new Error(
      'Cannot find module @src/modules/Users/interface/restapi/frameworks/total-js/handlers/x'
      + ' from apps/backend-template/src/interface/HTTP/RestAPI.ts'
    );

    expect((error as { code?: string }).code).toBeUndefined();
    expect(isModuleNotFound(error)).toBe(true);
  });

  it('still rethrows a real failure inside a handler module', () => {
    expect.hasAssertions();

    // The direction that matters: a module that exists and throws while loading
    // must not be silently treated as absent and papered over with Express.
    expect(isModuleNotFound(new TypeError('undefined is not a function'))).toBe(false);
    expect(isModuleNotFound(new Error('connection refused'))).toBe(false);
  });
});
