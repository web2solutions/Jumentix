import type { IStore } from '@src/infra/ports/persistence/IStore';
import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import { InMemoryRelationalStore } from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';
import { entityIdLedger } from '@src/infra/persistence/InMemoryDatabase/idReservationLedger';

export const UserStoreAPI: IStore<IUser> = new InMemoryRelationalStore<IUser>({
  uniqueIndexes: ['username'],
  caseInsensitiveUniqueIndexes: ['username'],
  relationIndexes: ['organization'],
  softDelete: true,
  entity: 'User',
  ledger: entityIdLedger
});
