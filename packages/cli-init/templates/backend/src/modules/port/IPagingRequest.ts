import type { IListSort } from '@jumentix/persistence-contracts';

export interface IPagingRequest {
  page: number,
  size: number;
  /** Ordered sort fields parsed from the `sort` query param (JUM-777). */
  sort?: IListSort[];
  /** Free-text term from the `q` query param (JUM-777). */
  q?: string;
  /** Fields `q` searches, from the operation's `x-list-capabilities.searchable`. */
  searchFields?: string[];
  /** When true, list includes tombstones (`deletedAt` set). Default false. */
  includeDeleted?: boolean;
}
