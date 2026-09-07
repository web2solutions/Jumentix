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
