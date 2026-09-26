import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';

const deleteCatalogById = async (
  id: string,
  expectedVersion: number | undefined,
  catalogRepository: ICatalogRepository,
  actor = ''
): Promise<boolean> => catalogRepository.delete(id, expectedVersion, actor);

export default deleteCatalogById;
