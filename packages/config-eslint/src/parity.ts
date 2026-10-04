import noAsyncForeach from 'eslint-plugin-no-async-foreach';

import type { FlatConfig } from './types.js';

/**
 * Jumentix parity layer — the deliberate deviations from the Airbnb Extended
 * defaults that the legacy `.eslintrc.js` carried and that stay active at the
 * non-strict (profile-active) level.
 *
 * The six JUM-44 rules (`no-underscore-dangle`,
 * `import-x/prefer-default-export`, `@typescript-eslint/no-explicit-any`,
 * `import-x/no-cycle`, `arrow-body-style`, `jest/unbound-method`) are kept
 * `off` here and flipped on by the strict variants. The TypeScript-scoped
 * offs live in the typescript profile, where the plugin is registered.
 */
export function jumentixParity(packageDirs: string[]): FlatConfig {
  return {
    name: 'jumentix/parity',
    plugins: {
      'no-async-foreach': noAsyncForeach
    },
    rules: {
      // Guards `array.forEach(async …)` silently swallowing rejections.
      'no-async-foreach/no-async-foreach': 'error',
      'no-console': 'error',
      'prefer-promise-reject-errors': 'error',
      'import-x/no-extraneous-dependencies': ['error', { packageDir: packageDirs }],

      // JUM-44 — legacy-disabled rules, enforced by the strict variant.
      'no-underscore-dangle': 'off',
      'import-x/prefer-default-export': 'off',
      'import-x/no-cycle': 'off',
      'arrow-body-style': 'off',

      // Legacy had no-require-imports off repo-wide; CJS tooling legitimately
      // require()s at every level.
      '@typescript-eslint/no-require-imports': 'off',
      // Legacy import relaxations (JUM-12 owns the final import policy; the
      // strict variant enables resolution + ordering).
      'import-x/extensions': 'off',
      'import-x/no-unresolved': 'off',
      'import-x/no-dynamic-require': 'off',
      'no-restricted-syntax': 'off',
      'global-require': 'off',
      // import-x/no-rename-default ships as warn in airbnb; the legacy import
      // plugin never enabled it and zero-warning gates admit no warnings.
      'import-x/no-rename-default': 'off',
      // airbnb-base (the legacy baseline) always allowed `continue`.
      'no-continue': 'off'
    }
  };
}

/**
 * Strict-only Jumentix rules: the six JUM-44 legacy rules plus the Airbnb
 * strict import set wired by the base strict variant.
 */
export const jumentixStrictParity: FlatConfig = {
  name: 'jumentix/parity-strict',
  rules: {
    // JUM-44 owner decision (2026-09-24, measured 366 violations): kept
    // off — `_id` is domain vocabulary (Mongo-style ids) and `^_` is the
    // deliberate unused-binding convention enforced by no-unused-vars' ^_
    // patterns; the rule cannot distinguish the two idioms.
    'no-underscore-dangle': 'off',
    // JUM-12: import resolution is enforced at strict level — the airbnb
    // settings wire the TypeScript resolver, which resolves the workspace
    // aliases (@src/*, @jumentix/*) the legacy setup never verified.
    'import-x/no-unresolved': 'error',
    'import-x/prefer-default-export': 'error',
    // JUM-12 cycle policy decision: deps:check-cycles already owns the core
    // cycle graph as a passing gate; ESLint's import-x/no-cycle complements
    // it at depth 1 (cheap, per-file) rather than duplicating the full walk.
    'import-x/no-cycle': ['error', { maxDepth: 1 }],
    'arrow-body-style': 'error'
  }
};
