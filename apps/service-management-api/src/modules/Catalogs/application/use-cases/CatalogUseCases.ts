import type { IPagingRequest } from '@src/modules/port/IPagingRequest';
import type { IServiceResponse } from '@src/modules/port/IServiceResponse';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestCatalogListOptions } from '@service-management-api/modules/Catalogs/interface/dto/RequestCatalogListOptions';
import type { ICatalogUseCases } from '@service-management-api/modules/Catalogs/application/ports/ICatalogUseCases';
import type { CatalogService } from '@service-management-api/modules/Catalogs/service/CatalogService';

export class CatalogUseCases implements ICatalogUseCases {
  private readonly catalogService: CatalogService;

  constructor(catalogService: CatalogService) {
    this.catalogService = catalogService;
  }

  public async create(
    data: Parameters<CatalogService['create']>[0],
    actor?: string
  ): Promise<IServiceResponse<ICatalog>> {
    return this.catalogService.create(data, actor);
  }

  public async update(
    id: string,
    data: Parameters<CatalogService['update']>[1],
    actor?: string
  ): Promise<IServiceResponse<ICatalog>> {
    return this.catalogService.update(id, data, actor);
  }

  public async delete(
    id: string,
    expectedVersion: number,
    actor?: string
  ): Promise<IServiceResponse<boolean>> {
    return this.catalogService.delete(id, expectedVersion, actor);
  }

  public async restore(
    id: string,
    expectedVersion: number,
    actor?: string
  ): Promise<IServiceResponse<ICatalog>> {
    return this.catalogService.restore(id, expectedVersion, actor);
  }

  public async getOneById(id: string): Promise<IServiceResponse<ICatalog>> {
    return this.catalogService.getOneById(id);
  }

  public async getAll(
    filters: Record<string, string|number>,
    paging: IPagingRequest,
    options?: RequestCatalogListOptions
  ): Promise<IServiceResponse<ICatalog[]>> {
    return this.catalogService.getAll(filters, paging, options);
  }

  public static compile(catalogService: CatalogService): ICatalogUseCases {
    return new CatalogUseCases(catalogService);
  }
}
