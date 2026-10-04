import {
  configs as airbnb,
  helpers as airbnbHelpers,
  plugins as airbnbPlugins
} from 'eslint-config-airbnb-extended';
import { createNodeResolver } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

import type { FlatConfig, TypeScriptProfileOptions } from '../types.js';

const DEFAULT_TS_FILES = ['**/*.ts', '**/*.cts', '**/*.mts', '**/*.tsx', '**/*.d.ts'];

/**
 * TypeScript profile — Airbnb Extended TypeScript rules plus Jumentix
 * type-aware wiring.
 *
 * Every covered file lints against its own workspace tsconfig via
 * `parserOptions.projectService` (JUM-9): a backend file against
 * `apps/backend-template/tsconfig.json`, a package file against its own
 * `packages/<P>/tsconfig.json`, and so on.
 *
 * Trees no tsconfig covers (app test roots excluded from their app's
 * tsconfig, `packages/*` test/cypress trees whose package tsconfig only
 * includes `src`, and the `cli-init` template mirrors) are declared by the
 * consumer in `untypedFiles` and get the full non-type-aware TypeScript
 * ruleset instead of a parsing crash — the same effective coverage the
 * legacy config gave them (it never enabled type-checked rule sets).
 *
 * The strict variant layers `recommendedTypeChecked` and the JUM-9 type
 * policies on top: no explicit any (JUM-44), no non-null assertion,
 * ts-comment description policy, optional chaining / nullish coalescing
 * preference. Type-aware rules stay off inside `untypedFiles` via
 * `disableTypeChecked`.
 */
export function typescript(options: TypeScriptProfileOptions = {}): FlatConfig[] {
  const files = options.files ?? DEFAULT_TS_FILES;
  const untyped = options.untypedFiles ?? [];

  const jumentixNonTypedRules: FlatConfig['rules'] = {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        caughtErrors: 'none',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    // JUM-44 / JUM-9 — kept off at profile-active level, on in strict.
    '@typescript-eslint/no-explicit-any': 'off',
    // Deliberate legacy relaxations preserved (type-only patterns the
    // monorepo uses on purpose).
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off',
    // JUM-9: ts-expect-error must carry a description.
    '@typescript-eslint/ban-ts-comment': [
      'error',
      {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': true,
        'ts-nocheck': true,
        'ts-check': false,
        minimumDescriptionLength: 3
      }
    ],
    // The airbnb typescript import-x block re-declares this rule without
    // packageDir — re-assert the Jumentix monorepo options after it.
    ...(options.packageDirs
      ? { 'import-x/no-extraneous-dependencies': ['error', { packageDir: options.packageDirs }] }
      : {}),
    // The same block re-enables extensions for TS; legacy ran with
    // import/extensions off and the TS resolver handles extensionless imports.
    'import-x/extensions': 'off'
  };

  const jumentixTs: FlatConfig = {
    name: 'jumentix/typescript',
    files,
    ignores: untyped,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: options.tsconfigRootDir,
        extraFileExtensions: options.extraFileExtensions ?? []
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: jumentixNonTypedRules
  };

  const jumentixTsStrict: FlatConfig = {
    name: 'jumentix/typescript-strict',
    files,
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      // JUM-44 owner decision (2026-09-24, measured 3,482 violations): kept
      // off — the rule stayed off since the legacy config and the codebase
      // grew on that contract; blanket remediation was reviewed and rejected
      // by the owner. Documented exception, revisited outside this epic.
      '@typescript-eslint/no-explicit-any': 'off',
      // JUM-9 type policies.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      // ignorePrimitives: `'' || fallback`/`0 || fallback` are deliberate
      // falsy-default idioms in this codebase; the rule only fires where the
      // left side is an object/array and ?? is unambiguously safer.
      '@typescript-eslint/prefer-nullish-coalescing': ['error', { ignorePrimitives: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports'
        }
      ]
    }
  };

  const untypedBlock: FlatConfig = {
    name: 'jumentix/typescript-untyped-fallback',
    // Flat-config `files` patterns must end in a file pattern — a trailing
    // `/**` matches directories and applies to nothing. Consumers declare
    // directory-style globs; they are expanded here.
    files: untyped.flatMap((glob) =>
      glob.endsWith('/**')
        ? [
            `${glob.slice(0, -2)}**/*.ts`,
            `${glob.slice(0, -2)}**/*.cts`,
            `${glob.slice(0, -2)}**/*.mts`,
            `${glob.slice(0, -2)}**/*.tsx`,
            `${glob.slice(0, -2)}**/*.d.ts`
          ]
        : [glob]
    ),
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // The airbnb typescript config enables projectService for every TS
        // file; the untyped fallback must switch it back off explicitly.
        projectService: false
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      ...jumentixNonTypedRules,
      // Non-type-aware strict rules still apply where no tsconfig covers
      // the file (JUM-44's no-explicit-any included).
      ...(options.strict
        ? {
            // Same JUM-44 owner decision as the typed strict block.
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/consistent-type-imports': [
              'error',
              {
                prefer: 'type-imports',
                fixStyle: 'separate-type-imports'
              }
            ]
          }
        : {})
    }
  };

  // Resolver settings are deliberately file-agnostic: they must also cover
  // the untyped fallback trees (cli-init templates, test roots) and plain JS
  // files, or their imports go back to nearest-tsconfig auto discovery and
  // the workspace aliases stop resolving (JUM-12).
  const resolverBlock: FlatConfig | null = options.resolverProjects
    ? {
        name: 'jumentix/import-resolver',
        // Scoped to the js/ts family: the import-x plugin is registered for
        // these extensions only (never for .vue SFCs, which the vue profile
        // wires separately).
        files: [
          '**/*.js',
          '**/*.cjs',
          '**/*.mjs',
          '**/*.jsx',
          '**/*.ts',
          '**/*.cts',
          '**/*.mts',
          '**/*.tsx',
          '**/*.d.ts'
        ],
        rules: {
          // `.vue` SFCs resolve through the bundler (Vite), not through any
          // TypeScript-visible module resolution — the resolver cannot see
          // them and reports false positives on `import X from './X.vue'`.
          'import-x/no-unresolved': ['error', { ignore: ['\\.vue$'] }]
        },
        settings: {
          // bun:test/bun are runtime-provided modules, never on disk.
          'import-x/core-modules': ['bun', 'bun:test'],
          'import-x/resolver-next': [
            createNodeResolver({
              extensions: [
                '.js',
                '.cjs',
                '.mjs',
                '.jsx',
                '.ts',
                '.cts',
                '.mts',
                '.tsx',
                '.d.ts',
                '.json'
              ]
            }),
            airbnbHelpers.createAutoTypeScriptImportResolver({
              project: options.resolverProjects
            })
          ]
        }
      }
    : null;

  // typescript-eslint's recommended-type-checked rules block carries no
  // `files` restriction (applies to plain JS too); JS files never have type
  // information here, so type-aware and TS-specific rules stay off for them.
  const jsFilesBlock: FlatConfig = {
    name: 'jumentix/typescript-js-files',
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', '**/*.jsx'],
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off'
    }
  };

  return [
    airbnbPlugins.typescriptEslint,
    ...(options.strict ? tseslint.configs.recommendedTypeChecked : []),
    ...airbnb.base.typescript,
    jumentixTs,
    ...(options.strict ? [jumentixTsStrict] : []),
    ...(untyped.length > 0 ? [untypedBlock] : []),
    jsFilesBlock,
    // Last: the airbnb typescript settings blocks re-declare resolver-next
    // with nearest-tsconfig auto discovery — the Jumentix project set wins.
    ...(resolverBlock ? [resolverBlock] : [])
  ];
}

export function typescriptStrict(options: TypeScriptProfileOptions = {}): FlatConfig[] {
  return typescript({ ...options, strict: true });
}
