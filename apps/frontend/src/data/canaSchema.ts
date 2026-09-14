import type { CanaSchema, CanaStoreSchema } from '@jumentix/cana';

import openApi from '@/contracts/openapi.json';
import {
  entityPrimaryKey, fieldDescriptors, listOperationForEntity
} from '@/contracts/formSchema';
import { listCapabilities } from '@/contracts/listSchema';

export const DATABASE_NAME = 'jumentix-frontend';
export const META_STORE = 'meta';
export const OUTBOX_STORE = 'outbox';
export const SCHEMA_META_ID = 'schema';
export const SESSION_META_ID = 'session';

export interface EntityTableSpec {
  schemaName: string;
  storeName: string;
  keyPath: string;
  indexes: string[];
  listOperationId: string;
}

interface OpenApiPaths {
  paths?: Record<string, Record<string, { operationId?: string }>>;
  info?: { title?: string };
}

const document = openApi as OpenApiPaths;

const storeNameFromListPath = (operationId: string, schemaName: string): string => {
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    for (const operation of Object.values(methods)) {
      if (operation?.operationId === operationId) {
        const segment = path.split('/').filter(Boolean).pop();
        if (segment) return segment;
      }
    }
  }
  return `${schemaName[0]?.toLowerCase() ?? ''}${schemaName.slice(1)}s`;
};

const relationFields = (schemaName: string): string[] => (
  fieldDescriptors(schemaName)
    .filter((descriptor) => descriptor.relation)
    .map((descriptor) => descriptor.relation!.field)
);

export const deriveEntityTables = (): EntityTableSpec[] => {
  const schemas = (openApi as {
    components?: { schemas?: Record<string, unknown> };
  }).components?.schemas ?? {};
  const tables: EntityTableSpec[] = [];
  for (const schemaName of Object.keys(schemas)) {
    const listOperationId = listOperationForEntity(schemaName);
    if (listOperationId) {
      const keyPath = entityPrimaryKey(schemaName);
      const capabilities = listCapabilities(listOperationId);
      // IndexedDB rejects array values on a non-multiEntry index (DataError).
      // OAS `roles` / `members` / `emails` are arrays even when x-list-capabilities
      // lists them as filterable enums — never promote those fields to indexes.
      const arrayFields = new Set(
        fieldDescriptors(schemaName)
          .filter((descriptor) => descriptor.type === 'array')
          .map((descriptor) => descriptor.name)
      );
      const indexSet = new Set<string>([
        ...(capabilities?.sortable ?? []),
        ...Object.keys(capabilities?.filterable ?? {}),
        'updatedAt',
        'deletedAt',
        ...relationFields(schemaName)
      ]);
      indexSet.delete(keyPath);
      for (const field of arrayFields) indexSet.delete(field);
      tables.push({
        schemaName,
        storeName: storeNameFromListPath(listOperationId, schemaName),
        keyPath,
        indexes: [...indexSet],
        listOperationId
      });
    }
  }
  return tables.sort((left, right) => left.storeName.localeCompare(right.storeName));
};

export const entityTable = (schemaName: string): EntityTableSpec => {
  const found = deriveEntityTables().find((table) => table.schemaName === schemaName);
  if (!found) {
    throw new Error(`No Cana table for OAS entity ${schemaName}`);
  }
  return found;
};

export const entityTableByStore = (storeName: string): EntityTableSpec | undefined => (
  deriveEntityTables().find((table) => table.storeName === storeName)
);

export const schemaFingerprint = (stores: readonly CanaStoreSchema[]): string => (
  JSON.stringify(stores)
);

/** Stable positive integer in `[1, 2^31-2]` from the derived store set. */
export const schemaVersionFromStores = (stores: readonly CanaStoreSchema[]): number => {
  const fingerprint = schemaFingerprint(stores);
  let hash = 2166136261;
  for (let index = 0; index < fingerprint.length; index += 1) {
    // FNV-1a — bitwise on purpose.
    // eslint-disable-next-line no-bitwise
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // eslint-disable-next-line no-bitwise
  return ((hash >>> 0) % 2147483646) + 1;
};

const toStore = (table: EntityTableSpec): CanaStoreSchema => ({
  name: table.storeName,
  keyPath: table.keyPath,
  indexes: table.indexes.map((name) => ({ name, keyPath: name }))
});

export const buildCanaStores = (): CanaStoreSchema[] => {
  const entities = deriveEntityTables().map(toStore);
  return [
    ...entities,
    { name: META_STORE, keyPath: 'id' },
    {
      name: OUTBOX_STORE,
      keyPath: 'opId',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'entity', keyPath: 'entity' }
      ]
    }
  ];
};

export const buildCanaSchema = (): CanaSchema => {
  const stores = buildCanaStores();
  return { version: schemaVersionFromStores(stores), stores };
};

export const appManifestName = (): string => document.info?.title ?? 'Jumentix Frontend';
