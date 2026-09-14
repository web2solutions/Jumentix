/* eslint-disable @typescript-eslint/no-explicit-any, jest/max-expects */

import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { composeUsersAuthServices } from '@src/modules/Users';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

/**
 * The REST runtime wired against the real OAS and AsyncAPI specs.
 *
 * The suites beside this one cover the dead-letter lifecycle and the
 * module-resolution helper in isolation. This one builds the API the way the
 * composition root does — real spec directory, real Users composition, real
 * infra handler factories — and asserts what the runtime publishes: versioned
 * endpoints, docs routes, seed behaviour, and the guard errors that tell an
 * operator which service the composition is missing.
 */

type FakeServer = {
  endPointRegister: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};

const buildServices = () => {
  const passwordCryptoService = PasswordCryptoService.compile();
  const keyValueStorageClient = InMemoryKeyValueStorageClient.compile();
  const mutexService = MutexService.compile(keyValueStorageClient);
  const jwtService = JwtService.compile();
  const { authService } = composeUsersAuthServices({
    databaseClient: InMemoryDbClient,
    passwordCryptoService,
    mutexService,
    jwtService
  });
  return {
    passwordCryptoService,
    keyValueStorageClient,
    mutexService,
    authService
  };
};

const buildApi = (overrides: Record<string, any> = {}) => {
  const registered: any[] = [];
  const server: FakeServer = {
    endPointRegister: jest.fn((endpoint: any) => { registered.push(endpoint); }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined)
  };
  const api = new RestAPI<any>({
    databaseClient: InMemoryDbClient,
    webServer: server as any,
    serverType: EHTTPFrameworks.express,
    infraHandlers,
    ...buildServices(),
    ...overrides
  });
  return { api, server, registered };
};

describe('restAPI endpoint wiring against the real specs', () => {
  it('registers versioned module, infra and documentation endpoints', () => {
    expect.hasAssertions();

    const { registered } = buildApi();

    expect(registered.length).toBeGreaterThan(0);
    const paths = registered.map((endpoint) => endpoint.path);

    // Module endpoints from the OAS, with path params converted for the
    // framework and the version prefix applied.
    expect(paths).toContain('/api/1.0.0/auth/login');
    expect(paths).toContain('/api/1.0.0/users/:id');
    expect(paths).toContain('/api/1.0.0/organizations/:id');

    // Infra and docs endpoints.
    expect(paths).toContain('/');
    expect(paths).toContain('/async-context-metrics');
    expect(paths).toContain('/docs/1.0.0');
    expect(paths).toContain('/docs/asyncapi/versions');
    expect(paths).toContain('/docs/asyncapi/1.0.0');
  });

  it('serves async context metrics and the asyncapi version index', () => {
    expect.hasAssertions();

    const { registered } = buildApi();
    const responseFor = () => {
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      return res;
    };

    const metrics = registered.find((endpoint) => endpoint.path === '/async-context-metrics');
    const metricsRes = responseFor();
    metrics.handler({}, metricsRes);
    expect(metricsRes.status).toHaveBeenCalledWith(200);
    expect(metricsRes.json).toHaveBeenCalledWith(expect.objectContaining({
      enteredTotal: expect.any(Number),
      active: expect.any(Number)
    }));

    const versions = registered.find((endpoint) => endpoint.path === '/docs/asyncapi/versions');
    const versionsRes = responseFor();
    versions.handler({}, versionsRes);
    expect(versionsRes.status).toHaveBeenCalledWith(200);
    expect(versionsRes.json).toHaveBeenCalledWith({
      versions: { '1.0.0': '/docs/asyncapi/1.0.0' }
    });
  });

  it('falls back to the express handler when the configured framework lacks one', () => {
    expect.hasAssertions();

    // Every operation in the spec has an express handler; none has a
    // derby-js one, so each registration walks the candidate list.
    const { registered } = buildApi({ serverType: EHTTPFrameworks.derby_js });

    expect(registered.length).toBeGreaterThan(0);
    expect(registered.map((endpoint) => endpoint.path)).toContain('/api/1.0.0/auth/login');
  });

  it('resolves handlers directly and fails loudly when none exists', () => {
    expect.hasAssertions();

    const { api } = buildApi();

    const handler = (api as any).getHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      endPointConfig: { operationId: 'login' }
    });
    expect(handler.method).toBe('post');
    expect(handler.path).toBe('/auth/login');

    expect(() => (api as any).getHandlerFactory({
      moduleName: 'Users',
      operationId: 'no-such-operation',
      endPointConfig: { operationId: 'no-such-operation' }
    })).toThrow(
      'Handler not found for module Users, operation no-such-operation, framework express.'
    );
  });

  it('fails loudly when a controller module loads without the named export', () => {
    expect.hasAssertions();

    // The controllers barrel loads fine but holds no controller under its own
    // name — a refactor that renames the export reads exactly like this.
    expect(() => (RestAPI as any).getControllerModule('Users', 'index'))
      .toThrow('Controller index not found for module Users.');
  });
});

describe('restAPI lifecycle with the real composition', () => {
  it('starts the dead-letter worker with the server and stops it on stop', async () => {
    expect.hasAssertions();

    const { api, server } = buildApi();

    await api.start();
    expect((api as any).started).toBe(true);

    const worker = (api as any).usersComposition.deadLetterWorker;
    expect(worker.running).toBe(true);

    // A second start must not double-connect or start a second timer.
    await api.start();
    expect(server.start).toHaveBeenCalledTimes(1);

    await api.stop();
    expect(worker.running).toBe(false);
  });

  it('seeds organizations and users idempotently, then deletes every user', async () => {
    expect.hasAssertions();

    const { api } = buildApi();

    const organizations = await api.seedOrganizations();
    expect(organizations.length).toBeGreaterThan(0);

    // A second pass finds each organization already present and returns the
    // stored records instead of creating duplicates.
    const again = await api.seedOrganizations();
    expect(again.map((org: any) => org.id).sort())
      .toStrictEqual(organizations.map((org: any) => org.id).sort());

    await api.seedData();
    const reseeded = await api.seedUsers();
    expect(reseeded.length).toBeGreaterThan(0);

    const deleted = await api.deleteUsers();
    expect(deleted).toHaveLength(reseeded.length);
    expect(deleted.every(Boolean)).toBe(true);
  });
});

describe('restAPI seed failure propagation', () => {
  it('propagates organization create failures from the composition', async () => {
    expect.hasAssertions();

    const { api } = buildApi();
    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: null }),
        create: async () => ({ error: new Error('organization create failed') })
      }
    };
    await expect(api.seedOrganizations()).rejects.toThrow('organization create failed');

    // A create that answers neither result nor error is a failed seed, not a
    // silent skip.
    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: null }),
        create: async () => ({})
      }
    };
    await expect(api.seedOrganizations()).rejects.toThrow('Organization seed failed');
  });

  it('propagates user create failures from the composition', async () => {
    expect.hasAssertions();

    const { api } = buildApi();
    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: { id: 'org-1' } }),
        create: async () => ({ result: { id: 'org-1' } })
      },
      userUseCases: {
        getOneById: async () => ({ result: null }),
        create: async () => ({ error: new Error('user create failed') })
      }
    };
    await expect(api.seedUsers()).rejects.toThrow('user create failed');

    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: { id: 'org-1' } }),
        create: async () => ({ result: { id: 'org-1' } })
      },
      userUseCases: {
        getOneById: async () => ({ result: null }),
        create: async () => ({})
      }
    };
    await expect(api.seedUsers()).rejects.toThrow('User seed failed');
  });

  it('answers an empty batch when no users exist to delete', async () => {
    expect.hasAssertions();

    // A list response without a payload is "nothing to delete", not a crash.
    const { api } = buildApi();
    (api as any).usersComposition = {
      userUseCases: {
        getAll: async () => ({})
      }
    };

    await expect(api.deleteUsers()).resolves.toStrictEqual([]);
  });

  it('rejects the batch when any user delete reports a failure', async () => {
    expect.hasAssertions();

    const { api } = buildApi();
    (api as any).usersComposition = {
      userUseCases: {
        getAll: async () => ({ result: [{ id: 'user-1' }, { id: 'user-2' }] }),
        delete: async () => ({ error: new Error('delete refused') })
      }
    };
    await expect(api.deleteUsers()).rejects.toThrow('delete refused');

    (api as any).usersComposition = {
      userUseCases: {
        getAll: async () => ({ result: [{ id: 'user-1' }] }),
        delete: async () => ({})
      }
    };
    await expect(api.deleteUsers()).rejects.toThrow('User delete failed');
  });
});
