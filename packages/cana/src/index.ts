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
