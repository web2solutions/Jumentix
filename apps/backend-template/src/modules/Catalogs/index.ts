export type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
export { Catalog } from '@src/modules/Catalogs/domain/Model/Catalog';
export { CatalogDataRepository } from '@src/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
export { CatalogService } from '@src/modules/Catalogs/service/CatalogService';
export { composeCatalogsServices } from '@src/modules/Catalogs/composition/composeCatalogsServices';
export { CatalogUseCases } from '@src/modules/Catalogs/application/use-cases/CatalogUseCases';

export { CatalogController } from '@src/modules/Catalogs/adapters/in/http/controllers/CatalogController';
export { CatalogController as CatalogHttpController } from '@src/modules/Catalogs/adapters/in/http/controllers/CatalogController';

export { CatalogIntegrationEventName } from '@src/modules/Catalogs/events/contracts/CatalogIntegrationEventName';
export { CatalogCreateRequestEvent } from '@src/modules/Catalogs/events/CatalogCreateRequestEvent';
export { CatalogUpdateRequestEvent } from '@src/modules/Catalogs/events/CatalogUpdateRequestEvent';
export { CatalogDeleteRequestEvent } from '@src/modules/Catalogs/events/CatalogDeleteRequestEvent';
export { CatalogRestoreRequestEvent } from '@src/modules/Catalogs/events/CatalogRestoreRequestEvent';
export { CatalogGetAllRequestEvent } from '@src/modules/Catalogs/events/CatalogGetAllRequestEvent';
export { CatalogGetOneRequestEvent } from '@src/modules/Catalogs/events/CatalogGetOneRequestEvent';

export {
  decideCatalogAccess,
  resolveCatalogCollectionScope,
  resolveCatalogCreationOrganization
} from '@src/modules/Catalogs/domain/security/CatalogAuthorizationPolicy';

// dtos
export type { RequestCreateCatalog } from '@src/modules/Catalogs/interface/dto/RequestCreateCatalog';
export type { RequestUpdateCatalog } from '@src/modules/Catalogs/interface/dto/RequestUpdateCatalog';
export type { RequestCatalogListOptions } from '@src/modules/Catalogs/interface/dto/RequestCatalogListOptions';

export type { ICatalogUseCases } from '@src/modules/Catalogs/application/ports/ICatalogUseCases';
export type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';

export { createCatalog } from '@src/modules/Catalogs/features/createCatalog';
export { updateCatalog } from '@src/modules/Catalogs/features/updateCatalog';
export { deleteCatalogById } from '@src/modules/Catalogs/features/deleteCatalogById';
export { restoreCatalog } from '@src/modules/Catalogs/features/restoreCatalog';
export { getCatalogById } from '@src/modules/Catalogs/features/getCatalogById';
export { getAllCatalogs } from '@src/modules/Catalogs/features/getAllCatalogs';
