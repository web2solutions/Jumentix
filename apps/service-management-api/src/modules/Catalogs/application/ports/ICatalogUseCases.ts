import type { IPagingRequest } from '@src/modules/port/IPagingRequest';
import type { IServiceResponse } from '@src/modules/port/IServiceResponse';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestCreateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { RequestUpdateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { RequestCatalogListOptions } from '@service-management-api/modules/Catalogs/interface/dto/RequestCatalogListOptions';

export interface ICatalogUseCases {
  create(
    data: RequestCreateCatalog,
    actor?: string
  ): Promise<IServiceResponse<ICatalog>>;
  update(
    id: string,
    data: RequestUpdateCatalog,
    actor?: string
  ): Promise<IServiceResponse<ICatalog>>;
  delete(
    id: string,
    expectedVersion: number,
    actor?: string
  ): Promise<IServiceResponse<boolean>>;
  restore(
    id: string,
    expectedVersion: number,
    actor?: string
  ): Promise<IServiceResponse<ICatalog>>;
  getOneById(id: string): Promise<IServiceResponse<ICatalog>>;
  getAll(
    filters: Record<string, string|number>,
    paging: IPagingRequest,
    options?: RequestCatalogListOptions
  ): Promise<IServiceResponse<ICatalog[]>>;
}
