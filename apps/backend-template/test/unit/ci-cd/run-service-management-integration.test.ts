/* eslint-disable @typescript-eslint/no-var-requires */
const {
  CANDIDATE_TEST_DIRS,
  runServiceManagementIntegration
} = require('../../../../../ci-cd/run-service-management-integration');

describe('run-service-management-integration', () => {
  it('runs the canonical target without collecting or replacing unit coverage', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });
    const logger = {
      log: jest.fn(),
      error: jest.fn()
    };

    const status = runServiceManagementIntegration({
      root: '/workspace',
      exists: (candidate: string) => candidate.endsWith(CANDIDATE_TEST_DIRS[0]),
      spawn,
      logger
    });

    expect(status).toBe(0);
    expect(spawn).toHaveBeenCalledWith(
      'jest',
      [CANDIDATE_TEST_DIRS[0], '--runInBand', '--coverage=false'],
      {
        stdio: 'inherit',
        env: expect.objectContaining({ NODE_ENV: expect.any(String) })
      }
    );
    expect(logger.log).toHaveBeenCalledWith(
      `[ci] service-management integration target: ${CANDIDATE_TEST_DIRS[0]}`
    );
  });

  it('supports the legacy test location when the canonical location is absent', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(runServiceManagementIntegration({
      root: '/workspace',
      exists: (candidate: string) => candidate === `/workspace/${CANDIDATE_TEST_DIRS[1]}`,
      spawn,
      logger: { log: jest.fn(), error: jest.fn() }
    })).toBe(0);
    expect(spawn.mock.calls[0][1][0]).toBe(CANDIDATE_TEST_DIRS[1]);
  });

  it('fails closed when no target exists or Jest does not return success', () => {
    expect.hasAssertions();
    const logger = {
      log: jest.fn(),
      error: jest.fn()
    };

    expect(runServiceManagementIntegration({
      root: '/workspace',
      exists: () => false,
      logger
    })).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      '[ci] service-management integration: no test directories found.'
    );

    expect(runServiceManagementIntegration({
      root: '/workspace',
      exists: () => true,
      spawn: jest.fn().mockReturnValue({ status: null }),
      logger
    })).toBe(1);
  });
});
