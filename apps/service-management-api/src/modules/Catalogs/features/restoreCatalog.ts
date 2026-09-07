import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export const restoreCatalog = async (
  id: string,
  expectedVersion: number,
  catalogRepository: ICatalogRepository,
  actor: string = ''
): Promise<ICatalog> => {
  const model = await catalogRepository.restore(id, expectedVersion, actor);
  return model.serialize();
};
