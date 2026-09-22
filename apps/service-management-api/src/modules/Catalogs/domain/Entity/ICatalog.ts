/**
 * ICatalog — one record of the multi-user shared catalog (JUM-491).
 *
 * The record is the declared unit of optimistic concurrency: it holds exactly
 * one shared domain design (the designer's domain serialization, JUM-547),
 * so a relationship spanning two entities always lives inside the same
 * versioned aggregate. `version` is the server-managed concurrency token
 * (the etag): every write bumps it, and every mutation requires the caller's
 * expected version — a stale write is rejected with the current version so
 * the client can reconcile without losing its edit.
 *
 * `deletedAt` is the tombstone: an empty string means the record is active,
 * an ISO timestamp means it was soft-deleted, and null (assignable through
 * BaseModel's setter) also means active. Deletion propagates to other
 * users through the catalog feed (list with `includeDeleted`) and is
 * recoverable through the restore operation.
 */
export interface ICatalog {
  id: string;
  organization: string;
  name: string;
  description?: string;
  version: number;
  design: Record<string, any>;
  provenance?: Record<string, any>;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: string | null;
}
