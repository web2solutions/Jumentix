import * as ServiceManagementApiModule from '@service-management-api/index';

describe('service-management-api package exports', () => {
  it('exposes the catalog API host, the db client factory and the Catalogs module', () => {
    expect.hasAssertions();
    expect(typeof ServiceManagementApiModule.ServiceManagementCatalogAPI).toBe('function');
    expect(typeof ServiceManagementApiModule.createServiceManagementCatalogDbClient).toBe('function');
    expect(ServiceManagementApiModule.InMemoryCatalogDbClient).toBeDefined();
    expect(typeof ServiceManagementApiModule.composeCatalogsServices).toBe('function');
  });
});
