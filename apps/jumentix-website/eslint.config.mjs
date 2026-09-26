import { fileURLToPath } from 'node:url';

import {
  baseStrict,
  reactNextA11yStrict,
  stylistic,
  testStrict,
  typescriptStrict
} from '@jumentix/config-eslint';
import globals from 'globals';

const appDir = fileURLToPath(new URL('.', import.meta.url));

export default [
  {
    name: 'jumentix/website-ignores',
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'out/**',
      'node_modules/**',
      'coverage/**',
      // Generated Pagefind search index bundle.
      'public/_pagefind/**',
      'eslint.config.mjs'
    ]
  },
  ...baseStrict({ packageDirs: [appDir] }),
  ...typescriptStrict({
    tsconfigRootDir: appDir,
    // App aliases (@/*) live in the app tsconfig; @jumentix/* in the root one.
    resolverProjects: [
      fileURLToPath(new URL('tsconfig.json', import.meta.url)),
      fileURLToPath(new URL('../../tsconfig.json', import.meta.url))
    ],
    packageDirs: [appDir],
    // The Next.js tsconfig excludes tests, cypress and storybook by design.
    untypedFiles: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.mjs',
      'cypress/**',
      'test-utils/**',
      '.storybook/**'
    ]
  }),
  ...reactNextA11yStrict(),
  ...testStrict({
    restifyAllowList: false,
    untypedFiles: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.mjs',
      'cypress/**',
      'test-utils/**',
      '.storybook/**'
    ]
  }),
  ...stylistic(),
  {
    // Next.js App Router contracts REQUIRE named exports (HTTP method
    // handlers, useMDXComponents) — prefer-default-export cannot apply.
    // Req 138 §5 scoped relaxation, named surface + framework reason.
    name: 'jumentix/website-next-contracts',
    files: ['app/**/route.ts', 'app/**/route.tsx', 'mdx-components.ts'],
    rules: {
      'import-x/prefer-default-export': 'off'
    }
  },
  {
    // Plain CommonJS scripts/configs inside the app: require/module/process
    // are their runtime globals (the root config already provides them).
    name: 'jumentix/website-cjs-scripts',
    files: [
      'scripts/**/*.js',
      'cypress.config.cjs',
      'jest.setup.cjs',
      'jest.config.cjs',
      'postcss.config.cjs'
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node
    }
  }
];
