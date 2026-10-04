import { configs as airbnb, plugins as airbnbPlugins } from 'eslint-config-airbnb-extended';

import type { FlatConfig, NodeProfileOptions } from '../types.js';

/**
 * Node.js runtime profile (JUM-10) — `eslint-plugin-n` rules via Airbnb
 * Extended's node config: missing imports, correct ESM/CJS globals, no
 * deprecated Node APIs. `no-async-foreach` is preserved by the base parity
 * layer. ESM (`.mjs`/`import`) and CJS (`.cjs`/`require`) are scoped per
 * module system by the airbnb node configuration blocks; the explicit CJS
 * block below keeps `require` scripts clean of ESM-only rule noise.
 */
const NODE_FILES = [
  '**/*.js',
  '**/*.cjs',
  '**/*.mjs',
  '**/*.jsx',
  '**/*.ts',
  '**/*.cts',
  '**/*.mts',
  '**/*.tsx',
  '**/*.d.ts'
];

export function node(options: NodeProfileOptions = {}): FlatConfig[] {
  const cjs: FlatConfig = {
    name: 'jumentix/node-cjs',
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs'
    },
    rules: {
      // CJS scripts legitimately require() at top level.
      'n/no-unpublished-require': 'off',
      'import-x/no-commonjs': 'off'
    }
  };

  const jumentixNode: FlatConfig = {
    name: 'jumentix/node',
    // Scoped like the airbnb node plugin block: without `files` this block
    // would also hit .vue SFCs, where the n plugin is never registered.
    files: NODE_FILES,
    settings: {
      node: {
        // Canonical runtime floor — root package.json engines. Without this,
        // eslint-plugin-n falls back to each file's nearest (often stale)
        // engines field and flags Node 22 APIs as experimental.
        version: '>=22.0.0 <23.0.0'
      }
    },
    rules: {
      // eslint-plugin-n 18 made n/no-sync type-aware: with the airbnb wiring
      // (typescript-eslint parser for every file, projectService only for
      // TypeScript) it hard-crashes on plain JavaScript. CI scripts and the
      // CLI bootstrap also use synchronous fs deliberately — they are not
      // request-serving code — so the rule is off for this monorepo.
      'n/no-sync': 'off',
      // Legacy parity: the core global-require was off in .eslintrc.js; CJS
      // tooling in this monorepo requires conditionally on purpose.
      'n/global-require': 'off',
      // Bun-first APIs and Node backports the rule's feature database does
      // not model (readline/promises backported to 22.x; import.meta.* is a
      // Bun runtime API). Everything else stays enforced.
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          ignores: ['readline/promises', 'import.meta.dirname', 'import.meta.main']
        }
      ]
    }
  };

  const noUnsupportedOff = options.noUnsupportedFeaturesOffFiles ?? [];
  const noUnsupportedOffBlock: FlatConfig = {
    name: 'jumentix/node-no-unsupported-scoped-off',
    // eslint-plugin-n's feature database misfires on these surfaces: Bun
    // runtime APIs (import.meta.main), browser globals in frontend code
    // (navigator, crypto, URL.createObjectURL) and APIs stable in the pinned
    // Node 22 floor. Scoped per consumer; everywhere else the rule stays on.
    files: noUnsupportedOff.flatMap((glob) =>
      glob.endsWith('/**')
        ? [
            `${glob.slice(0, -2)}**/*.ts`,
            `${glob.slice(0, -2)}**/*.js`,
            `${glob.slice(0, -2)}**/*.mts`,
            `${glob.slice(0, -2)}**/*.mjs`,
            `${glob.slice(0, -2)}**/*.cts`,
            `${glob.slice(0, -2)}**/*.cjs`
          ]
        : [glob]
    ),
    rules: {
      'n/no-unsupported-features/node-builtins': 'off'
    }
  };

  const strictExtra: FlatConfig = {
    name: 'jumentix/node-strict',
    files: NODE_FILES,
    rules: {
      'n/no-deprecated-api': 'error'
      // n/no-missing-import and n/no-extraneous-import are deliberately NOT
      // here: eslint-plugin-n cannot resolve this monorepo's tsconfig path
      // aliases (@src/*, @jumentix/*) and reported ~8.6k false positives.
      // Module resolution is import-x's job with the TypeScript resolver
      // (JUM-12); n covers runtime APIs, not alias graphs.
    }
  };

  return [
    airbnbPlugins.node,
    ...airbnb.node.recommended,
    jumentixNode,
    cjs,
    ...(noUnsupportedOff.length > 0 ? [noUnsupportedOffBlock] : []),
    ...(options.strict ? [strictExtra] : [])
  ];
}

export function nodeStrict(options: NodeProfileOptions = {}): FlatConfig[] {
  return node({ ...options, strict: true });
}
