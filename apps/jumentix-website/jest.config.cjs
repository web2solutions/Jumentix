const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  // JUM-158: the route-discovery suite is ESM (.mjs) because the script it
  // guards is, and that script is also executed directly by the sweep. Without
  // this, next/jest silently matches nothing and the suite never runs.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/?(*.)+(spec|test).mjs'],
};

module.exports = createJestConfig(customJestConfig);
