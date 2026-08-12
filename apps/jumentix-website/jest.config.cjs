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
  },
  testEnvironment: 'jest-environment-jsdom',
  // JUM-158: the route-discovery suite is ESM (.mjs) because the script it
  // guards is, and that script is also executed directly by the sweep. Without
  // this, next/jest silently matches nothing and the suite never runs.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/?(*.)+(spec|test).mjs'],
};

module.exports = createJestConfig(customJestConfig);
