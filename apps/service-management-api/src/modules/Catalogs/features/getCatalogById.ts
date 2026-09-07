import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export const getCatalogById = async (
  id: string,
  catalogRepository: ICatalogRepository
): Promise<ICatalog> => {
  const model = await catalogRepository.getOneById(id);
  return model.serialize();
};
