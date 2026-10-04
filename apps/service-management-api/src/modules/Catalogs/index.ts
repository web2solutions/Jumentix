export type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
export { default as Catalog } from '@service-management-api/modules/Catalogs/domain/Model/Catalog';
export { default as CatalogDataRepository } from '@service-management-api/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
export { default as CatalogService } from '@service-management-api/modules/Catalogs/service/CatalogService';
export { default as composeCatalogsServices } from '@service-management-api/modules/Catalogs/composition/composeCatalogsServices';
export { default as CatalogUseCases } from '@service-management-api/modules/Catalogs/application/use-cases/CatalogUseCases';

export { default as CatalogController } from '@service-management-api/modules/Catalogs/adapters/in/http/controllers/CatalogController';
export { default as CatalogHttpController } from '@service-management-api/modules/Catalogs/adapters/in/http/controllers/CatalogController';

export { CatalogIntegrationEventName } from '@service-management-api/modules/Catalogs/events/contracts/CatalogIntegrationEventName';
export { default as CatalogCreateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogCreateRequestEvent';
export { default as CatalogUpdateRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogUpdateRequestEvent';
export { default as CatalogDeleteRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogDeleteRequestEvent';
export { default as CatalogRestoreRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogRestoreRequestEvent';
export { default as CatalogGetAllRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogGetAllRequestEvent';
export { default as CatalogGetOneRequestEvent } from '@service-management-api/modules/Catalogs/events/CatalogGetOneRequestEvent';

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

export { default as createCatalog } from '@service-management-api/modules/Catalogs/features/createCatalog';
export { default as updateCatalog } from '@service-management-api/modules/Catalogs/features/updateCatalog';
export { default as deleteCatalogById } from '@service-management-api/modules/Catalogs/features/deleteCatalogById';
export { default as restoreCatalog } from '@service-management-api/modules/Catalogs/features/restoreCatalog';
export { default as getCatalogById } from '@service-management-api/modules/Catalogs/features/getCatalogById';
export { default as getAllCatalogs } from '@service-management-api/modules/Catalogs/features/getAllCatalogs';
