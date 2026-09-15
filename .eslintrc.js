const path = require('path');

module.exports = {
    ignorePatterns: [
      'apps/jumentix-website/next-env.d.ts',
      // apps/frontend/template is a vendored, frozen third-party catalog
      // (CoreUI, MIT) kept as reference for generated frontends — like dist,
      // vendored code is not held to this ruleset. apps/frontend/src follows
      // the Jumentix standard (airbnb + semicolons) and IS linted here.
      'apps/frontend/template',
      '**/dist/**'
    ],
    parser: '@typescript-eslint/parser',
    'parserOptions': {
      'project': 'tsconfig.json',
      'ecmaVersion': 2019,
      'sourceType': 'module'
    },
    plugins: [
      '@typescript-eslint', 'jest',
      '@typescript-eslint',
      'no-async-foreach'
    ],
    /*
     * `plugin:jest/all` is deliberately absent here and applied per-path in
     * `overrides` instead (JUM-619).
     *
     * Extended globally, every rule in a *test* plugin also linted production
     * source. `jest/require-hook` — "do not put setup outside beforeEach" —
     * fired on module-level state and on a registration call in
     * `packages/persistence-contracts` and `apps/backend-template/src`, neither
     * of which is a test. The cheapest response to that is to restructure
     * working code to satisfy a rule that was never meant to see it.
     *
     * The `jest` plugin itself stays loaded below, because the rule names in
     * `rules` and in the later overrides have to resolve for every file.
     */
    extends: [
      'airbnb-base',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript',
      'plugin:@typescript-eslint/recommended',
      'eslint:recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended'
    ],
    rules: {
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'no-async-foreach/no-async-foreach': 'error',
      'no-return-await' : 'error',
      'prefer-promise-reject-errors': 'error',
      'no-console': 'error',
      
      'import/extensions': 'off',
      'no-restricted-syntax': 'off',
      
      'import/no-unresolved': 'off',
      'import/no-dynamic-require': 'off',
      'global-require': 'off',

      'no-underscore-dangle': 'off',
      'import/prefer-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-cycle' : 'off',
      'arrow-body-style' : 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        caughtErrors: 'none',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'import/no-extraneous-dependencies': ['error', {
        packageDir: [
          __dirname,
          path.join(__dirname, 'apps/backend-template'),
          path.join(__dirname, 'apps/frontend'),
          path.join(__dirname, 'apps/jumentix-website'),
          path.join(__dirname, 'packages/sdk-rest-client'),
          path.join(__dirname, 'packages/sdk-websocket-client'),
          path.join(__dirname, 'packages/sdk-grpc-client'),
          path.join(__dirname, 'packages/message-mediator')
        ]
      }]
    },
    overrides: [
      {
        /*
         * Where the Jest rules apply: test files, and only test files.
         *
         * First in this list so the narrower entries below — which switch
         * individual jest rules off for the docker-gated suites and the
         * Mocha/Chai browser suites — still win.
         */
        files: [
          '**/test/**/*.ts',
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/cypress/**/*.ts'
        ],
        extends: ['plugin:jest/all'],
        /*
         * These two were switched off in the top-level `rules` block while
         * `plugin:jest/all` was extended globally. An `extends` inside an
         * override is applied after the top-level rules, so moving the ruleset
         * here re-enabled them and produced 262 errors across the existing
         * suites — 195 of them `jest/no-hooks` objecting to `beforeAll` and
         * `afterAll` that were always deliberate.
         *
         * They belong here now, beside the ruleset they modify, rather than at
         * the top where they read as repository-wide policy.
         */
        rules: {
          'jest/no-hooks': 'off',
          'jest/no-untyped-mock-factory': 'off',
          'jest/unbound-method': 'off'
        }
      },
      {
        /*
         * Integration suites gated on a docker service.
         *
         * Each of these wraps its blocks in `RUNNING ? describe : describe.skip`
         * so an absent container skips the suite instead of passing it. Three
         * rules cannot read through that alias: they see no `describe`, so a
         * `beforeAll` looks like loose code and every test looks unwrapped.
         *
         * The alternative was gating each `it` instead, and that is worse —
         * eslint-plugin-jest then stops recognising the tests at all and reports
         * a hundred violations across the same two files, including every
         * assertion as "expect must be inside of a test block". Three named
         * rules on two files is the smaller, more honest exception.
         */
        files: ['packages/*/test/integration/**/*.ts'],
        rules: {
          'jest/consistent-test-it': 'off',
          'jest/no-duplicate-hooks': 'off',
          'jest/no-identical-title': 'off',
          'jest/require-hook': 'off',
          'jest/require-top-level-describe': 'off'
        }
      },
      {
        /*
         * The frontend suites are bun:test, not Jest (JUM-760): fixture state
         * lives in describe-scoped bindings shared between `beforeEach` and the
         * tests, which is exactly what `jest/require-hook` forbids for Jest.
         * Same exception shape as the package integration suites above.
         */
        files: ['apps/frontend/test/**/*.ts'],
        rules: {
          'jest/require-hook': 'off'
        }
      },
      {
        /*
         * The browser suites are Mocha and Chai, not Jest (Requirement 112 §4).
         *
         * `eslint-plugin-jest` reads every `it()` it can see, so without this it
         * demands `expect.hasAssertions()` — which does not exist here — and
         * reports every Chai chain as "an unknown modifier". Both complaints are
         * about a framework these files do not use.
         *
         * The `no-undef` exemptions are the browser globals and the Mocha ones:
         * these files run in a browser, which the Node parser configuration does
         * not assume.
         */
        // apps/frontend/cypress: the frontend e2e suite (JUM-776) runs in the same
        // Mocha/Chai browser runtime as the package suites.
        files: ['cypress/**/*.js', 'packages/*/cypress/**/*.ts', 'apps/frontend/cypress/**/*.ts'],
        env: { browser: true, mocha: true },
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
          'import/no-extraneous-dependencies': 'off'
        }
      },
      {
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
          'import/no-extraneous-dependencies': 'off',
          'import/no-relative-packages': 'off'
        }
      }
    ]
  };
