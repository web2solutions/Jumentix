// import { Account } from '@src/domains/Accounts';
import OrganizationStoreAPI from './Stores/OrganizationStoreAPI';
import UserStoreAPI from './Stores/UserStoreAPI';

import type { IDatabaseClient, IDbStores } from '../port/IDatabaseClient';

const InMemoryDbClient: IDatabaseClient = ((): IDatabaseClient => {
  const stores: IDbStores = {
    User: UserStoreAPI,
    Organization: OrganizationStoreAPI
  };
  const connect = () => Promise.resolve();
  const disconnect = () => Promise.resolve();
  return { stores, connect, disconnect };
})();

export default InMemoryDbClient;

// mongoose and sequelize
