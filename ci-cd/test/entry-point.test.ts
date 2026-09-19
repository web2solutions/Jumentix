/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * The entry-point check every `ci-cd` guard uses to decide whether to run.
 *
 * It replaced `require.main === module`, written inline in 33 files. That
 * expression is correct but leaves the nullability implicit — `require.main` is
 * `undefined` when the process was not started from a module at all — which is
 * why SonarQube reported it as `javascript:S3403`, a strict comparison between
 * dissimilar types.
 *
 * Getting it wrong fails silently in both directions: a guard that never matches
 * does nothing when invoked, and one that always matches runs its side effects
 * when a test imports it. Neither shows up as an error.
 */
const { isEntryPoint } = require('../lib/entry-point') as {
  isEntryPoint: (caller: unknown, entry?: unknown) => boolean;
};

describe('isEntryPoint', () => {
  it('is true for the module the process was started with', () => {
    expect.hasAssertions();
    // The entry is injected because the two runners disagree about what
    // `require.main` is inside a test file: under `bun test --isolate` each file
    // is its own entry, under Jest it is `undefined`. Reading the ambient value
    // would make this assert opposite things in the two runners.
    const entry = { id: 'ci-cd/check-something.js', exports: {} };

    expect(isEntryPoint(entry, entry)).toBe(true);
  });

  it('is false for any other module', () => {
    expect.hasAssertions();
    // A distinct module object, not this file's `module`: under
    // `bun test --isolate` each test file *is* an entry point, so comparing
    // against `module` here would assert the opposite of what it reads as.
    //
    // This is the case that matters in practice — a guard imported by a suite
    // must not run its `main()` — and it is the direction that fails silently,
    // by executing side effects during a test run.
    const entry = { id: 'ci-cd/entry.js', exports: {} };
    const imported = { id: 'ci-cd/check-something.js', exports: {} };

    expect(isEntryPoint(imported, entry)).toBe(false);
  });

  it('is false rather than throwing when there is no caller', () => {
    expect.hasAssertions();
    // `require.main` is undefined when the process was not started from a
    // module — `bun -e`, a REPL, an embedded host. A guard must stay quiet
    // there rather than throwing.
    expect(isEntryPoint(undefined, undefined)).toBe(false);
    expect(isEntryPoint(null, null)).toBe(false);
  });
});
