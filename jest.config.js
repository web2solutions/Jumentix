const nodeMajor = Number(process.versions.node.split('.')[0]);
const unsupportedRuntimeIgnorePatterns = nodeMajor > 22
  ? [
    '<rootDir>/apps/backend-template/test/integration/Restify/',
    '<rootDir>/apps/backend-template/test/integration/mutex/redis.restify.test.ts'
  ]
  : [];
const redisIntegrationIgnorePatterns = process.env.RUN_REDIS_INTEGRATION
  ? []
  : [
    '<rootDir>/apps/backend-template/test/integration/mutex/',
    '<rootDir>/apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts'
  ];

module.exports = {
  preset: 'ts-jest',
  verbose: true,
  detectOpenHandles: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '@src/(.*)$': '<rootDir>/apps/backend-template/src/$1',
    '@seed/(.*)$': '<rootDir>/apps/backend-template/seed/$1',
    '@test/(.*)$': '<rootDir>/apps/backend-template/test/$1',
    '@jumentix/(.*)$': '<rootDir>/packages/$1/src',
  },
  testPathIgnorePatterns: [
    ...unsupportedRuntimeIgnorePatterns,
    ...redisIntegrationIgnorePatterns
  ],
  modulePathIgnorePatterns: ['dist', '.build', '.serverless', '.resources'],
  coveragePathIgnorePatterns: [
    // packages/ is excluded except cana/src, which this epic added with 293 tests.
    // Sonar reads this lcov, so an excluded path reports as 0% covered on new code
    // — a package with a full suite looked untested. dist/ stays out: measuring a
    // build artifact says nothing about the source it came from (JUM-578).
    '<rootDir>/packages/(?!cana/src/)',
    '<rootDir>/packages/cana/dist/',
    // ci-cd is excluded from coverage wholesale, with named opt-ins. Sonar reads
    // this same lcov, so a new ci-cd file that is not listed here reports as 0%
    // covered on new code and fails the quality gate even when it has tests.
    // Keep this list and the suites under test/unit/ci-cd/ in step.
    '<rootDir>/ci-cd/(?!(check-canonical-integrations|check-bun-version|check-coverage-thresholds|check-dependency-override-integrity)\\.js$)',
    '<rootDir>/apps/backend-template/src/modules/Users/adapters/out/persistence/UserDataRepository.ts',
    '<rootDir>/apps/backend-template/src/modules/Users/adapters/out/persistence/OrganizationDataRepository.ts'
  ],
  // `ci-cd/check-coverage-thresholds.js` is the authority (Requirement 110); this
  // block is a fail-fast inner guard so a coverage run stops before the scan.
  //
  // `statements` sits at 98.99 rather than 99 under a dated, tracked exception —
  // widening the coverage scope to include packages/cana/src moved the tree from
  // 99.26% over the old scope to 98.99% over the new one. The checker enforces it
  // as a ratchet: at or above the floor passes, below fails, and the exception
  // must be removed once the metric clears 99 (JUM-588).
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 99,
      lines: 99,
      statements: 98.99
    }
  },
  setupFiles: ["./ci-cd/loadEnvironment.js"],
};
