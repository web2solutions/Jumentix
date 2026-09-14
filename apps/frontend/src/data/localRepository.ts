import { parseListSort, runListQuery, type TListFilters } from '@jumentix/persistence-contracts';

import type { ListPage, ListQuery } from '@/contracts/listSchema';
import { fieldDescriptors } from '@/contracts/formSchema';
import {
  entityTable, entityTableByStore, type EntityTableSpec
} from '@/data/canaSchema';
import { getCanaClient, isCanaOpen } from '@/data/db';

const asRecords = <T extends Record<string, unknown>>(
  rows: readonly unknown[]
): T[] => rows as T[];

const indexedQuery = async <T extends Record<string, unknown>>(
  table: EntityTableSpec,
  query: ListQuery
): Promise<{ records: T[]; usedIndex?: string }> => {
  const store = getCanaClient().table(table.storeName);
  const sort = parseListSort(query.sort);
  const primary = sort?.[0];
  const canIndex = Boolean(
    primary && table.indexes.includes(primary.field) && !query.q && !query.filter
  );
  if (canIndex && primary) {
    const records = asRecords<T>(await store.query({
      index: primary.field,
      direction: primary.direction === 'desc' ? 'prev' : 'next'
    }));
    return { records, usedIndex: primary.field };
  }
  return { records: asRecords<T>(await store.query()) };
};

export const listLocal = async <T extends Record<string, unknown> = Record<string, unknown>>(
  schemaName: string,
  query: ListQuery & { searchFields?: string[] } = {}
): Promise<ListPage<T> & { usedIndex?: string }> => {
  const table = entityTable(schemaName);
  const { records, usedIndex } = await indexedQuery<T>(table, query);
  const page = query.page ?? 1;
  const size = query.size ?? 30;
  const result = runListQuery(records, query.filter as TListFilters | undefined, {
    page,
    size,
    sort: parseListSort(query.sort),
    q: query.q,
    searchFields: query.searchFields,
    includeDeleted: false
  });
  return {
    result: result.result ?? [],
    page: result.page ?? page,
    size: result.size ?? size,
    total: result.total,
    usedIndex
  };
};

export const getLocal = async <T extends Record<string, unknown> = Record<string, unknown>>(
  schemaName: string,
  key: string
): Promise<T | undefined> => {
  const table = entityTable(schemaName);
  const record = await getCanaClient().table(table.storeName).get(key);
  return record as T | undefined;
};

export const countLocal = async (schemaName: string): Promise<number> => {
  const page = await listLocal(schemaName, { page: 1, size: 1 });
  return page.total;
};

export const resolveRelations = async (
  schemaName: string,
  row: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const joined: Record<string, unknown> = { ...row };
  await Promise.all(fieldDescriptors(schemaName).map(async (descriptor) => {
    const { relation } = descriptor;
    if (!relation) return;
    const target = entityTable(relation.entity);
    const store = getCanaClient().table(target.storeName);
    if (relation.kind === 'belongsTo') {
      const key = row[relation.field];
      if (key == null || key === '') return;
      const related = await store.get(String(key));
      if (related) {
        joined[`${descriptor.name}Record`] = related;
        joined[`${descriptor.name}Label`] = (related as Record<string, unknown>)[relation.display]
          ?? key;
      }
      return;
    }
    const match = String(row[target.keyPath] ?? row.id ?? '');
    if (!match) return;
    try {
      const children = await store.query({ index: relation.field, equals: match });
      joined[descriptor.name] = children;
    } catch {
      joined[descriptor.name] = [];
    }
  }));
  return joined;
};

export const subscribeLocal = (
  schemaName: string,
  listener: () => void
): (() => void) => {
  if (!isCanaOpen()) return () => undefined;
  const table = entityTable(schemaName);
  const relatedStores = new Set<string>([table.storeName]);
  for (const descriptor of fieldDescriptors(schemaName)) {
    if (descriptor.relation) {
      relatedStores.add(entityTable(descriptor.relation.entity).storeName);
    }
  }
  return getCanaClient().subscribe((event) => {
    if (relatedStores.has(event.store)) listener();
  });
};

export const storeForChange = (storeName: string): EntityTableSpec | undefined => (
  entityTableByStore(storeName)
);
