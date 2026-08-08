import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestCreateCatalog } from '@src/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';

export const createCatalog = async (
  payload: RequestCreateCatalog & { createdBy?: string },
  catalogRepository: ICatalogRepository
): Promise<ICatalog> => {
  const model = await catalogRepository.create(payload);
  return model.serialize();
};
