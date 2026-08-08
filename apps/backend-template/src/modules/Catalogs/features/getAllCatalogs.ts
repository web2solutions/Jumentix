import type { IPagingRequest, IPagingResponse } from '@src/modules/port';
import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { Catalog } from '@src/modules/Catalogs/domain/Model/Catalog';
import type { RequestCatalogListOptions } from '@src/modules/Catalogs/interface/dto/RequestCatalogListOptions';
import type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';

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
