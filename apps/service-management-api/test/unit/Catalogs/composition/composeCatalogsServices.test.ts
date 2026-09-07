/* eslint-disable jest/max-expects */
import { composeCatalogsServices } from '@service-management-api/modules/Catalogs/composition/composeCatalogsServices';
import { CatalogDataRepository } from '@service-management-api/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import { CatalogService } from '@service-management-api/modules/Catalogs/service/CatalogService';
import { CatalogUseCases } from '@service-management-api/modules/Catalogs/application/use-cases/CatalogUseCases';

describe('compose catalogs services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('wires repository, service and use cases with the mediator as integration bus', () => {
    expect.hasAssertions();
    const dataRepository = {} as any;
    const catalogService = {} as any;
    const catalogUseCases = {} as any;

    const repoSpy = jest.spyOn(CatalogDataRepository, 'compile').mockReturnValue(dataRepository);
    const serviceSpy = jest.spyOn(CatalogService, 'compile').mockReturnValue(catalogService);
    const useCasesSpy = jest.spyOn(CatalogUseCases, 'compile').mockReturnValue(catalogUseCases);

    const databaseClient = { stores: {} } as any;
    const messageMediator = { publish: jest.fn(), request: jest.fn() } as any;

    const composition = composeCatalogsServices({ databaseClient, messageMediator });

    expect(repoSpy).toHaveBeenCalledWith({ databaseClient });
    expect(serviceSpy).toHaveBeenCalledWith({
      dataRepository,
      services: { eventBus: messageMediator }
    });
    expect(useCasesSpy).toHaveBeenCalledWith(catalogService);
    expect(composition.dataRepository).toBe(dataRepository);
    expect(composition.catalogService).toBe(catalogService);
    expect(composition.catalogUseCases).toBe(catalogUseCases);
  });

  it('falls back to the plain event bus when no mediator is configured', () => {
    expect.hasAssertions();
    const serviceSpy = jest.spyOn(CatalogService, 'compile').mockReturnValue({} as any);
    const databaseClient = { stores: {} } as any;
    const eventBus = { publish: jest.fn() } as any;

    composeCatalogsServices({ databaseClient, eventBus });

    expect(serviceSpy).toHaveBeenCalledWith({
      dataRepository: expect.anything(),
      services: { eventBus }
    });
  });
});
