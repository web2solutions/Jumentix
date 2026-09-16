import {
  purgeTombstones,
  TOMBSTONE_PURGE_TTL_DAYS,
  type IIdReservationLedger,
  type IPurgeReport,
  type IPurgeStore,
  type IStore
} from '@jumentix/persistence-contracts';

export const adaptPurgeStore = (
  entity: string,
  store: IStore<Record<string, unknown> & { id: string; deletedAt?: unknown }>
): IPurgeStore => ({
  entity,
  async listTombstones() {
    const page = await store.getAll({}, { page: 1, size: 10_000, includeDeleted: true });
    return (page.result || []).filter((row) => row.deletedAt);
  },
  async hardDelete(id: string) {
    if (!store.hardDelete) {
      throw new Error(`Store ${entity} does not implement hardDelete`);
    }
    return store.hardDelete(id);
  }
});

export async function purgeUserAndOrganizationTombstones(input: {
  userStore: IStore<any>;
  organizationStore: IStore<any>;
  ledger: IIdReservationLedger;
  now?: Date;
  olderThanDays?: number;
  commit?: boolean;
  excludeIds?: string[];
}): Promise<IPurgeReport> {
  return purgeTombstones({
    stores: [
      adaptPurgeStore('Organization', input.organizationStore),
      adaptPurgeStore('User', input.userStore)
    ],
    ledger: input.ledger,
    now: input.now,
    olderThanDays: input.olderThanDays ?? TOMBSTONE_PURGE_TTL_DAYS,
    commit: input.commit === true,
    excludeIds: input.excludeIds
  });
}
