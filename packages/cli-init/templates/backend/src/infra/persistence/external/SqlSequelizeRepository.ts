// Split by declaration kind, not by name prefix. `SqlSequelizeRepository` is a
// class and must stay a runtime re-export; `ESqlDialect` is a `type` alias
// despite the E prefix, and `ISqlSequelizeRepositoryOptions` is an interface —
// re-exporting either as a value leaves Bun's ESM runtime looking for a binding
// that type erasure removed.
export type { ESqlDialect, ISqlSequelizeRepositoryOptions } from '@jumentix/external-db-repositories';
export { SqlSequelizeRepository } from '@jumentix/external-db-repositories';
