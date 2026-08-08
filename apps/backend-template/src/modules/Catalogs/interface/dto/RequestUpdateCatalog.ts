export interface RequestUpdateCatalog {
  name?: string;
  description?: string;
  design?: Record<string, any>;
  provenance?: Record<string, any>;
  /** Expected current version — the optimistic-concurrency token (etag). */
  version: number;
}
