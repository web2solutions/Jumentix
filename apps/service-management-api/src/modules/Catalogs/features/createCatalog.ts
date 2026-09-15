import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestCreateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export const createCatalog = async (
  payload: RequestCreateCatalog & { createdBy?: string },
  catalogRepository: ICatalogRepository
): Promise<ICatalog> => {
  const model = await catalogRepository.create(payload);
  return model.serialize();
};
