import CatalogDataRepository from '@service-management-api/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import CatalogUseCases from '@service-management-api/modules/Catalogs/application/use-cases/CatalogUseCases';
import CatalogService from '@service-management-api/modules/Catalogs/service/CatalogService';

import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IEventBus, IMessageMediator } from '@src/modules/port';

import type { ICatalogUseCases } from '@service-management-api/modules/Catalogs/application/ports/ICatalogUseCases';

interface ICatalogsCompositionConfig {
  databaseClient: IDatabaseClient;
  eventBus?: IEventBus;
  messageMediator?: IMessageMediator;
}

interface ICatalogsComposition {
  dataRepository: CatalogDataRepository;
  catalogService: CatalogService;
  catalogUseCases: ICatalogUseCases;
}

const composeCatalogsServices = (config: ICatalogsCompositionConfig): ICatalogsComposition => {
  const { databaseClient, eventBus, messageMediator } = config;
  const integrationBus = messageMediator ?? eventBus;

  const dataRepository = CatalogDataRepository.compile({
    databaseClient
  });
  const catalogService = CatalogService.compile({
    dataRepository,
    services: {
      eventBus: integrationBus
    }
  });
  const catalogUseCases = CatalogUseCases.compile(catalogService);

  return {
    dataRepository,
    catalogService,
    catalogUseCases
  };
};

export default composeCatalogsServices;
