export interface IPagingRequest {
  currentPage?: number;
  perPage?: number;
  page?: number;
  size?: number;
  /** Ordered sort fields (JUM-777); see `parseListSort` for the wire form. */
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Free-text search term applied over `searchFields` (JUM-777). */
  q?: string;
  /** Fields `q` is matched against; declared by the operation's `x-list-capabilities`. */
  searchFields?: string[];
  /** When true, list/get include tombstones (`deletedAt` set). Default false. */
  includeDeleted?: boolean;
}

export interface IPagingResponse<T> {
  currentPage?: number;
  perPage?: number;
  previousPage?: number | null;
  nextPage?: number | null;
  total: number;
  data?: T;
  result?: T;
  page?: number;
  size?: number;
}

export type TStorePrimitive = string | number | boolean | Date | null;

/**
 * A value a store can hold, including a nested document.
 *
 * `operator?: never` is what makes `TFilterOperator` mean anything (JUM-599).
 * Without it this arm was a bare `Record<string, unknown>`, so every object
 * satisfied it — including a filter expression with an invented operator. The
 * union then matched on the scalar arm, the operator list was never consulted,
 * and `{ operator: 'approximately' }` compiled. A typo reached the adapter at
 * runtime instead of failing here.
 *
 * Excluding the key rather than the value keeps the two arms disjoint: an
 * object carrying `operator` can only be an `IStoreFilterExpression`, which is
 * where the operator is checked against the declared list.
 *
 * A stored document that genuinely needs a field called `operator` has to be
 * wrapped in an explicit filter expression rather than passed bare. That is a
 * deliberate cost: the alternative is the type saying fifteen operators and
 * meaning any string.
 */
export type TStoreScalar =
  | TStorePrimitive
  | (Record<string, unknown> & { operator?: never });

export type TFilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'like'
  | 'ilike'
  | 'regex'
  | 'exists'
  | 'contains'
  | 'overlaps'
  | 'between';

export interface IStoreFilterExpression {
  operator: TFilterOperator;
  value?: TStoreScalar | TStoreScalar[];
}

export type TStoreFilterValue =
  | TStoreScalar
  | TStoreScalar[]
  | IStoreFilterExpression
  | Array<IStoreFilterExpression>;

export type TStoreFilters<T> = Partial<Record<Extract<keyof T, string>, TStoreFilterValue>>;

export interface IStoreLogicalFilters<T> {
  and?: Array<TStoreFilters<T>>;
  or?: Array<TStoreFilters<T>>;
  not?: Array<TStoreFilters<T>>;
}

export interface IStoreSortField<T> {
  field: Extract<keyof T, string>;
  direction?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface IStoreRelationInclude {
  relation: string;
  fields?: string[];
  required?: boolean;
}

export interface IStoreQuery<T> {
  filters?: TStoreFilters<T>;
  logical?: IStoreLogicalFilters<T>;
  fields?: Array<Extract<keyof T, string>>;
  sort?: Array<IStoreSortField<T>>;
  include?: IStoreRelationInclude[];
  paging?: IPagingRequest;
  cursor?: string;
  limit?: number;
}

export interface IStoreMutationOptions {
  upsert?: boolean;
  returning?: boolean;
  conflictKeys?: string[];
  expectedVersion?: number | string;
  transactionId?: string;
}

export interface IStoreDeleteOptions {
  hardDelete?: boolean;
  transactionId?: string;
}

export interface IStoreBulkWriteItem<T> {
  action: 'create' | 'update' | 'delete' | 'upsert';
  id?: string;
  data?: Partial<T>;
  options?: IStoreMutationOptions | IStoreDeleteOptions;
}

export interface IStoreBulkWriteResult<T> {
  inserted: T[];
  updated: T[];
  deleted: string[];
  errors: Error[];
}

export interface IStoreTransaction {
  id: string;
  provider?: string;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IStoreIndexDefinition<T> {
  name: string;
  fields: Array<Extract<keyof T, string>>;
  unique?: boolean;
  sparse?: boolean;
  caseInsensitive?: boolean;
}

export type TStoreAggregationStage = Record<string, unknown>;

export interface IStore<T> {
  delete(id: string): Promise<boolean>;
  getOneById(id: string, options?: { includeDeleted?: boolean }): Promise<T>;
  getByName?(name: string): Promise<T>;
  getByRelation?(field: keyof T, referenceId: string): Promise<T[]>;
  create(key: string, value: T): Promise<T>;
  update(key: string, value: T): Promise<T>;
  getAll(
    filters: Record<string, string | number>,
    paging: IPagingRequest
  ): Promise<IPagingResponse<T[]>>;
  find?(query: IStoreQuery<T>): Promise<IPagingResponse<T[]>>;
  findOne?(query: IStoreQuery<T>): Promise<T | null>;
  count?(query?: IStoreQuery<T>): Promise<number>;
  exists?(query: IStoreQuery<T>): Promise<boolean>;
  createOne?(data: T, options?: IStoreMutationOptions): Promise<T>;
  createMany?(data: T[], options?: IStoreMutationOptions): Promise<T[]>;
  updateOne?(id: string, data: Partial<T>, options?: IStoreMutationOptions): Promise<T>;
  updateMany?(
    query: IStoreQuery<T>,
    data: Partial<T>,
    options?: IStoreMutationOptions
  ): Promise<number>;
  deleteOne?(id: string, options?: IStoreDeleteOptions): Promise<boolean>;
  deleteMany?(query: IStoreQuery<T>, options?: IStoreDeleteOptions): Promise<number>;
  upsertOne?(query: IStoreQuery<T>, data: Partial<T>, options?: IStoreMutationOptions): Promise<T>;
  aggregate?<TResult = unknown>(
    pipeline: TStoreAggregationStage[],
    query?: IStoreQuery<T>
  ): Promise<TResult[]>;
  bulkWrite?(items: IStoreBulkWriteItem<T>[]): Promise<IStoreBulkWriteResult<T>>;
  beginTransaction?(): Promise<IStoreTransaction>;
  ensureIndexes?(indexes: Array<IStoreIndexDefinition<T>>): Promise<void>;
}
