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
    '<rootDir>/packages/',
    '<rootDir>/ci-cd/(?!check-canonical-integrations\\.js$)',
    '<rootDir>/apps/backend-template/src/modules/Users/adapters/out/persistence/UserDataRepository.ts',
    '<rootDir>/apps/backend-template/src/modules/Users/adapters/out/persistence/OrganizationDataRepository.ts'
  ],
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
