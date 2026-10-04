import jest from 'eslint-plugin-jest';
import globals from 'globals';

import type { FlatConfig, TestProfileOptions } from '../types.js';

const JEST_FILES = [
  '**/test/**/*.ts',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.test.mjs',
  '**/cypress/**/*.ts'
];

/**
 * Test profile — Jest rules scoped to test files only (the JUM-619 lesson:
 * extending `plugin:jest/all` globally linted production source with test
 * rules). Reproduces every per-path override of the legacy `.eslintrc.js`:
 *
 * 1. `jest/no-hooks`, `jest/no-untyped-mock-factory`, `jest/unbound-method`
 *    off — `beforeAll`/`afterAll` are deliberate in this monorepo.
 *    `jest/unbound-method` is one of the six JUM-44 rules: strict turns it on.
 * 2. Docker-gated integration suites wrap blocks in
 *    `RUNNING ? describe : describe.skip`, which three rules cannot read
 *    through — the named offs stay scoped to those two globs.
 * 3. `apps/frontend/test` is bun:test, not Jest (JUM-760): fixture state is
 *    describe-scoped, which `jest/require-hook` forbids for Jest.
 * 4. Cypress/Mocha browser suites are not Jest (Req 112 §4): jest rules off,
 *    browser + mocha globals, `no-undef` off.
 */
export function test(options: TestProfileOptions = {}): FlatConfig[] {
  const jestAll = jest.configs['flat/all'] as FlatConfig & {
    plugins: Record<string, unknown>;
  };

  const integrationFiles = options.integrationFiles ?? ['packages/*/test/integration/**/*.ts'];
  const frontendTestFiles = options.frontendTestFiles ?? [
    'apps/frontend/test/**/*.ts',
    'packages/config-eslint/test/**/*.ts',
    // bun:test suites authored as .mjs (website scripts).
    '**/*.test.mjs'
  ];
  const cypressFiles = options.cypressFiles ?? [
    'cypress/**/*.js',
    'packages/*/cypress/**/*.ts',
    'apps/frontend/cypress/**/*.ts',
    'apps/jumentix-website/cypress/**/*.ts',
    'apps/jumentix-website/cypress/**/*.js',
    // The cli-init frontend template mirrors the seed's cypress suite.
    'packages/cli-init/templates/frontend/cypress/**/*.ts',
    'packages/cli-init/templates/frontend/cypress/**/*.js'
  ];
  const restifyAllowList = options.restifyAllowList ?? true;

  const jestBlock: FlatConfig = {
    name: 'jumentix/test-jest',
    files: JEST_FILES,
    plugins: jestAll.plugins,
    languageOptions: jestAll.languageOptions,
    rules: {
      ...jestAll.rules,
      'jest/no-hooks': 'off',
      'jest/no-untyped-mock-factory': 'off',
      // JUM-44 — on in the strict variant below.
      'jest/unbound-method': 'off',
      // eslint-plugin-jest 29 added the padding family to `all`; the legacy
      // config (jest 27) never had them. They are pure vertical whitespace —
      // formatting, owned by Prettier (JUM-13), not by ESLint.
      'jest/padding-around-after-all-blocks': 'off',
      'jest/padding-around-after-each-blocks': 'off',
      'jest/padding-around-all': 'off',
      'jest/padding-around-before-all-blocks': 'off',
      'jest/padding-around-before-each-blocks': 'off',
      'jest/padding-around-describe-blocks': 'off',
      'jest/padding-around-expect-groups': 'off',
      'jest/padding-around-test-blocks': 'off',
      // jest 29 additions the legacy pin never enforced, reviewed and
      // rejected for this monorepo (JUM-18):
      // - prefer-importing-jest-globals assumes one runner; apps/frontend
      //   suites are bun:test (JUM-760) and cannot import @jest/globals.
      // - prefer-ending-with-an-expect forbids legitimate trailing cleanup
      //   and verification calls the existing suites rely on.
      'jest/prefer-importing-jest-globals': 'off',
      'jest/prefer-ending-with-an-expect': 'off',
      // jest.mock('@src/...' | '@jumentix/...') paths resolve through jest's
      // moduleNameMapper at runtime; this rule only knows node resolution and
      // reports the monorepo's aliases as missing (false positives).
      'jest/valid-mock-module-path': 'off'
    }
  };

  const integrationBlock: FlatConfig = {
    name: 'jumentix/test-integration-docker-gated',
    files: integrationFiles,
    rules: {
      'jest/consistent-test-it': 'off',
      'jest/no-duplicate-hooks': 'off',
      'jest/no-identical-title': 'off',
      'jest/require-hook': 'off',
      'jest/require-top-level-describe': 'off'
    }
  };

  const frontendBunTestBlock: FlatConfig = {
    name: 'jumentix/test-bun',
    // bun:test suites (apps/frontend per JUM-760, packages/config-eslint per
    // JUM-14) share fixture state through describe-scoped and module-scoped
    // bindings — exactly what jest/require-hook forbids for Jest. Same
    // exception shape as the docker-gated integration suites.
    files: frontendTestFiles,
    rules: {
      'jest/require-hook': 'off'
    }
  };

  const cypressMochaBlock: FlatConfig = {
    name: 'jumentix/test-cypress-mocha',
    files: cypressFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.mocha,
        cy: 'readonly',
        Cypress: 'readonly'
      }
    },
    rules: {
      'jest/expect-expect': 'off',
      'jest/no-conditional-expect': 'off',
      'jest/no-conditional-in-test': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/prefer-expect-assertions': 'off',
      'jest/prefer-lowercase-title': 'off',
      'jest/prefer-to-have-length': 'off',
      'jest/require-hook': 'off',
      'jest/require-to-throw-message': 'off',
      'jest/require-top-level-describe': 'off',
      'jest/valid-expect': 'off',
      'no-undef': 'off',
      'import-x/no-extraneous-dependencies': 'off'
    }
  };

  // Restify adapters and their suites resolve restify through the app's own
  // dependency tree; the monorepo-level check cannot see it (legacy allow-list).
  const restifyAllowListBlock: FlatConfig = {
    name: 'jumentix/test-restify-allow-list',
    files: [
      'apps/backend-template/test/unit/sdk-clients/grpc/GrpcApiClient.test.ts',
      'src/interface/HTTP/adapters/restify/**/*.ts',
      'src/interface/HTTP/ports/IHTTPRequest.ts',
      'src/interface/HTTP/ports/IHTTPResponse.ts',
      'src/modules/Users/interface/restapi/frameworks/restify/**/*.ts',
      'test/integration/Restify/**/*.ts',
      'test/integration/mutex/redis.restify.test.ts'
    ],
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
      'import-x/no-relative-packages': 'off'
    }
  };

  const strictBlock: FlatConfig = {
    name: 'jumentix/test-strict',
    files: JEST_FILES,
    rules: {
      // JUM-44.
      'jest/unbound-method': 'error'
    }
  };

  // Type-aware jest rules cannot run where no tsconfig covers the file (the
  // same trees the typescript profile's untyped fallback handles).
  const untyped = options.untypedFiles ?? [];
  const untypedBlock: FlatConfig = {
    name: 'jumentix/test-untyped-fallback',
    files: untyped.flatMap((glob) =>
      glob.endsWith('/**')
        ? [`${glob.slice(0, -2)}**/*.ts`, `${glob.slice(0, -2)}**/*.tsx`]
        : [glob]
    ),
    rules: {
      'jest/no-error-equal': 'off',
      'jest/no-unnecessary-assertion': 'off',
      'jest/unbound-method': 'off',
      'jest/valid-expect-with-promise': 'off'
    }
  };

  return [
    jestBlock,
    integrationBlock,
    frontendBunTestBlock,
    cypressMochaBlock,
    ...(restifyAllowList ? [restifyAllowListBlock] : []),
    ...(options.strict ? [strictBlock] : []),
    ...(untyped.length > 0 ? [untypedBlock] : [])
  ];
}

export function testStrict(options: TestProfileOptions = {}): FlatConfig[] {
  return test({ ...options, strict: true });
}
