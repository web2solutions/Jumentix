import type { IStore } from '@src/infra/ports/persistence/IStore';
import { ConflictError, DataBaseNotFoundError } from '@src/infra/exceptions';
import type { IPagingRequest, IPagingResponse } from '@src/modules/port';
import {
  runListQuery,
  type IIdReservationLedger
} from '@jumentix/persistence-contracts';

type Primitive = string | number | boolean | null | undefined;

interface IStoreOptions<T extends Record<string, any>> {
  uniqueIndexes?: (keyof T)[];
  caseInsensitiveUniqueIndexes?: (keyof T)[];
  relationIndexes?: (keyof T)[];
  /** Soft-delete + hide tombstones. Off for catalog (own tombstone + restore). */
  softDelete?: boolean;
  entity?: string;
  ledger?: IIdReservationLedger;
}

const stringifyPrimitive = (value: Primitive): string => String(value ?? '');

export class InMemoryRelationalStore<T extends Record<string, any>> implements IStore<T> {
  private readonly records = new Map<string, T>();

  private readonly uniqueIndexes: Record<string, Map<string, string>> = {};

  private readonly relationIndexes: Record<string, Map<string, Set<string>>> = {};

  private readonly options: IStoreOptions<T>;

  constructor(options: IStoreOptions<T> = {}) {
    this.options = options;
    const unique = options.uniqueIndexes || [];
    const ciUnique = options.caseInsensitiveUniqueIndexes || [];
    [...unique, ...ciUnique].forEach((field) => {
      this.uniqueIndexes[field.toString()] = new Map<string, string>();
    });
    (options.relationIndexes || []).forEach((field) => {
      this.relationIndexes[field.toString()] = new Map<string, Set<string>>();
    });
  }

  private normalizeUniqueValue(field: string, value: Primitive): string {
    const raw = stringifyPrimitive(value);
    const ci = this.options.caseInsensitiveUniqueIndexes || [];
    if (ci.includes(field as keyof T)) return raw.toLowerCase();
    return raw;
  }

  private ensureUniqueIndexes(id: string, value: T, previous?: T): void {
    Object.keys(this.uniqueIndexes).forEach((field) => {
      const index = this.uniqueIndexes[field];
      const normalized = this.normalizeUniqueValue(field, value[field]);
      const linkedId = index.get(normalized);
      if (linkedId && linkedId !== id) {
        throw new ConflictError(`${field} already in use`);
      }
      if (previous) {
        const previousNormalized = this.normalizeUniqueValue(field, previous[field]);
        if (previousNormalized !== normalized) {
          index.delete(previousNormalized);
        }
      }
      index.set(normalized, id);
    });
  }

  private syncRelationIndexes(id: string, value: T, previous?: T): void {
    Object.keys(this.relationIndexes).forEach((field) => {
      const index = this.relationIndexes[field];
      const previousRef = previous ? stringifyPrimitive(previous[field] as Primitive) : '';
      const nextRef = stringifyPrimitive(value[field] as Primitive);

      if (previous && previousRef !== '' && previousRef !== nextRef) {
        const set = index.get(previousRef);
        if (set) {
          set.delete(id);
          if (set.size === 0) index.delete(previousRef);
        }
      }

      if (nextRef !== '') {
        const existing = index.get(nextRef) || new Set<string>();
        existing.add(id);
        index.set(nextRef, existing);
      }
    });
  }

  public async delete(id: string): Promise<boolean> {
    const existing = this.records.get(id);
    if (!existing) return false;
    Object.keys(this.uniqueIndexes).forEach((field) => {
      const normalized = this.normalizeUniqueValue(field, existing[field]);
      this.uniqueIndexes[field].delete(normalized);
    });
    Object.keys(this.relationIndexes).forEach((field) => {
      const ref = stringifyPrimitive(existing[field] as Primitive);
      if (!ref) return;
      const set = this.relationIndexes[field].get(ref);
      if (!set) return;
      set.delete(id);
      if (set.size === 0) this.relationIndexes[field].delete(ref);
    });
    if (!this.options.softDelete) {
      this.records.delete(id);
      return true;
    }
    const tombstone = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date()
    } as T;
    this.records.set(id, tombstone);
    return true;
  }

  public async getOneById(id: string, options?: { includeDeleted?: boolean }): Promise<T> {
    const existing = this.records.get(id);
    if (!existing) {
      throw new DataBaseNotFoundError('Record not found');
    }
    if (this.options.softDelete && existing.deletedAt && !options?.includeDeleted) {
      throw new DataBaseNotFoundError('Record not found');
    }
    return existing;
  }

  public async hardDelete(id: string): Promise<boolean> {
    const existing = this.records.get(id);
    if (!existing) return false;
    Object.keys(this.uniqueIndexes).forEach((field) => {
      const normalized = this.normalizeUniqueValue(field, existing[field]);
      this.uniqueIndexes[field].delete(normalized);
    });
    Object.keys(this.relationIndexes).forEach((field) => {
      const ref = stringifyPrimitive(existing[field] as Primitive);
      if (!ref) return;
      const set = this.relationIndexes[field].get(ref);
      if (!set) return;
      set.delete(id);
      if (set.size === 0) this.relationIndexes[field].delete(ref);
    });
    this.records.delete(id);
    return true;
  }

  public async create(key: string, value: T): Promise<T> {
    const { entity, ledger } = this.options;
    if (entity && ledger?.has(entity, key)) {
      throw new ConflictError('The field "id" already exists.');
    }
    if (this.records.has(key)) {
      throw new ConflictError('The field "id" already exists.');
    }
    this.ensureUniqueIndexes(key, value);
    this.syncRelationIndexes(key, value);
    this.records.set(key, value);
    return value;
  }

  public async update(key: string, value: T): Promise<T> {
    const previous = this.records.get(key);
    if (!previous) {
      throw new DataBaseNotFoundError('Record not found');
    }
    const merged = { ...previous, ...value, updatedAt: new Date() } as T;
    this.ensureUniqueIndexes(key, merged, previous);
    this.syncRelationIndexes(key, merged, previous);
    this.records.set(key, merged);
    return merged;
  }

  /**
   * Filters, search, sort and paging share one implementation with the
   * external-store proxy (`runListQuery`, JUM-777), so every driver answers
   * the REST list contract the same way.
   */
  public async getAll(
    filters: Record<string, string | number>,
    paging: IPagingRequest
  ): Promise<IPagingResponse<T[]>> {
    // The contracts' response type marks `page`/`size` optional; `paginateList`
    // always sets them, so the application's stricter shape holds.
    const effectivePaging = this.options.softDelete
      ? paging
      : { ...paging, includeDeleted: true };
    return runListQuery(
      [...this.records.values()],
      filters,
      effectivePaging
    ) as IPagingResponse<T[]>;
  }

  public async getByRelation(field: keyof T, referenceId: string): Promise<T[]> {
    const index = this.relationIndexes[field.toString()];
    if (!index) return [];
    const linked = index.get(referenceId);
    if (!linked) return [];
    return [...linked]
      .map((id) => this.records.get(id))
      .filter((entry): entry is T => {
        if (!entry) return false;
        if (this.options.softDelete && entry.deletedAt) return false;
        return true;
      });
  }
}
