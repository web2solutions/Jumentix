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
    // `run-suite` and `run-full-test-matrix` are deliberately NOT opted in yet,
    // even though both gained suites in this change. Measured, they sit at 90.6%
    // and 77.3% of statements, which drags the whole project under the 99/90
    // contract — and Requirement 110 §3 forbids meeting a threshold by moving
    // scope, in either direction. Opting them in belongs with the work that
    // brings them to threshold, not with a promotion. The cost is visible and
    // accepted: Sonar reports new lines in either file as 0% covered on new
    // code, so a pull request touching only them fails the advisory SonarCloud
    // analysis while the three required checks pass.
    '<rootDir>/ci-cd/(?!(check-canonical-integrations|check-bun-version|check-commit-authorship|check-coverage-thresholds|check-dependency-override-integrity)\\.js$)',
    '<rootDir>/apps/backend-template/src/modules/Users/adapters/out/persistence/UserDataRepository.ts',
    '<rootDir>/apps/backend-template/src/modules/Users/adapters/out/persistence/OrganizationDataRepository.ts'
  ],
  // `ci-cd/check-coverage-thresholds.js` is the authority (Requirement 110); this
  // block is a fail-fast inner guard so a coverage run stops before the scan.
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 99,
      lines: 99,
      statements: 99
    }
  },
  setupFiles: ["./ci-cd/loadEnvironment.js"],
};
