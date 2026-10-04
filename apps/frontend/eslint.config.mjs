import { fileURLToPath } from 'node:url';

import {
  baseStrict,
  nodeStrict,
  stylistic,
  testStrict,
  typescriptStrict,
  vueStrict
} from '@jumentix/config-eslint';
import globals from 'globals';

const appDir = fileURLToPath(new URL('.', import.meta.url));

export default [
  {
    name: 'jumentix/frontend-ignores',
    ignores: [
      'dist/**',
      'template/**',
      '.claude/**',
      '.openclaude/**',
      '.wwebjs_auth/**',
      '.wwebjs_cache/**',
      'exports/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.mjs'
    ]
  },
  ...baseStrict({ packageDirs: [appDir] }),
  ...typescriptStrict({
    tsconfigRootDir: appDir,
    // App aliases (@/*) live in the app tsconfig; @jumentix/* in the root one.
    resolverProjects: [
      fileURLToPath(new URL('tsconfig.json', import.meta.url)),
      fileURLToPath(new URL('tsconfig.eslint.json', import.meta.url)),
      fileURLToPath(new URL('../../tsconfig.json', import.meta.url))
    ],
    extraFileExtensions: ['.vue'],
    // bun:test suites (JUM-760) are excluded from the app tsconfig on purpose.
    untypedFiles: ['test/**']
  }),
  ...vueStrict({
    tsconfigRootDir: appDir,
    resolverProjects: [
      fileURLToPath(new URL('tsconfig.json', import.meta.url)),
      fileURLToPath(new URL('tsconfig.eslint.json', import.meta.url)),
      fileURLToPath(new URL('../../tsconfig.json', import.meta.url))
    ]
  }),
  ...nodeStrict({
    // Browser code: n flags navigator/crypto/URL.createObjectURL as Node experiments.
    noUnsupportedFeaturesOffFiles: ['src/**', 'test/**', 'cypress/**', 'public/**']
  }),
  ...testStrict({
    frontendTestFiles: ['test/**/*.ts'],
    cypressFiles: ['cypress/**/*.ts'],
    restifyAllowList: false,
    untypedFiles: ['test/**']
  }),
  ...stylistic(),
  {
    // Browser-runtime service worker: no bundler, no Node globals.
    name: 'jumentix/frontend-sw',
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.browser
      }
    },
    rules: {
      // `self` IS the global scope of a service worker — window does not
      // exist there; the CRA-derived restriction targets window code.
      'no-restricted-globals': 'off'
    }
  }
];
