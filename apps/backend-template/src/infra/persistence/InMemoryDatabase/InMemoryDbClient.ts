// import { Account } from '@src/domains/Accounts';
import type { IDatabaseClient, IDbStores } from '../port/IDatabaseClient';
import { UserStoreAPI } from './Stores/UserStoreAPI';
import { OrganizationStoreAPI } from './Stores/OrganizationStoreAPI';
import { CatalogStoreAPI } from './Stores/CatalogStoreAPI';

type ClearableStore = { clear?: () => void };

export const InMemoryDbClient: IDatabaseClient = ((): IDatabaseClient => {
  const stores: IDbStores = {
    User: UserStoreAPI,
    Organization: OrganizationStoreAPI,
    Catalog: CatalogStoreAPI
  };
  const connect = () => Promise.resolve();
  const disconnect = () => {
    Object.values(stores).forEach((store) => {
      (store as ClearableStore).clear?.();
    });
    return Promise.resolve();
  };
  return { stores, connect, disconnect };
})();

// mongoose and sequelize
