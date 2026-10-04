import type {
  IDatabaseClient as IGenericDatabaseClient,
  IStore
} from '@jumentix/persistence-contracts';

import type { IOrganization } from '@src/modules/Users/domain/Entity/IOrganization';
import type { IUser } from '@src/modules/Users/domain/Entity/IUser';

export interface IDbStores {
  User: IStore<IUser>;
  Organization: IStore<IOrganization>;
  [key: string]: IStore<any>;
}

export interface IDatabaseClient extends IGenericDatabaseClient<IDbStores> {}
