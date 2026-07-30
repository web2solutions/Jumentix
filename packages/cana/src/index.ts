/**
 * Cana — offline-first IndexedDB database client for Jumentix.
 *
 * Public entry point. Only contracts and the durability surface are exported so
 * far; the engine lands behind these types without changing them.
 */

export type {
  CanaBulkWriteResult,
  CanaChangeEvent,
  CanaChangeType,
  CanaClient,
  CanaDirection,
  CanaError,
  CanaErrorCode,
  CanaIndexSchema,
  CanaKey,
  CanaKeyArray,
  CanaKeyPath,
  CanaQuery,
  CanaQueryPlan,
  CanaRange,
  CanaSchema,
  CanaStorageState,
  CanaStoreSchema,
  CanaTable,
  CanaTransactionMode,
  CanaTransactionScope,
  CanaWriteOutcome,
  CanaWriteResult
} from './contracts';

export { isCanaError, isCanaErrorCode } from './contracts';

export type {
  DatabaseObservation,
  EvictionVerdict,
  StorageEnvironment
} from './core/storage';

export { StorageDurability, browserStorageEnvironment, classifyOpen } from './core/storage';

export type { KeyStrategy } from './core/schema';
export {
  applySchema, assertSchema, keyStrategyOf, validateSchema
} from './core/schema';

export type { OpenOptions, OpenResult } from './core/database';
export { closeDatabase, deleteDatabase, openDatabase } from './core/database';

export { canaError, translateError } from './core/errors';

export * from './core/transaction';
export * from './core/query';
export * from './core/table';
export * from './core/client';
export * from './core/hooks';
export * from './core/durability-policy';
