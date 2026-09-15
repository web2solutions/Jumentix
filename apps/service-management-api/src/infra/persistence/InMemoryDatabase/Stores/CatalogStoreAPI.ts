import type { IStore } from '@src/infra/ports/persistence/IStore';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';

export const CatalogStoreAPI: IStore<ICatalog> = new InMemoryRelationalStore<ICatalog>({
  relationIndexes: ['organization']
});
