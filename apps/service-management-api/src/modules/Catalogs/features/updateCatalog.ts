import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestUpdateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export const updateCatalog = async (
  id: string,
  payload: RequestUpdateCatalog,
  catalogRepository: ICatalogRepository,
  actor: string = ''
): Promise<ICatalog> => {
  const model = await catalogRepository.update(id, payload, actor);
  return model.serialize();
};
