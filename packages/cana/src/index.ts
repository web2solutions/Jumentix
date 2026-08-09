/**
 * Cana — offline-first IndexedDB database client for Jumentix.
 *
 * Public entry point.
 *
 * Consumers should import from here rather than from `core/*`: the contracts are
 * the stable surface, and the module layout beneath them is not.
 *
 * See documentation/md/CANA-USAGE-GUIDE.md for the task-oriented guide.
 *
 * ## Why every line below is `export *`
 *
 * bun 1.3.14 (the pinned toolchain) tree-shakes named re-exports —
 * `export { x } from './module'` and `import { x } … export { x }` alike —
 * out of a `sideEffects: false` package: the emitted ESM bundle keeps the
 * export statement but drops the definition, leaving dangling bindings that
 * WebKit refuses to link (JUM-629). `export *` marks the re-exported symbols
 * as used and is the only re-export form that survives the bundler.
 *
 * This is safe here only because each of these modules exports exactly the
 * public surface — nothing internal — and no two modules export the same
 * name (a collision under `export *` is silently dropped, not an error).
 * The packaging test asserts both the absence of dangling bindings and the
 * presence of the expected surface, so a module that grows an internal
 * export or a colliding name fails loudly instead of leaking.
 */

/** Runtime marker so the barrel survives bundling into the coverage sourcemap. */
export const CANA_PACKAGE = 'cana' as const;

export * from './contracts';
export * from './core/storage';
export * from './core/schema';
export * from './core/database';
export * from './core/errors';
export * from './core/transaction';
export * from './core/query';
export * from './core/table';
export * from './core/client';
export * from './core/local-storage-backend';
export * from './core/hooks';
export * from './core/durability-policy';
export * from './core/reconciliation';
export * from './core/protocol';
export * from './core/worker-host';
export * from './conformance';
export * from './adapter';
