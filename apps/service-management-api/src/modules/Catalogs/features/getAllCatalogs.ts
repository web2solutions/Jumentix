import type { IPagingRequest, IPagingResponse } from '@src/modules/port';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { Catalog } from '@service-management-api/modules/Catalogs/domain/Model/Catalog';
import type { RequestCatalogListOptions } from '@service-management-api/modules/Catalogs/interface/dto/RequestCatalogListOptions';
import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export const getAllCatalogs = async (
  filters: Record<string, string|number>,
  paging: IPagingRequest,
  catalogRepository: ICatalogRepository,
  options: RequestCatalogListOptions = {}
): Promise<IPagingResponse<ICatalog[]>> => {
  const response = await catalogRepository.getAll({ ...filters }, paging, options);
  const rawDocs: ICatalog[] = (response.result ?? []).map(
    (model: Catalog) => model.serialize()
  );
  return {
    ...response,
    result: rawDocs
  };
};
