import type { IDatabaseClient as IGenericDatabaseClient, IStore } from '@jumentix/persistence-contracts';
import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import type { IOrganization } from '@src/modules/Users/domain/Entity/IOrganization';
import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';

export interface IDbStores {
    User: IStore<IUser>;
    Organization: IStore<IOrganization>;
    Catalog: IStore<ICatalog>;
    [key: string]: IStore<any>;
}

export interface IDatabaseClient extends IGenericDatabaseClient<IDbStores> {}
