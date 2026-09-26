import entityIdLedger from '@src/infra/persistence/InMemoryDatabase/idReservationLedger';
import InMemoryRelationalStore from '@src/infra/persistence/InMemoryDatabase/Stores/InMemoryRelationalStore';

import type { IStore } from '@src/infra/ports/persistence/IStore';
import type { IOrganization } from '@src/modules/Users/domain/Entity/IOrganization';

const OrganizationStoreAPI: IStore<IOrganization> = new InMemoryRelationalStore<IOrganization>({
  uniqueIndexes: ['name'],
  caseInsensitiveUniqueIndexes: ['name'],
  softDelete: true,
  entity: 'Organization',
  ledger: entityIdLedger
});

export default OrganizationStoreAPI;
