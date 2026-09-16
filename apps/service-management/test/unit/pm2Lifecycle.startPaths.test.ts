/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * pm2Lifecycle start/guard paths left uncovered by pm2Lifecycle.test.ts:
 * start of an already-listed process, ecosystem --only starts, direct starts
 * when the ecosystem file is missing, the ecosystem-missing guards, target
 * matching by name/pmId fallbacks and request defaults. All through injected
 * fakes — no PM2 daemon involved.
 */

const { createPm2ActionRunner } = require('../../src/runtime/pm2Lifecycle');

type ProcessEntry = { name: string; pmId: number | null; namespace: string; status?: string };

type RunnerOverrides = {
  processes?: ProcessEntry[];
  ecosystem?: { exists: boolean; path: string };
  normalizeEnvironment?: (runtime: string) => string;
};

function makeRunner(overrides: RunnerOverrides = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const state = {
    processes: overrides.processes || [],
    ecosystem: overrides.ecosystem || { exists: true, path: 'pm2/ecosystem.dev.config.cjs' }
  };
  const runner = createPm2ActionRunner({
    normalizeEnvironment: overrides.normalizeEnvironment || ((runtime: string) => String(runtime || 'dev')),
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

describe('service-management pm2Lifecycle process start paths', () => {
  it('starts an already-listed stopped process by name and verifies registration', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [{ ...restApi, status: 'stopped' }] });
    await expect(runner({
      action: 'start', scope: 'process', name: 'jumentix-dev-restapi', environment: 'dev'
    })).resolves.toBeUndefined();
    // A listed process is started by name — never through the ecosystem --only
    // path, which is the phantom-start root cause.
    expect(calls).toStrictEqual([{ method: 'start', args: ['jumentix-dev-restapi'] }]);
  });

  it('starts a listed process that has no name by its pmId', async () => {
    expect.hasAssertions();
    const state = {
      processes: [{
        name: '', pmId: 8, namespace: 'default', status: 'stopped'
      }] as ProcessEntry[]
    };
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: true, path: 'pm2/ecosystem.dev.config.cjs' }),
      listProcesses: async () => state.processes,
      runMethod: async (method: string, ...args: unknown[]) => {
        calls.push({ method, args });
        // pm2 normalizes: after start the process is listed under its id-name.
        state.processes = [{
          name: '8', pmId: 8, namespace: 'default', status: 'online'
        }];
        return null;
      }
    });
    await expect(runner({
      action: 'start', scope: 'process', pmId: 8, environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'start', args: ['8'] }]);
  });

  it('starts an unlisted named process from the ecosystem with --only and verifies it', async () => {
    expect.hasAssertions();
    const state = { processes: [restApi] as ProcessEntry[] };
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: true, path: 'pm2/ecosystem.dev.config.cjs' }),
      listProcesses: async () => state.processes,
      runMethod: async (method: string, ...args: unknown[]) => {
        calls.push({ method, args });
        state.processes = [...state.processes, {
          name: 'jumentix-dev-grpcapi', pmId: 4, namespace: 'default', status: 'online'
        }];
        return null;
      }
    });
    await expect(runner({
      action: 'start', scope: 'process', name: 'jumentix-dev-grpcapi', environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([
      { method: 'start', args: ['pm2/ecosystem.dev.config.cjs', { only: 'jumentix-dev-grpcapi' }] }
    ]);
  });

  it('starts an unlisted process directly when the ecosystem file does not exist', async () => {
    expect.hasAssertions();
    const state = { processes: [] as ProcessEntry[] };
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: false, path: '' }),
      listProcesses: async () => state.processes,
      runMethod: async (method: string, ...args: unknown[]) => {
        calls.push({ method, args });
        state.processes = [{
          name: 'worker', pmId: 5, namespace: 'default', status: 'online'
        }];
        return null;
      }
    });
    await expect(runner({
      action: 'start', scope: 'process', name: 'worker', environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'start', args: ['worker'] }]);
  });

  it('verifies a direct pmId start against the id-name when the ecosystem is missing', async () => {
    expect.hasAssertions();
    const state = { processes: [] as ProcessEntry[] };
    const runner = createPm2ActionRunner({
      normalizeEnvironment: () => 'dev',
      readEcosystem: () => ({ exists: false, path: '' }),
      listProcesses: async () => state.processes,
      runMethod: async () => {
        state.processes = [{
          name: '5', pmId: 5, namespace: 'default', status: 'online'
        }];
        return null;
      }
    });
    await expect(runner({
      action: 'start', scope: 'process', pmId: 5, environment: 'dev'
    })).resolves.toBeUndefined();
  });

  it('refuses an ecosystem start for an unlisted process addressed only by pmId', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi] });
    await expect(runner({
      action: 'start', scope: 'process', pmId: 9, environment: 'dev'
    })).rejects.toMatchObject({
      code: 'INVALID_PM2_TARGET',
      message: expect.stringContaining('cannot be started from the ecosystem without a name')
    });
    expect(calls).toStrictEqual([]);
  });
});

describe('service-management pm2Lifecycle target matching', () => {
  it('runs stop for a target that is not in the pm2 list at all', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi] });
    await expect(runner({
      action: 'stop', scope: 'process', name: 'ghost', environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'stop', args: ['ghost'] }]);
  });

  it('blocks stop resolved to the manager by pmId even when another name is given', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi, serviceManager] });
    await expect(runner({
      action: 'stop', scope: 'process', name: 'other-app', pmId: 2, environment: 'dev'
    })).rejects.toMatchObject({
      code: 'SELF_ACTION_BLOCKED',
      message: expect.stringContaining('jumentix-dev-service-management')
    });
    expect(calls).toStrictEqual([]);
  });

  it('matches a request pmId against an entry whose name is that id as a string', async () => {
    expect.hasAssertions();
    const idNamed = {
      name: '1', pmId: 2, namespace: 'default', status: 'online'
    };
    const { runner, calls } = makeRunner({ processes: [idNamed] });
    await expect(runner({
      action: 'restart', scope: 'process', pmId: 1, environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'restart', args: [1] }]);
  });

  it('matches a numeric-looking name against an entry with that pmId', async () => {
    expect.hasAssertions();
    const numbered = {
      name: 'worker', pmId: 3, namespace: 'default', status: 'online'
    };
    const { runner, calls } = makeRunner({ processes: [numbered] });
    await expect(runner({
      action: 'stop', scope: 'process', name: '3', environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'stop', args: ['3'] }]);
  });

  it('ignores null entries in the process list while matching', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({
      processes: [null as unknown as ProcessEntry, restApi]
    });
    await expect(runner({
      action: 'stop', scope: 'process', name: 'jumentix-dev-restapi', environment: 'dev'
    })).resolves.toBeUndefined();
    expect(calls).toStrictEqual([{ method: 'stop', args: ['jumentix-dev-restapi'] }]);
  });

  it('rejects an empty-string name and pmId as INVALID_PM2_TARGET', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi] });
    await expect(runner({
      action: 'stop', scope: 'process', name: '', pmId: '', environment: 'dev'
    })).rejects.toMatchObject({ code: 'INVALID_PM2_TARGET' });
    expect(calls).toStrictEqual([]);
  });
});

describe('service-management pm2Lifecycle ecosystem-missing guards', () => {
  it('requires a name for ecosystem-missing starts', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({ processes: [restApi] });
    await expect(runner({
      action: 'start', scope: 'ecosystem-missing', environment: 'dev'
    })).rejects.toMatchObject({
      code: 'INVALID_PM2_TARGET',
      message: expect.stringContaining('ecosystem-missing start requires name')
    });
    expect(calls).toStrictEqual([]);
  });

  it('fails with ECOSYSTEM_MISSING naming the environment when the file is absent', async () => {
    expect.hasAssertions();
    const { runner, calls } = makeRunner({
      processes: [restApi],
      ecosystem: { exists: false, path: '' },
      normalizeEnvironment: () => 'production'
    });
    await expect(runner({
      action: 'start', scope: 'ecosystem-missing', name: 'jumentix-prod-restapi', environment: 'production'
    })).rejects.toMatchObject({
      code: 'ECOSYSTEM_MISSING',
      message: expect.stringContaining('production')
    });
    expect(calls).toStrictEqual([]);
  });
});

describe('service-management pm2Lifecycle request defaults', () => {
  it('rejects an empty request as an unsupported empty action', async () => {
    expect.hasAssertions();
    const { runner } = makeRunner({ processes: [restApi] });
    await expect(runner({})).rejects.toMatchObject({
      code: 'UNSUPPORTED_PM2_ACTION',
      message: 'Unsupported PM2 action: '
    });
  });

  it('uses the default namespace when the request omits it', async () => {
    expect.hasAssertions();
    const stagingOnly = {
      name: 'staging-worker', pmId: 6, namespace: 'staging', status: 'online'
    };
    const { runner, calls } = makeRunner({ processes: [restApi, stagingOnly] });
    const result = await runner({ action: 'stop', scope: 'namespace', environment: 'dev' });
    expect(result).toStrictEqual({ affected: 1, skipped: [] });
    expect(calls).toStrictEqual([{ method: 'stop', args: ['jumentix-dev-restapi'] }]);
  });

  it('falls back to pmId for namespace entries without a name', async () => {
    expect.hasAssertions();
    const nameless = {
      name: '', pmId: 9, namespace: 'default', status: 'stopped'
    };
    const { runner, calls } = makeRunner({ processes: [nameless] });
    const result = await runner({
      action: 'start', scope: 'namespace', namespace: 'default', environment: 'dev'
    });
    expect(result).toStrictEqual({ affected: 1, skipped: [] });
    expect(calls).toStrictEqual([{ method: 'start', args: ['9'] }]);
  });
});

// Module marker: keeps the file out of the shared script scope (TS2451).
// eslint-disable-next-line jest/no-export
export {};
