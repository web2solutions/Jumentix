/**
 * Jest transformer for first-party JavaScript.
 *
 * Two kinds of `.js` live in this repository and Jest could previously read
 * neither correctly.
 *
 * `packages/security-scanner` is plain ESM — it runs inside `bun install`,
 * before anything here has been built, so it cannot be TypeScript. Untransformed,
 * Jest reads `export const` as a syntax error, and the only ways around that were
 * to leave the package untested or to exclude it from coverage: the exemption
 * Requirement 112 exists to end.
 *
 * The `ci-cd/*.js` scripts are CommonJS and start with `#!/usr/bin/env bun`.
 * Node strips a shebang itself when it loads a file, which is why they worked
 * while they were untransformed; a transpiler does not, and the line survives
 * into the module wrapper where it is a syntax error. Five suites failed that
 * way the moment JavaScript started being transformed at all.
 *
 * So the shebang is removed before handing off to ts-jest — replaced by nothing
 * on the same line, so every line number below it, and every coverage report
 * built from them, still points where it did.
 */

// ts-jest publishes `createTransformer` on its default export.
const { createTransformer } = require('ts-jest').default;

const delegate = createTransformer({
  tsconfig: { allowJs: true, module: 'CommonJS' }
});

const SHEBANG = /^#![^\n]*/;

const stripShebang = (source) => (source.startsWith('#!') ? source.replace(SHEBANG, '') : source);

/**
 * The output is stripped as well as the input.
 *
 * ts-jest hands a JavaScript file back untouched when it decides there is
 * nothing to compile, so stripping only the input leaves the shebang in the
 * result for exactly the files that need it gone — which is what made the first
 * attempt at this look like it had no effect at all.
 */
const stripped = (result) => (typeof result === 'string'
  ? stripShebang(result)
  : { ...result, code: stripShebang(result.code) });

module.exports = {
  process(source, path, options) {
    return stripped(delegate.process(stripShebang(source), path, options));
  },
  async processAsync(source, path, options) {
    return stripped(await delegate.processAsync(stripShebang(source), path, options));
  },
  // Delegated so a change to the transform still invalidates the cache; the
  // stripped shebang is part of the source the key is computed from.
  getCacheKey(source, path, options) {
    return delegate.getCacheKey(stripShebang(source), path, options);
  }
};
