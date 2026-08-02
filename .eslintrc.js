const path = require('path');

module.exports = {
    ignorePatterns: [
      'apps/jumentix-website/next-env.d.ts',
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
    extends: [
      'airbnb-base',
      'plugin:jest/all',
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
      'jest/no-hooks': 'off',
      'no-restricted-syntax': 'off',
      
      'import/no-unresolved': 'off',
      'import/no-dynamic-require': 'off',
      'global-require': 'off',

      'no-underscore-dangle': 'off',
      'import/prefer-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-cycle' : 'off',
      'arrow-body-style' : 'off',
      'jest/unbound-method': 'off',
      'import/no-extraneous-dependencies': ['error', {
        packageDir: [
          __dirname,
          path.join(__dirname, 'apps/backend-template'),
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
        files: ['cypress/**/*.js', 'packages/*/cypress/**/*.ts'],
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
