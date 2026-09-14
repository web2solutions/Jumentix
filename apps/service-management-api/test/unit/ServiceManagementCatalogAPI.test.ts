/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServiceManagementCatalogAPI } from '@service-management-api/ServiceManagementCatalogAPI';
import { createServiceManagementCatalogDbClient } from '@service-management-api/infra/persistence/InMemoryDatabase/InMemoryCatalogDbClient';

describe('serviceManagementCatalogAPI ownership host', () => {
  const authService = {
    authenticate: jest.fn(),
    authorize: jest.fn(),
    throwIfUserHasNoAccessToResource: jest.fn()
  } as any;

  it('registers the catalog routes from the platform-owned spec', () => {
    expect.hasAssertions();
    const registered: Array<{ method: string; path: string }> = [];
    const webServer = {
      endPointRegister: (handler: { method: string; path: string }) => {
        registered.push({ method: handler.method, path: handler.path });
      },
      start: jest.fn(),
      stop: jest.fn()
    } as any;

    const catalogAPI = new ServiceManagementCatalogAPI({
      databaseClient: createServiceManagementCatalogDbClient(),
      webServer,
      authService
    });

    expect(catalogAPI).toBeInstanceOf(ServiceManagementCatalogAPI);
    expect(registered).toStrictEqual([
      { method: 'get', path: '/api/1.0.0/catalogs' },
      { method: 'post', path: '/api/1.0.0/catalogs' },
      { method: 'get', path: '/api/1.0.0/catalogs/:id' },
      { method: 'put', path: '/api/1.0.0/catalogs/:id' },
      { method: 'delete', path: '/api/1.0.0/catalogs/:id' },
      { method: 'post', path: '/api/1.0.0/catalogs/:id/restore' }
    ]);
  });

  it('adds a Catalog store explicitly instead of relying on backend-template', () => {
    expect.hasAssertions();
    const databaseClient = createServiceManagementCatalogDbClient({
      stores: {
        User: {} as any,
        Organization: {} as any
      },
      connect: jest.fn(),
      disconnect: jest.fn()
    } as any);

    expect(databaseClient.stores.Catalog).toBeDefined();
    expect(databaseClient.stores.User).toBeDefined();
    expect(databaseClient.stores.Organization).toBeDefined();
  });
});

describe('serviceManagementCatalogAPI lifecycle and spec edge shapes (JUM-821)', () => {
  const authService = {
    authenticate: jest.fn(),
    authorize: jest.fn(),
    throwIfUserHasNoAccessToResource: jest.fn()
  } as any;

  const makeWebServer = (events: string[]) => ({
    endPointRegister: () => undefined,
    start: async () => { events.push('server:start'); },
    stop: async () => { events.push('server:stop'); }
  } as any);

  it('starts once, in dependency order, and stops in reverse', async () => {
    expect.hasAssertions();

    const events: string[] = [];
    const databaseClient = createServiceManagementCatalogDbClient({
      stores: {},
      connect: async () => { events.push('db:connect'); },
      disconnect: async () => { events.push('db:disconnect'); }
    } as any);
    const catalogAPI = new ServiceManagementCatalogAPI({
      databaseClient,
      webServer: makeWebServer(events),
      authService
    });

    await catalogAPI.start();
    // A second start is a no-op, not a reconnect: two `start` calls must not
    // open two connection lifecycles over the same server.
    await catalogAPI.start();

    expect(events).toStrictEqual(['db:connect', 'server:start']);

    await catalogAPI.stop();
    expect(events).toStrictEqual(['db:connect', 'server:start', 'server:stop', 'db:disconnect']);

    // After a stop the API can start again — a restart is a real lifecycle,
    // not a stuck flag.
    await catalogAPI.start();
    expect(events).toStrictEqual([
      'db:connect', 'server:start', 'server:stop', 'db:disconnect', 'db:connect', 'server:start'
    ]);
    await catalogAPI.stop();
  });

  it('connects and disconnects through the default in-memory client wiring', async () => {
    expect.hasAssertions();

    const events: string[] = [];
    const databaseClient = createServiceManagementCatalogDbClient({
      stores: { User: {} },
      connect: async () => { events.push('base:connect'); },
      disconnect: async () => { events.push('base:disconnect'); }
    } as any);

    await databaseClient.connect();
    await databaseClient.disconnect();

    expect(events).toStrictEqual(['base:connect', 'base:disconnect']);
    expect(databaseClient.stores.Catalog).toBeDefined();
    expect(databaseClient.stores.User).toBeDefined();
  });

  it('tolerates a base client without connect/disconnect hooks', async () => {
    expect.hasAssertions();

    // The wrapper's optional chaining exists for base clients that have no
    // lifecycle at all — a plain store bag must still compose.
    const databaseClient = createServiceManagementCatalogDbClient({ stores: {} } as any);

    await expect(databaseClient.connect()).resolves.toBeUndefined();
    await expect(databaseClient.disconnect()).resolves.toBeUndefined();
    expect(databaseClient.stores.Catalog).toBeDefined();
  });

  it('reads spec fixtures: .yaml files, specs without paths, and null path entries', () => {
    expect.hasAssertions();

    // The spec directory is a contract surface, not a guaranteed-clean one:
    // a `.yaml` spelling, a spec with no `paths` block, a path entry that is
    // null, and a non-spec file all have to load without taking the boot down.
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-spec-'));
    fs.writeFileSync(path.join(specDir, 'catalog.yaml'), [
      'openapi: 3.0.0',
      'info:',
      '  title: Catalog',
      '  version: 9.9.9',
      ''
    ].join('\n'));
    fs.writeFileSync(path.join(specDir, 'empty-path.yml'), [
      'openapi: 3.0.0',
      'info:',
      '  title: Empty',
      '  version: 9.9.8',
      'paths:',
      '  /nothing: null',
      ''
    ].join('\n'));
    fs.writeFileSync(path.join(specDir, 'notes.txt'), 'not a spec');
    fs.writeFileSync(path.join(specDir, 'not-openapi.yml'), 'hello: world\n');

    const registered: string[] = [];
    const events: string[] = [];
    const catalogAPI = new ServiceManagementCatalogAPI({
      databaseClient: createServiceManagementCatalogDbClient(),
      webServer: {
        endPointRegister: (handler: { path: string }) => { registered.push(handler.path); },
        start: async () => { events.push('server:start'); },
        stop: async () => { events.push('server:stop'); }
      } as any,
      authService,
      specDir
    });

    expect(catalogAPI).toBeInstanceOf(ServiceManagementCatalogAPI);
    // Neither fixture spec declares an operation, so nothing registers — and
    // nothing threw.
    expect(registered).toStrictEqual([]);
  });

  it('fails the boot when the spec names an operation with no handler', () => {
    expect.hasAssertions();

    // A spec/route drift that booted silently would serve 404s where the OAS
    // promises an endpoint; the factory throws instead of registering a gap.
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-spec-'));
    fs.writeFileSync(path.join(specDir, 'rogue.yml'), [
      'openapi: 3.0.0',
      'info:',
      '  title: Rogue',
      '  version: 9.9.7',
      'paths:',
      '  /rogue:',
      '    get:',
      '      operationId: rogueOperation',
      ''
    ].join('\n'));

    expect(() => new ServiceManagementCatalogAPI({
      databaseClient: createServiceManagementCatalogDbClient(),
      webServer: makeWebServer([]),
      authService,
      specDir
    })).toThrow('catalog handler not found for rogueOperation');
  });
});
