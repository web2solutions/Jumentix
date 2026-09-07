import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

export const deleteCatalogById = async (
  id: string,
  expectedVersion: number,
  catalogRepository: ICatalogRepository,
  actor: string = ''
): Promise<boolean> => {
  return catalogRepository.delete(id, expectedVersion, actor);
};
