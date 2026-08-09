import type { IPagingRequest, IPagingResponse } from '@src/modules/port';
import type { Catalog } from '@src/modules/Catalogs/domain/Model/Catalog';
import type { RequestCreateCatalog } from '@src/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { RequestUpdateCatalog } from '@src/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { RequestCatalogListOptions } from '@src/modules/Catalogs/interface/dto/RequestCatalogListOptions';

export interface ICatalogRepository {
  create(data: RequestCreateCatalog & { createdBy?: string }): Promise<Catalog>;
  update(id: string, data: RequestUpdateCatalog, actor?: string): Promise<Catalog>;
  delete(id: string, expectedVersion?: number, actor?: string): Promise<boolean>;
  restore(id: string, expectedVersion: number, actor?: string): Promise<Catalog>;
  getOneById(id: string): Promise<Catalog>;
  getAll(
    filters: Record<string, string|number>,
    paging: IPagingRequest,
    options?: RequestCatalogListOptions
  ): Promise<IPagingResponse<Catalog[]>>;
}
