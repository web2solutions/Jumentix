/* eslint-disable @typescript-eslint/no-var-requires */
const {
  CANDIDATE_TEST_DIRS,
  discoverTestFiles,
  runServiceManagementIntegration
} = require('../../../scripts/run-service-management-integration');

const oneTestFile = (dir: string) => [`${dir}/runtimeEnv.integration.test.ts`];

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
      discover: oneTestFile,
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
      `[ci] service-management integration targets: ${CANDIDATE_TEST_DIRS[0]}`
    );
  });

  it('runs every existing service-management integration target', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(runServiceManagementIntegration({
      root: '/workspace',
      exists: (candidate: string) => [
        `/workspace/${CANDIDATE_TEST_DIRS[0]}`,
        `/workspace/${CANDIDATE_TEST_DIRS[1]}`
      ].includes(candidate),
      discover: oneTestFile,
      spawn,
      logger: { log: jest.fn(), error: jest.fn() }
    })).toBe(0);
    expect(spawn.mock.calls[0][1].slice(0, 2)).toStrictEqual([
      CANDIDATE_TEST_DIRS[0],
      CANDIDATE_TEST_DIRS[1]
    ]);
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
      discover: oneTestFile,
      spawn: jest.fn().mockReturnValue({ status: null }),
      logger
    })).toBe(1);
  });

  it('fails closed when the target directory contains zero test files (JUM-557)', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });
    const logger = {
      log: jest.fn(),
      error: jest.fn()
    };

    const status = runServiceManagementIntegration({
      root: '/workspace',
      exists: () => true,
      discover: () => [],
      spawn,
      logger
    });

    expect(status).toBe(1);
    expect(spawn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `[ci] service-management integration: no test files discovered in ${CANDIDATE_TEST_DIRS.join(', ')}.`
    );
  });

  it('discovers real test files on disk and ignores helper modules', () => {
    expect.hasAssertions();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-discovery-'));
    try {
      fs.writeFileSync(path.join(dir, 'a.test.ts'), 'it("a", () => {});');
      fs.writeFileSync(path.join(dir, 'b.spec.js'), 'it("b", () => {});');
      fs.writeFileSync(path.join(dir, 'serverHarness.ts'), '// not a test');
      fs.mkdirSync(path.join(dir, 'nested'));
      fs.writeFileSync(path.join(dir, 'nested', 'c.test.ts'), 'it("c", () => {});');

      const found = discoverTestFiles(dir).map((entry: string) => path.basename(entry)).sort();
      expect(found).toStrictEqual(['a.test.ts', 'b.spec.js', 'c.test.ts']);
      expect(discoverTestFiles(path.join(dir, 'missing'))).toStrictEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
