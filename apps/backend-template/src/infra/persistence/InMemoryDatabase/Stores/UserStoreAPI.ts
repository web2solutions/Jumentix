import entityIdLedger from '@src/infra/persistence/InMemoryDatabase/idReservationLedger';
import InMemoryRelationalStore from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';

import type { IStore } from '@src/infra/ports/persistence/IStore';
import type { IUser } from '@src/modules/Users/domain/Entity/IUser';

const UserStoreAPI: IStore<IUser> = new InMemoryRelationalStore<IUser>({
  uniqueIndexes: ['username'],
  caseInsensitiveUniqueIndexes: ['username'],
  relationIndexes: ['organization'],
  softDelete: true,
  entity: 'User',
  ledger: entityIdLedger
});

export default UserStoreAPI;
