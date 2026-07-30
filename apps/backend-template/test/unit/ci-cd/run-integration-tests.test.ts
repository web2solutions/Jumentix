/* eslint-disable @typescript-eslint/no-var-requires */
const {
  DEFAULT_INTEGRATION_TIMEOUT_MS,
  INTEGRATION_SCRIPTS,
  INTEGRATION_TIMEOUT_OVERRIDES_MS,
  executeIntegrationScript,
  runIntegrationTests,
  validateIntegrationManifest
} = require('../../../../../ci-cd/run-integration-tests');
const rootPackage = require('../../../../../package.json');

describe('run-integration-tests', () => {
  it('covers every supported integration runtime, including Lambda', () => {
    expect.hasAssertions();
    expect(INTEGRATION_SCRIPTS).toStrictEqual([
      'test:integration:express',
      'test:integration:fastify',
      'test:integration:restify',
      'test:integration:lambda',
      'test:integration:cloudflare-workers',
      'test:integration:vercel-functions',
      'test:integration:loopback',
      'test:integration:sails-js',
      'test:integration:feathers',
      'test:integration:derby-js',
      'test:integration:adonis-js',
      'test:integration:total-js',
      'test:integration:realtime',
      'test:integration:service-management'
    ]);
  });

  it('keeps smoke in the fast gate and delegates strict execution to the canonical matrix', () => {
    expect.hasAssertions();
    expect(rootPackage.scripts['ci:gate']).toContain('bun run ci:smoke');
    expect(rootPackage.scripts['ci:gate:strict']).toBe('bun ci-cd/run-full-test-matrix.js');
    expect(rootPackage.scripts['test:integration']).toBe('bun ci-cd/run-integration-tests.js');
  });

  it('gives only Restify deterministic per-test headroom under sustained matrix load', () => {
    expect.hasAssertions();
    expect(rootPackage.scripts['test:integration:restify']).toContain('--testTimeout=15000');
    expect(rootPackage.scripts['test:integration:express']).not.toContain('--testTimeout');
    expect(rootPackage.scripts['test:integration:fastify']).not.toContain('--testTimeout');
  });

  it('runs every target and aggregates failures instead of stopping early', () => {
    expect.hasAssertions();
    const scripts = ['first', 'failing', 'last'];
    const execute = jest.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(0);
    const logger = {
      log: jest.fn(),
      error: jest.fn()
    };

    const failures = runIntegrationTests({ scripts, execute, logger });

    expect(execute.mock.calls).toStrictEqual([
      ['first'],
      ['failing'],
      ['last']
    ]);
    expect(failures).toStrictEqual([{ scriptName: 'failing', status: 2 }]);
    expect(logger.error).toHaveBeenCalledWith('- failing (exit 2)');
  });

  it('runs targets in deterministic CI mode and fails timed-out targets', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({
      status: null,
      error: { code: 'ETIMEDOUT' }
    });

    expect(executeIntegrationScript('slow-target', {
      spawn,
      timeoutMs: 1_000
    })).toBe(124);
    expect(spawn).toHaveBeenCalledWith('bun', ['run', 'slow-target'], {
      stdio: 'inherit',
      env: expect.objectContaining({ CI: 'true' }),
      timeout: 1_000,
      killSignal: 'SIGTERM'
    });
    expect(DEFAULT_INTEGRATION_TIMEOUT_MS).toBe(120_000);
    expect(INTEGRATION_TIMEOUT_OVERRIDES_MS).toStrictEqual({
      'test:integration:express': 300_000,
      'test:integration:fastify': 300_000,
      'test:integration:restify': 600_000
    });
  });

  it.each([
    'test:integration:express',
    'test:integration:fastify'
  ])('gives the complete %s HTTP suite deterministic process headroom', (scriptName) => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(executeIntegrationScript(scriptName, { spawn })).toBe(0);
    expect(spawn).toHaveBeenCalledWith('bun', ['run', scriptName], {
      stdio: 'inherit',
      env: expect.objectContaining({ CI: 'true' }),
      timeout: 300_000,
      killSignal: 'SIGTERM'
    });
  });

  it('gives only complete Restify extra finite process headroom under extreme load', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(executeIntegrationScript('test:integration:restify', { spawn })).toBe(0);
    expect(spawn).toHaveBeenCalledWith('bun', ['run', 'test:integration:restify'], {
      stdio: 'inherit',
      env: expect.objectContaining({ CI: 'true' }),
      timeout: 600_000,
      killSignal: 'SIGTERM'
    });
  });

  it('keeps the fail-closed default for smaller integration targets', () => {
    expect.hasAssertions();
    const spawn = jest.fn().mockReturnValue({ status: 0 });

    expect(executeIntegrationScript('test:integration:lambda', { spawn })).toBe(0);
    expect(spawn).toHaveBeenCalledWith('bun', ['run', 'test:integration:lambda'], {
      stdio: 'inherit',
      env: expect.objectContaining({ CI: 'true' }),
      timeout: DEFAULT_INTEGRATION_TIMEOUT_MS,
      killSignal: 'SIGTERM'
    });
  });

  it('fails closed when the required target manifest is empty or duplicated', () => {
    expect.hasAssertions();
    expect(() => validateIntegrationManifest([]))
      .toThrow('at least one required target');
    expect(() => validateIntegrationManifest(['same', 'same']))
      .toThrow('duplicate required targets');
  });

  it('reports unexpected target crashes and continues with remaining targets', () => {
    expect.hasAssertions();
    const execute = jest.fn()
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockReturnValueOnce(0);
    const logger = {
      log: jest.fn(),
      error: jest.fn()
    };

    const failures = runIntegrationTests({
      scripts: ['crashing', 'next'],
      execute,
      logger
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(failures).toStrictEqual([{ scriptName: 'crashing', status: 1 }]);
  });
});
