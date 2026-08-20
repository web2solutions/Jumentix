import type { DeadLetterRecord, IDeadLetterStore } from './contracts';

/** The subset of the shared key-value client this store needs. */
export interface IKeyValueClient {
  get(keyName: string): Promise<{ result?: unknown; error?: unknown }>;
  set(keyName: string, value: unknown): Promise<{ result?: unknown; error?: unknown }>;
  del(keyName: string): Promise<{ result?: unknown; error?: unknown }>;
}

export interface IKeyValueDeadLetterStoreOptions {
  prefix?: string;
}

/**
 * Redis-backed store, through the same client the mutex uses.
 *
 * That client exposes `get`, `set` and `del` and nothing else — no `SCAN`, no
 * `KEYS` — so this keeps an explicit index of record ids under one key. The
 * index is the reason `put` writes twice: dropping it in favour of a key-space
 * scan would be faster to write and would not work against this client.
 *
 * The index is append-only for new ids; a record is never removed, only moved
 * to a terminal status, so the index never needs a delete.
 */
export class KeyValueDeadLetterStore implements IDeadLetterStore {
  private readonly client: IKeyValueClient;

  private readonly prefix: string;

  public constructor(client: IKeyValueClient, { prefix = 'dlq' }: IKeyValueDeadLetterStoreOptions = {}) {
    if (!client) throw new Error('KeyValueDeadLetterStore depends on a key-value client');
    this.client = client;
    this.prefix = prefix;
  }

  private recordKey(id: string): string {
    return `${this.prefix}:record:${id}`;
  }

  private get indexKey(): string {
    return `${this.prefix}:index`;
  }

  /**
   * Values come back as whatever the client stored them as.
   *
   * The Redis client returns strings; the in-memory one used in some suites
   * returns the object. Parsing only when it is a string keeps both working
   * without a second store implementation.
   */
  private static parse<T>(value: unknown): T | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value !== 'string') return value as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  private async readIndex(): Promise<string[]> {
    const { result, error } = await this.client.get(this.indexKey);
    if (error) throw error;
    const parsed = KeyValueDeadLetterStore.parse<string[]>(result);
    return Array.isArray(parsed) ? parsed : [];
  }

  public async put(record: DeadLetterRecord): Promise<void> {
    const { error } = await this.client.set(this.recordKey(record.id), JSON.stringify(record));
    if (error) throw error;

    const index = await this.readIndex();
    if (index.includes(record.id)) return;
    const appended = await this.client.set(this.indexKey, JSON.stringify([...index, record.id]));
    if (appended.error) throw appended.error;
  }

  public async get(id: string): Promise<DeadLetterRecord | undefined> {
    const { result, error } = await this.client.get(this.recordKey(id));
    if (error) throw error;
    return KeyValueDeadLetterStore.parse<DeadLetterRecord>(result);
  }

  public async list(): Promise<DeadLetterRecord[]> {
    const index = await this.readIndex();
    const records: DeadLetterRecord[] = [];
    /* eslint-disable no-await-in-loop --
     * The index defines replay order. Resolving these reads concurrently would
     * return them in completion order, which is the ordering bug the index
     * exists to prevent. */
    for (const id of index) {
      const record = await this.get(id);
      if (record) records.push(record);
    }
    /* eslint-enable no-await-in-loop */
    return records;
  }
}
