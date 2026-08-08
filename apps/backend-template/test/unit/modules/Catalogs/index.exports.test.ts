/* eslint-disable jest/max-expects */
import * as CatalogsModule from '@src/modules/Catalogs';

describe('catalogs module exports', () => {
  it('exposes all runtime exports through the barrel file', () => {
    expect.hasAssertions();
    const keys = Object.keys(CatalogsModule);
    expect(keys.length).toBeGreaterThan(15);

    for (const key of keys) {
      expect((CatalogsModule as any)[key]).toBeDefined();
    }
  });

  it('exposes the composition root, the controller and the event contract', () => {
    expect.hasAssertions();
    expect(typeof CatalogsModule.composeCatalogsServices).toBe('function');
    expect(typeof CatalogsModule.CatalogController).toBe('function');
    expect(typeof CatalogsModule.CatalogUseCases).toBe('function');
    expect(CatalogsModule.CatalogIntegrationEventName).toStrictEqual({
      Created: 'catalogs.catalog.created',
      Updated: 'catalogs.catalog.updated',
      Deleted: 'catalogs.catalog.deleted',
      Restored: 'catalogs.catalog.restored'
    });
    expect(typeof CatalogsModule.decideCatalogAccess).toBe('function');
    expect(typeof CatalogsModule.resolveCatalogCollectionScope).toBe('function');
    expect(typeof CatalogsModule.resolveCatalogCreationOrganization).toBe('function');
  });
});
