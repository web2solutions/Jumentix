import type { IDatabaseClient, IDbStores } from '@src/infra/persistence/port/IDatabaseClient';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';
import { CatalogStoreAPI } from '@service-management-api/infra/persistence/InMemoryDatabase/Stores/CatalogStoreAPI';

export const createServiceManagementCatalogDbClient = (
  baseDatabaseClient?: IDatabaseClient
): IDatabaseClient => {
  const sourceDatabaseClient = baseDatabaseClient || InMemoryDbClient;
  const stores: IDbStores = {
    ...sourceDatabaseClient.stores,
    Catalog: CatalogStoreAPI
  };
  const connect = async () => {
    await sourceDatabaseClient.connect?.();
  };
  const disconnect = async () => {
    await sourceDatabaseClient.disconnect?.();
  };
  return { stores, connect, disconnect } as IDatabaseClient;
};

export const InMemoryCatalogDbClient = createServiceManagementCatalogDbClient();
