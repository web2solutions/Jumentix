const { WITHOUT_SUITE_YET } = require('./ci-cd/check-package-suites.js');

/**
 * Packages excluded from coverage, derived rather than restated.
 *
 * Requirement 112 §6 says the debt register and the coverage exclusions are the
 * same list. Writing that list twice makes it true only until someone edits one
 * of them, and the copy that drifts is the one that keeps reporting a number
 * nobody checks. So the register in `check-package-suites.js` is the source, and
 * this is generated from it: a package gains a suite, its entry goes, and it
 * starts being measured in the same commit.
 *
 * `sonar-project.properties` cannot require JavaScript, so its copy stays
 * hand-written — and `packages:check-suites` fails when the two disagree, in
 * either direction.
 */
const packagesWithoutSuites = Object.keys(WITHOUT_SUITE_YET);
const packageCoverageIgnorePattern = packagesWithoutSuites.length > 0
  ? [`<rootDir>/packages/(${packagesWithoutSuites.join('|')})/`]
  : [];

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
  /**
   * JavaScript sources are transformed too, not only TypeScript — see
   * `ci-cd/jest/javascript-transformer.js` for why it needs to be a transformer
   * of our own rather than ts-jest directly.
   *
   * `transformIgnorePatterns` still keeps node_modules out, so this applies to
   * first-party JavaScript only.
   */
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
    '^.+\\.m?js$': '<rootDir>/ci-cd/jest/javascript-transformer.js'
  },
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
    // Derived from WITHOUT_SUITE_YET above: only packages that still owe a suite
    // are excluded. Everything else is measured, which is what Requirement 112
    // §1 means by "at the project's 99% standard".
    ...packageCoverageIgnorePattern,
    // dist/ stays out regardless: measuring a build artifact says nothing about
    // the source it came from (JUM-578).
    '<rootDir>/packages/[^/]+/dist/',
    '<rootDir>/packages/[^/]+/test/',
    // ci-cd is excluded from coverage wholesale, with named opt-ins. Sonar reads
    // this same lcov, so a new ci-cd file that is not listed here reports as 0%
    // covered on new code and fails the quality gate even when it has tests.
    // Keep this list and the suites under test/unit/ci-cd/ in step.
    '<rootDir>/ci-cd/(?!(lib/mapped-suites|check-canonical-integrations|check-bun-version|check-commit-authorship|check-coverage-thresholds|check-dependency-override-integrity|check-package-suites|run-full-test-matrix|run-suite)\\.js$)',
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
