import type { CanaChangeEvent, CanaKey } from '@jumentix/cana';

export type CanaRecordKeyReader<TRecord> = (record: TRecord) => CanaKey | undefined;

export type CanaCollectionOptions<TRecord> = {
  store: string;
  getKey?: CanaRecordKeyReader<TRecord>;
  sort?: (a: TRecord, b: TRecord) => number;
};

function defaultGetKey<TRecord>(record: TRecord): CanaKey | undefined {
  if (record && typeof record === 'object' && 'id' in record) {
    return (record as { id?: CanaKey }).id;
  }
  return undefined;
}

function sameKey(a: CanaKey | undefined, b: CanaKey | undefined): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return Object.is(a, b);
}

function sorted<TRecord>(
  records: readonly TRecord[],
  sort: ((a: TRecord, b: TRecord) => number) | undefined
): TRecord[] {
  const next = [...records];
  if (sort) next.sort(sort);
  return next;
}

export function applyCanaEventToRecords<TRecord>(
  records: readonly TRecord[],
  event: CanaChangeEvent,
  options: CanaCollectionOptions<TRecord>
): TRecord[] {
  if (event.store !== options.store) return [...records];
  if (event.type === 'cleared') return [];

  const getKey = options.getKey ?? defaultGetKey;
  if (event.type === 'deleted') {
    return records.filter((record) => !sameKey(getKey(record), event.key));
  }

  if (!event.record) return [...records];

  const record = event.record as TRecord;
  const recordKey = getKey(record);
  const next = records.filter((item) => !sameKey(getKey(item), recordKey));
  next.push(record);
  return sorted(next, options.sort);
}
