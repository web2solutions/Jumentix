export type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
export { Catalog } from '@service-management-api/modules/Catalogs/domain/Model/Catalog';
export { CatalogDataRepository } from '@service-management-api/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
export { CatalogService } from '@service-management-api/modules/Catalogs/service/CatalogService';
export { composeCatalogsServices } from '@service-management-api/modules/Catalogs/composition/composeCatalogsServices';
export { CatalogUseCases } from '@service-management-api/modules/Catalogs/application/use-cases/CatalogUseCases';

export { CatalogController } from '@service-management-api/modules/Catalogs/adapters/in/http/controllers/CatalogController';
export { CatalogController as CatalogHttpController } from '@service-management-api/modules/Catalogs/adapters/in/http/controllers/CatalogController';

export { CatalogIntegrationEventName } from '@service-management-api/modules/Catalogs/events/contracts/CatalogIntegrationEventName';
export { CatalogCreateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogCreateRequestEvent';
export { CatalogUpdateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogUpdateRequestEvent';
export { CatalogDeleteRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogDeleteRequestEvent';
export { CatalogRestoreRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogRestoreRequestEvent';
export { CatalogGetAllRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogGetAllRequestEvent';
export { CatalogGetOneRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogGetOneRequestEvent';

export {
  decideCatalogAccess,
  resolveCatalogCollectionScope,
  resolveCatalogCreationOrganization
} from '@service-management-api/modules/Catalogs/domain/security/CatalogAuthorizationPolicy';

// dtos
export type { RequestCreateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestCreateCatalog';
export type { RequestUpdateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestUpdateCatalog';
export type { RequestCatalogListOptions } from '@service-management-api/modules/Catalogs/interface/dto/RequestCatalogListOptions';

export type { ICatalogUseCases } from '@service-management-api/modules/Catalogs/application/ports/ICatalogUseCases';
export type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export { createCatalog } from '@service-management-api/modules/Catalogs/features/createCatalog';
export { updateCatalog } from '@service-management-api/modules/Catalogs/features/updateCatalog';
export { deleteCatalogById } from '@service-management-api/modules/Catalogs/features/deleteCatalogById';
export { restoreCatalog } from '@service-management-api/modules/Catalogs/features/restoreCatalog';
export { getCatalogById } from '@service-management-api/modules/Catalogs/features/getCatalogById';
export { getAllCatalogs } from '@service-management-api/modules/Catalogs/features/getAllCatalogs';
