import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestUpdateCatalog } from '@src/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';

export const updateCatalog = async (
  id: string,
  payload: RequestUpdateCatalog,
  catalogRepository: ICatalogRepository,
  actor: string = ''
): Promise<ICatalog> => {
  const model = await catalogRepository.update(id, payload, actor);
  return model.serialize();
};
