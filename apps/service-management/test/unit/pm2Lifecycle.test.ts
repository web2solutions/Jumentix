/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-770 — PM2 lifecycle rules: config-file recognition (mirrors pm2's
 * Common.isConfigFile), start verification and the service-manager
 * self-guard. All through injected fakes — no PM2 daemon involved.
 */

const {
  isPm2ConfigFile,
  isServiceManagerProcess,
  createPm2ActionRunner
} = require('../../src/runtime/pm2Lifecycle');

type ProcessEntry = { name: string; pmId: number | null; namespace: string; status?: string };

type RunnerOverrides = {
  processes?: ProcessEntry[];
  ecosystem?: { exists: boolean; path: string };
};

function makeRunner(overrides: RunnerOverrides = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const state = {
    processes: overrides.processes || [],
    ecosystem: overrides.ecosystem || { exists: true, path: 'pm2/ecosystem.dev.config.cjs' }
  };
  const runner = createPm2ActionRunner({
    normalizeEnvironment: (runtime: string) => String(runtime || 'dev'),
    readEcosystem: () => state.ecosystem,
    listProcesses: async () => state.processes,
    runMethod: async (method: string, ...args: unknown[]) => {
      calls.push({ method, args });
      return null;
    }
  });
  return { runner, calls, state };
}

const restApi = {
  name: 'jumentix-dev-restapi', pmId: 1, namespace: 'default', status: 'online'
};
const serviceManager = {
  name: 'jumentix-dev-service-management',
  pmId: 2,
  namespace: 'default',
  status: 'online'
};

describe('service-management pm2Lifecycle.isPm2ConfigFile', () => {
  it('recognizes the renamed .config.cjs ecosystems exactly like pm2 does', () => {
    expect.hasAssertions();
    expect(isPm2ConfigFile('pm2/ecosystem.dev.config.cjs')).toBe('js');
    expect(isPm2ConfigFile('ecosystem.staging.config.cjs')).toBe('js');
    expect(isPm2ConfigFile('ecosystem.production.config.cjs')).toBe('js');
    expect(isPm2ConfigFile('ecosystem.config.js')).toBe('js');
    expect(isPm2ConfigFile('ecosystem.config.mjs')).toBe('mjs');
    expect(isPm2ConfigFile('ecosystem.json')).toBe('json');
    expect(isPm2ConfigFile('ecosystem.yml')).toBe('yaml');
    expect(isPm2ConfigFile('ecosystem.yaml')).toBe('yaml');
  });

  it('rejects the old plain .cjs names — the phantom-start root cause', () => {
    expect.hasAssertions();
    expect(isPm2ConfigFile('ecosystem.dev.cjs')).toBeNull();
    expect(isPm2ConfigFile('ecosystem.staging.cjs')).toBeNull();
    expect(isPm2ConfigFile('ecosystem.production.cjs')).toBeNull();
    expect(isPm2ConfigFile('server.js')).toBeNull();
    expect(isPm2ConfigFile(null)).toBeNull();
    expect(isPm2ConfigFile(42)).toBeNull();
  });
});

describe('service-management pm2Lifecycle self-guard', () => {
  it('matches every service-manager process name, including the -api variant', () => {
    expect.hasAssertions();
    expect(isServiceManagerProcess('jumentix-dev-service-management')).toBe(true);
    expect(isServiceManagerProcess('jumentix-staging-service-management')).toBe(true);
    expect(isServiceManagerProcess('jumentix-prod-service-management')).toBe(true);
    expect(isServiceManagerProcess('jumentix-dev-service-management-api')).toBe(true);
    expect(isServiceManagerProcess('jumentix-dev-restapi')).toBe(false);
    expect(isServiceManagerProcess('service-management')).toBe(false);
    expect(isServiceManagerProcess('')).toBe(false);
  });

  it.each(['stop', 'restart', 'delete'])('refuses %s on the service manager with an explicit reason', async (action) => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi, serviceManager] });
    await expect(runner({
      action,
      scope: 'process',
      name: 'jumentix-dev-service-management',
      environment: 'dev'
    })).rejects.toMatchObject({
      code: 'SELF_ACTION_BLOCKED',
      message: expect.stringContaining(`cannot ${action} itself`)
    });
    expect(calls).toStrictEqual([]);
  });

  it('refuses stop/restart resolved to the manager by pmId, and never calls pm2', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi, serviceManager] });
    await expect(runner({
      action: 'restart',
      scope: 'process',
      pmId: 2,
      environment: 'dev'
    })).rejects.toMatchObject({ code: 'SELF_ACTION_BLOCKED' });
    expect(calls).toStrictEqual([]);
  });

  it('still allows stop/restart on regular processes', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi, serviceManager] });
    await expect(runner({
      action: 'restart',
      scope: 'process',
      name: 'jumentix-dev-restapi',
      environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'restart', args: ['jumentix-dev-restapi'] }]);
  });

  it('excludes the service manager from bulk namespace stop and reports the skip', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi, serviceManager] });
    const result = await runner({
      action: 'stop',
      scope: 'namespace',
      namespace: 'default',
      environment: 'dev'
    });
    expect(result).toStrictEqual({
      affected: 1,
      skipped: ['jumentix-dev-service-management']
    });
    expect(calls).toStrictEqual([{ method: 'stop', args: ['jumentix-dev-restapi'] }]);
  });

  it('keeps the service manager in bulk namespace start (start cannot kill the console)', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi, serviceManager] });
    const result = await runner({
      action: 'start',
      scope: 'namespace',
      namespace: 'default',
      environment: 'dev'
    });
    expect(result).toStrictEqual({ affected: 2, skipped: [] });
    expect(calls).toStrictEqual([
      { method: 'start', args: ['jumentix-dev-restapi'] },
      { method: 'start', args: ['jumentix-dev-service-management'] }
    ]);
  });
});

describe('service-management pm2Lifecycle start verification', () => {
  it('resolves when the started process shows up in the post-start list', async () => {
    expect.hasAssertions();
    const state = {
      processes: [] as Array<{ name: string; pmId: number; namespace: string; status: string }>
    };
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: true, path: 'pm2/ecosystem.dev.config.cjs' }),
      listProcesses: async () => state.processes,
      runMethod: async () => {
        // Simulate pm2 honouring the start: the process appears in the list.
        state.processes = [{
          name: 'jumentix-dev-websocketapi', pmId: 3, namespace: 'default', status: 'online'
        }];
        return null;
      }
    });
    await expect(runner({
      action: 'start',
      scope: 'ecosystem-missing',
      name: 'jumentix-dev-websocketapi',
      environment: 'dev'
    })).resolves.toBeUndefined();
  });

  it('fails with START_VERIFY_FAILED when the process is absent after an ecosystem --only start', async () => {
    expect.hasAssertions();
    // The pre-fix phantom: pm2 answers ok but nothing was ever registered.
    const { runner, calls } = makeRunner({ processes: [restApi] });
    await expect(runner({
      action: 'start',
      scope: 'ecosystem-missing',
      name: 'jumentix-dev-grpcapi',
      environment: 'dev'
    })).rejects.toMatchObject({
      code: 'START_VERIFY_FAILED',
      message: expect.stringContaining('jumentix-dev-grpcapi')
    });
    expect(calls).toStrictEqual([
      { method: 'start', args: ['pm2/ecosystem.dev.config.cjs', { only: 'jumentix-dev-grpcapi' }] }
    ]);
  });

  it('fails with START_VERIFY_FAILED when re-starting a listed process leaves it unlisted', async () => {
    expect.hasAssertions();
    const lists = [[restApi], []];
    let listCall = 0;
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: true, path: 'pm2/ecosystem.dev.config.cjs' }),
      listProcesses: async () => {
        const current = lists[Math.min(listCall, lists.length - 1)];
        listCall += 1;
        return current;
      },
      runMethod: async () => null
    });
    await expect(runner({
      action: 'start',
      scope: 'process',
      name: 'jumentix-dev-restapi',
      environment: 'dev'
    })).rejects.toMatchObject({ code: 'START_VERIFY_FAILED' });
  });

  it('starts a missing ecosystem process through the .config.cjs path and verifies it', async () => {
    expect.hasAssertions();
    const state = { processes: [restApi] };
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: true, path: 'pm2/ecosystem.dev.config.cjs' }),
      listProcesses: async () => state.processes,
      runMethod: async (method: string, ...args: unknown[]) => {
        calls.push({ method, args });
        state.processes = [...state.processes, {
          name: 'jumentix-dev-grpcapi',
          pmId: 4,
          namespace: 'default',
          status: 'online'
        }];
        return null;
      }
    });
    await expect(runner({
      action: 'start',
      scope: 'ecosystem-missing',
      name: 'jumentix-dev-grpcapi',
      environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([
      { method: 'start', args: ['pm2/ecosystem.dev.config.cjs', { only: 'jumentix-dev-grpcapi' }] }
    ]);
  });

  it('rejects unsupported actions and scopes with the pre-existing error codes', async () => {
    expect.hasAssertions();
    const { runner } = makeRunner({ processes: [restApi] });
    await expect(runner({
      action: 'reload', scope: 'process', name: 'x', environment: 'dev'
    }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_PM2_ACTION' });
    await expect(runner({
      action: 'stop', scope: 'galaxy', name: 'x', environment: 'dev'
    }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_PM2_SCOPE' });
    await expect(runner({ action: 'stop', scope: 'process', environment: 'dev' }))
      .rejects.toMatchObject({ code: 'INVALID_PM2_TARGET' });
  });
});
