import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';

export const getCatalogById = async (
  id: string,
  catalogRepository: ICatalogRepository
): Promise<ICatalog> => {
  const model = await catalogRepository.getOneById(id);
  return model.serialize();
};
