import {
  createClient, deleteDatabase, isCanaError, type CanaClient
} from '@jumentix/cana';

import {
  DATABASE_NAME, META_STORE, SCHEMA_META_ID, buildCanaSchema, buildCanaStores, schemaFingerprint
} from '@/data/canaSchema';

export type CanaBootStatus = 'ok' | 'unavailable';

let client: CanaClient | null = null;
let bootStatus: CanaBootStatus | null = null;
let currentName = DATABASE_NAME;

export const isCanaOpen = (): boolean => client !== null;

export const canaBootStatus = (): CanaBootStatus | null => bootStatus;

export const getCanaClient = (): CanaClient => {
  if (!client) {
    throw new Error('Cana is not open.');
  }
  return client;
};

const openFresh = async (name: string): Promise<CanaClient> => {
  const schema = buildCanaSchema();
  const next = createClient({ name, schema, fallback: false });
  await next.open();
  const fingerprint = schemaFingerprint(schema.stores);
  const meta = next.table(META_STORE);
  const recorded = await meta.get(SCHEMA_META_ID) as { fingerprint?: string } | undefined;
  if (recorded && recorded.fingerprint !== fingerprint) {
    await next.close();
    await deleteDatabase(name);
    const reopened = createClient({ name, schema, fallback: false });
    await reopened.open();
    await reopened.table(META_STORE).put({
      id: SCHEMA_META_ID, fingerprint, version: schema.version
    });
    return reopened;
  }
  if (!recorded) {
    await meta.put({ id: SCHEMA_META_ID, fingerprint, version: schema.version });
  }
  return next;
};

export const openCana = async (name: string = DATABASE_NAME): Promise<CanaClient> => {
  if (client && currentName === name) return client;
  if (client) {
    await client.close();
    client = null;
  }
  currentName = name;
  try {
    client = await openFresh(name);
    bootStatus = 'ok';
    return client;
  } catch (error) {
    if (isCanaError(error) && (error.code === 'UpgradeFailed' || error.code === 'UpgradeBlocked')) {
      await deleteDatabase(name);
      client = await openFresh(name);
      bootStatus = 'ok';
      return client;
    }
    if (isCanaError(error) && error.code === 'Unavailable') {
      bootStatus = 'unavailable';
      client = null;
      throw error;
    }
    bootStatus = 'unavailable';
    client = null;
    throw error;
  }
};

export const closeCana = async (): Promise<void> => {
  if (!client) return;
  await client.close();
  client = null;
};

export const wipeCanaDatabase = async (): Promise<void> => {
  const name = currentName;
  await closeCana();
  await deleteDatabase(name);
  await openCana(name);
};

/**
 * Boot path: open IndexedDB before the SPA mounts. Returns `unavailable` when
 * the origin has no IndexedDB (no localStorage fallback — the seed is
 * offline-first, not degraded-memory).
 */
export const bootCana = async (): Promise<CanaBootStatus> => {
  try {
    await openCana(DATABASE_NAME);
    return 'ok';
  } catch {
    bootStatus = 'unavailable';
    return 'unavailable';
  }
};

export const exposeCanaTestHooks = (): void => {
  if (typeof window === 'undefined') return;
  const hook = window as Window & {
    __jumentixWipeCana?: () => Promise<void>;
    __jumentixObjectStores?: () => string[];
  };
  hook.__jumentixWipeCana = wipeCanaDatabase;
  hook.__jumentixObjectStores = () => buildCanaStores().map((store) => store.name);
};
