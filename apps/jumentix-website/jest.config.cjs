const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    // JUM-680: resolve the workspace package from source, not from `dist`.
    //
    // `@jumentix/cana`'s `main` is `dist/index.js`, so a suite importing it
    // passes on a machine that happens to have built the package and fails on a
    // clean checkout — which is exactly what CI reported once these suites
    // started running there. Mapping to the source removes the dependency on
    // build order for the tests; the site's own build still consumes `dist`.
    '^@jumentix/cana$': '<rootDir>/../../packages/cana/src/index.ts',
    // JUM-701: Monaco's published entry is an AMD bundle that calls `define` at
    // load, which throws under jsdom. The component used to dodge that by
    // checking `NODE_ENV === 'test'` and never mounting — so the suites tested a
    // component that had switched itself off. The double lets the mount path
    // run; the real editor is covered by the Cypress suites, in a real browser.
    '^monaco-editor$': '<rootDir>/test/mocks/monaco-editor.ts',
    // JUM-728: the theme package is ESM-only and does not resolve under jsdom.
    // `MDXMonacoPre` imports it for one thing — the `pre` it delegates shell
    // fences to — and the double provides exactly that.
    '^nextra-theme-docs$': '<rootDir>/test/mocks/nextra-theme-docs.tsx',
  },
  testEnvironment: 'jest-environment-jsdom',
  // JUM-158: the route-discovery suite is ESM (.mjs) because the script it
  // guards is, and that script is also executed directly by the sweep. Without
  // this, next/jest silently matches nothing and the suite never runs.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/?(*.)+(spec|test).mjs'],
};

module.exports = createJestConfig(customJestConfig);
