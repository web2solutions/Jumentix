import type { IIdReservationLedger } from './idReservationLedger';

export const TOMBSTONE_PURGE_TTL_DAYS = 90;
export const MS_PER_DAY = 86_400_000;

export const SEED_PURGED_ID_MESSAGE = (entity: string, id: string): string => (
  `Seed id ${id} (${entity}) was purged; cannot recreate. Restart dev or exclude seed ids from purge (--protect-seed).`
);

export function assertSeedIdNotPurged(
  ledger: IIdReservationLedger,
  entity: string,
  id: string
): void {
  if (ledger.has(entity, id)) {
    throw new Error(SEED_PURGED_ID_MESSAGE(entity, id));
  }
}

/**
 * Contract: `deletedAt` is an ISO-8601 string or a Date. A numeric epoch is
 * not an accepted representation — `Date.parse(String(epoch))` is NaN, so a
 * numeric `deletedAt` is treated as "not a tombstone" and never purged. That
 * is intentional: silently repairing an unknown representation is how one bad
 * record becomes two; a driver writing epochs must convert at the boundary.
 */
export function parseInstant(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const time = Date.parse(String(value));
    if (!Number.isNaN(time)) return time;
  }
  return null;
}

export function isTombstone(record: { deletedAt?: unknown }): boolean {
  const { deletedAt } = record;
  if (deletedAt == null || deletedAt === '') return false;
  return parseInstant(deletedAt) != null;
}

export interface IPurgeRecord {
  id: string;
  deletedAt?: unknown;
}

export interface IPurgeStore {
  entity: string;
  listTombstones(): Promise<IPurgeRecord[]>;
  hardDelete(id: string): Promise<boolean>;
}

export interface IPurgeTombstonesInput {
  stores: IPurgeStore[];
  ledger: IIdReservationLedger;
  now?: Date;
  olderThanDays?: number;
  commit?: boolean;
  excludeIds?: string[];
}

export interface IPurgeEvent {
  entity: string;
  id: string;
  deletedAt: string;
  purgedAt: string;
  dryRun: boolean;
}

export interface IPurgeReport {
  dryRun: boolean;
  olderThanDays: number;
  events: IPurgeEvent[];
  skippedProtected: number;
  skippedTooYoung: number;
}

const asDeletedAt = (value: unknown): string => (
  value instanceof Date ? value.toISOString() : String(value)
);

const collectEligible = (
  store: IPurgeStore,
  rows: IPurgeRecord[],
  cutoff: number,
  exclude: Set<string>,
  commit: boolean,
  purgedAt: string
): { events: IPurgeEvent[]; skippedProtected: number; skippedTooYoung: number } => {
  let skippedProtected = 0;
  let skippedTooYoung = 0;
  const events: IPurgeEvent[] = [];
  rows.forEach((row) => {
    if (!isTombstone(row)) return;
    if (exclude.has(row.id)) {
      skippedProtected += 1;
      return;
    }
    const deletedMs = parseInstant(row.deletedAt);
    if (deletedMs == null || deletedMs > cutoff) {
      skippedTooYoung += 1;
      return;
    }
    events.push({
      entity: store.entity,
      id: row.id,
      deletedAt: asDeletedAt(row.deletedAt),
      purgedAt,
      dryRun: !commit
    });
  });
  return { events, skippedProtected, skippedTooYoung };
};

export async function purgeTombstones(input: IPurgeTombstonesInput): Promise<IPurgeReport> {
  const olderThanDays = input.olderThanDays ?? TOMBSTONE_PURGE_TTL_DAYS;
  const now = input.now ?? new Date();
  const cutoff = now.getTime() - olderThanDays * MS_PER_DAY;
  const commit = input.commit === true;
  const exclude = new Set(input.excludeIds ?? []);
  const purgedAt = now.toISOString();

  const scanned = await Promise.all(input.stores.map(async (store) => {
    const rows = await store.listTombstones();
    return { store, ...collectEligible(store, rows, cutoff, exclude, commit, purgedAt) };
  }));

  const events = scanned.flatMap((item) => item.events);
  const skippedProtected = scanned.reduce((sum, item) => sum + item.skippedProtected, 0);
  const skippedTooYoung = scanned.reduce((sum, item) => sum + item.skippedTooYoung, 0);

  if (commit) {
    await Promise.all(events.map(async (event) => {
      const store = input.stores.find((item) => item.entity === event.entity);
      if (!store) return;
      const removed = await store.hardDelete(event.id);
      if (removed) {
        input.ledger.reserve({
          entity: event.entity,
          id: event.id,
          purgedAt
        });
      }
    }));
  }

  return {
    dryRun: !commit,
    olderThanDays,
    events,
    skippedProtected,
    skippedTooYoung
  };
}
