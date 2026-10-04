import {
  composeCatalogsServices,
  createServiceManagementCatalogDbClient,
  InMemoryCatalogDbClient,
  ServiceManagementCatalogAPI
} from '@service-management-api/index';

describe('service-management-api package exports', () => {
  it('exposes the catalog API host, the db client factory and the Catalogs module', () => {
    expect.hasAssertions();
    expect(typeof ServiceManagementCatalogAPI).toBe('function');
    expect(typeof createServiceManagementCatalogDbClient).toBe('function');
    expect(typeof InMemoryCatalogDbClient).toBe('object');
    expect(typeof composeCatalogsServices).toBe('function');
  });
});
