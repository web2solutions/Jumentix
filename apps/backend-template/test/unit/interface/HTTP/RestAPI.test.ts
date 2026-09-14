/* eslint-disable @typescript-eslint/no-explicit-any, jest/max-expects */

import { DataBaseNotFoundError } from '@src/infra/exceptions';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { InMemoryKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/InMemoryKeyValueStorageClient';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { JwtService } from '@src/infra/jwt/JwtService';
import { composeUsersAuthServices } from '@src/modules/Users';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

import seedOrganizations_ from '@seed/organizations';
import seedUsers_, { seedUserIds } from '@seed/users';
import { entityIdLedger } from '@src/infra/persistence/InMemoryDatabase/idReservationLedger';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';
import { TOMBSTONE_PURGE_TTL_DAYS } from '@jumentix/persistence-contracts';

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

const missingRecordDb = () => ({
  stores: {
    Organization: {
      getOneById: jest.fn().mockRejectedValue(new DataBaseNotFoundError('Record not found'))
    },
    User: {
      getOneById: jest.fn().mockRejectedValue(new DataBaseNotFoundError('Record not found'))
    }
  },
  connect: jest.fn(),
  disconnect: jest.fn()
}) as any;

const noTombstoneDb = () => ({
  stores: {
    Organization: { getOneById: jest.fn().mockResolvedValue(undefined) },
    User: { getOneById: jest.fn().mockResolvedValue(undefined) }
  },
  connect: jest.fn(),
  disconnect: jest.fn()
}) as any;

/**
 * A store double with soft-delete semantics, wired to a use-case double that
 * reads the same record — the tombstone contract without a shared singleton.
 */
const softDeleteDb = (
  storeName: 'Organization' | 'User',
  records: Array<Record<string, any>>
) => {
  const state = { records: new Map(records.map((record) => [record.id, record])) };
  const store = {
    getOneById: jest.fn(async (id: string, options?: { includeDeleted?: boolean }) => {
      const record = state.records.get(id);
      if (!record || (record.deletedAt && !options?.includeDeleted)) {
        throw new DataBaseNotFoundError('Record not found');
      }
      return record;
    }),
    update: jest.fn(async (id: string, value: Record<string, any>) => {
      const merged = { ...state.records.get(id), ...value };
      state.records.set(id, merged);
      return merged;
    })
  };
  const useCases = {
    getOneById: jest.fn(async (id: string) => {
      try {
        return { result: await store.getOneById(id) };
      } catch {
        return { error: new DataBaseNotFoundError('Record not found') };
      }
    }),
    create: jest.fn()
  };
  const databaseClient: any = {
    stores: { [storeName]: store },
    connect: jest.fn(),
    disconnect: jest.fn()
  };
  return {
    databaseClient, store, useCases, state
  };
};

describe('restAPI seed tombstone restore (JUM-787)', () => {
  it('restores a soft-deleted organization instead of failing on the reserved id', async () => {
    expect.hasAssertions();

    const tombstoned = seedOrganizations_.map((org: any) => ({
      ...org,
      deletedAt: '2026-01-01T00:00:00.000Z'
    }));
    const {
      databaseClient, store, useCases, state
    } = softDeleteDb('Organization', tombstoned);
    const { api } = buildApi({ databaseClient });
    (api as any).usersComposition = { organizationUseCases: useCases };

    // Soft-deleted: the use case cannot see them, but a fresh create would
    // clash on the reserved ids. The seed restores the tombstones in place.
    const seeded = await api.seedOrganizations();

    expect(seeded.map((org: any) => org.id).sort())
      .toStrictEqual(seedOrganizations_.map((org: any) => org.id).sort());
    for (const record of state.records.values()) {
      expect(record.deletedAt).toBeNull();
    }
    expect(store.update).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ deletedAt: null })
    );
    expect(useCases.create).not.toHaveBeenCalled();
  });

  it('restores a soft-deleted user instead of failing on the reserved id', async () => {
    expect.hasAssertions();

    const tombstoned = seedUsers_.map((user: any) => ({
      ...user,
      deletedAt: '2026-01-01T00:00:00.000Z'
    }));
    const {
      databaseClient, store, useCases, state
    } = softDeleteDb('User', tombstoned);
    const { api } = buildApi({ databaseClient });
    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: { id: 'org-1' } }),
        create: async () => ({ result: { id: 'org-1' } })
      },
      userUseCases: useCases
    };

    const seeded = await api.seedUsers();

    expect(seeded.map((user: any) => user.id).sort())
      .toStrictEqual(seedUsers_.map((user: any) => user.id).sort());
    for (const record of state.records.values()) {
      expect(record.deletedAt).toBeNull();
    }
    expect(store.update).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ deletedAt: null })
    );
    expect(useCases.create).not.toHaveBeenCalled();
  });
});

describe('restAPI seed failure propagation', () => {
  it('propagates organization create failures when the record is truly missing', async () => {
    expect.hasAssertions();

    // The seed path asks the store about a tombstone before creating; a store
    // that answers "not found" (throwing, the InMemory contract) is what lets
    // the create run at all.
    const { api } = buildApi({ databaseClient: missingRecordDb() });
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

  it('keeps the seed id reserved when the store holds a record the use case cannot see', async () => {
    expect.hasAssertions();

    // JUM-787: with soft delete, an id the use case cannot see may still sit
    // in the store as a tombstone. The seed restores it (deletedAt: null)
    // instead of creating a duplicate — and if it stays invisible it is
    // skipped, silently, rather than double-created.
    const organizationStore = {
      getOneById: jest.fn().mockResolvedValue({ id: 'org-1', deletedAt: '2026-01-01' }),
      update: jest.fn().mockResolvedValue({ id: 'org-1', deletedAt: null })
    };
    const databaseClient: any = {
      stores: { Organization: organizationStore },
      connect: jest.fn(),
      disconnect: jest.fn()
    };
    const create = jest.fn().mockResolvedValue({ result: { id: 'org-1' } });
    const { api } = buildApi({ databaseClient });
    (api as any).usersComposition = {
      organizationUseCases: {
        getOneById: async () => ({ result: null }),
        create
      }
    };

    const seeded = await api.seedOrganizations();

    expect(seeded).toStrictEqual([]);
    expect(create).not.toHaveBeenCalled();
    expect(organizationStore.update).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ deletedAt: null })
    );
  });

  it('propagates user create failures when the record is truly missing', async () => {
    expect.hasAssertions();

    // A store that answers "no tombstone" without throwing (other drivers do)
    // takes the same create path as one that throws not-found.
    const { api } = buildApi({ databaseClient: noTombstoneDb() });
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

/**
 * JUM-804: the loopback-only purge endpoint and the purgeTombstones facade.
 * Private store instances keep the singleton InMemoryDbClient — and the seed
 * ledger — untouched by what these tests purge.
 */
const purgeDb = () => {
  const userStore = new InMemoryRelationalStore<any>({ softDelete: true });
  const organizationStore = new InMemoryRelationalStore<any>({ softDelete: true });
  const databaseClient: any = {
    stores: { User: userStore, Organization: organizationStore },
    connect: jest.fn(),
    disconnect: jest.fn()
  };
  return { databaseClient, userStore, organizationStore };
};

describe('restAPI tombstone purge endpoint (JUM-804)', () => {
  const responseFor = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

  it('rejects non-loopback callers and dry-runs for loopback ones', async () => {
    expect.hasAssertions();

    const { databaseClient, userStore } = purgeDb();
    await userStore.create('purge-u1', { id: 'purge-u1', username: 'purge-u1' });
    await userStore.delete('purge-u1');
    const { registered } = buildApi({ databaseClient });
    const endpoint = registered.find((e: any) => e.path === '/internal/tombstones/purge');

    const remote = responseFor();
    await endpoint.handler({ ip: '10.0.0.1', body: { commit: true } }, remote);
    expect(remote.status).toHaveBeenCalledWith(403);
    expect(remote.json).toHaveBeenCalledWith({ error: 'Purge is loopback-only.' });

    const noAddress = responseFor();
    await endpoint.handler({}, noAddress);
    expect(noAddress.status).toHaveBeenCalledWith(403);

    // A fresh tombstone is younger than the default TTL: reported, not purged.
    const viaSocket = responseFor();
    await endpoint.handler({ socket: { remoteAddress: '::1' } }, viaSocket);
    expect(viaSocket.status).toHaveBeenCalledWith(200);
    expect(viaSocket.json).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: true,
      events: [],
      skippedTooYoung: 1
    }));

    const ipv4 = responseFor();
    await endpoint.handler({ ip: '127.0.0.1', body: {} }, ipv4);
    expect(ipv4.status).toHaveBeenCalledWith(200);
    await expect(userStore.getOneById('purge-u1', { includeDeleted: true }))
      .resolves.toMatchObject({ id: 'purge-u1' });
  });

  it('commits the purge for a loopback caller and drops the rows', async () => {
    expect.hasAssertions();

    const { databaseClient, userStore, organizationStore } = purgeDb();
    await userStore.create('purge-u2', { id: 'purge-u2', username: 'purge-u2' });
    await organizationStore.create('purge-o2', { id: 'purge-o2', name: 'purge-o2' });
    await userStore.delete('purge-u2');
    await organizationStore.delete('purge-o2');
    const { registered } = buildApi({ databaseClient });
    const endpoint = registered.find((e: any) => e.path === '/internal/tombstones/purge');

    const res = responseFor();
    await endpoint.handler(
      { ip: '::ffff:127.0.0.1', body: { commit: true, olderThanDays: -1, protectSeed: false } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const report = res.json.mock.calls[0][0];
    expect(report.dryRun).toBe(false);
    expect(report.events.map((event: any) => `${event.entity}:${event.id}`).sort())
      .toStrictEqual(['Organization:purge-o2', 'User:purge-u2']);
    await expect(userStore.getOneById('purge-u2', { includeDeleted: true }))
      .rejects.toThrow('Record not found');
    expect(entityIdLedger.has('User', 'purge-u2')).toBe(true);
    expect(entityIdLedger.has('Organization', 'purge-o2')).toBe(true);
  });

  it('defaults options, protects seed ids, and honors protectSeed false', async () => {
    expect.hasAssertions();

    const { databaseClient, userStore } = purgeDb();
    const { api } = buildApi({ databaseClient });
    await userStore.create('purge-u3', { id: 'purge-u3', username: 'purge-u3' });
    await userStore.delete('purge-u3');

    const dryDefault = await api.purgeTombstones();
    expect(dryDefault.dryRun).toBe(true);
    expect(dryDefault.olderThanDays).toBe(TOMBSTONE_PURGE_TTL_DAYS);
    expect(dryDefault.events).toStrictEqual([]);
    expect(dryDefault.skippedTooYoung).toBe(1);

    const committed = await api.purgeTombstones({ olderThanDays: 0, commit: true });
    expect(committed.events.map((event) => event.id)).toStrictEqual(['purge-u3']);
    expect(entityIdLedger.has('User', 'purge-u3')).toBe(true);

    await userStore.create(seedUserIds[0], { id: seedUserIds[0], username: 'purge-seed-user' });
    await userStore.delete(seedUserIds[0]);

    const protectedReport = await api.purgeTombstones({ olderThanDays: -1 });
    expect(protectedReport.skippedProtected).toBe(1);
    expect(protectedReport.events).toStrictEqual([]);

    const unprotected = await api.purgeTombstones({ olderThanDays: -1, protectSeed: false });
    expect(unprotected.skippedProtected).toBe(0);
    expect(unprotected.events.map((event) => event.id)).toStrictEqual([seedUserIds[0]]);
  });
});
