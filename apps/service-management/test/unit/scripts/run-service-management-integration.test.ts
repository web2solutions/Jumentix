/* eslint-disable @typescript-eslint/no-var-requires, jest/no-conditional-in-test */
import path from 'node:path';

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

  it('falls back to the process working directory and the real fs logger when options are sparse', () => {
    expect.hasAssertions();
    const errorsSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // root '' is falsy, so the runner resolves against process.cwd(); the
      // injected exists denies everything under /workspace either way.
      expect(runServiceManagementIntegration({
        root: '',
        exists: () => false,
        logger: undefined
      })).toBe(1);
      // Omitting exists exercises the real fs.existsSync default against a
      // nonexistent workspace root, exiting before any spawn.
      expect(runServiceManagementIntegration({ root: '/workspace' })).toBe(1);
    } finally {
      errorsSpy.mockRestore();
    }
  });

  it('defaults NODE_ENV to dev and tolerates a missing PATH when spawning jest', () => {
    expect.hasAssertions();
    const NODE_ENV_KEY: string = 'NODE_ENV';
    const PATH_KEY: string = 'PATH';
    const originalNodeEnv = process.env[NODE_ENV_KEY];
    const originalPath = process.env[PATH_KEY];
    delete process.env[NODE_ENV_KEY];
    delete process.env[PATH_KEY];
    try {
      const spawn = jest.fn().mockReturnValue({ status: 0 });
      const status = runServiceManagementIntegration({
        root: '/workspace',
        exists: () => true,
        discover: oneTestFile,
        spawn,
        logger: { log: jest.fn(), error: jest.fn() }
      });
      expect(status).toBe(0);
      const spawnEnv = spawn.mock.calls[0][2].env;
      expect(spawnEnv.NODE_ENV).toBe('dev');
      expect(spawnEnv.PATH.startsWith(`${path.join('/workspace', 'node_modules', '.bin')}${path.delimiter}`))
        .toBe(true);
      expect(spawnEnv.PATH.endsWith(path.delimiter)).toBe(true);
    } finally {
      if (originalNodeEnv === undefined) delete process.env[NODE_ENV_KEY];
      else process.env[NODE_ENV_KEY] = originalNodeEnv;
      if (originalPath === undefined) delete process.env[PATH_KEY];
      else process.env[PATH_KEY] = originalPath;
    }
  });

  it('discovers real test files on disk and ignores helper modules', () => {
    expect.hasAssertions();
    const fs = require('fs');
    const os = require('os');
    const nodePath = require('path');

    const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'sm-discovery-'));
    try {
      fs.writeFileSync(nodePath.join(dir, 'a.test.ts'), 'it("a", () => {});');
      fs.writeFileSync(nodePath.join(dir, 'b.spec.js'), 'it("b", () => {});');
      fs.writeFileSync(nodePath.join(dir, 'serverHarness.ts'), '// not a test');
      fs.mkdirSync(nodePath.join(dir, 'nested'));
      fs.writeFileSync(nodePath.join(dir, 'nested', 'c.test.ts'), 'it("c", () => {});');

      const found = discoverTestFiles(dir).map((entry: string) => nodePath.basename(entry)).sort();
      expect(found).toStrictEqual(['a.test.ts', 'b.spec.js', 'c.test.ts']);
      expect(discoverTestFiles(nodePath.join(dir, 'missing'))).toStrictEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
