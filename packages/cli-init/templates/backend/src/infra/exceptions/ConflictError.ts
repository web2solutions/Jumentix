/**
 * Re-exported from `@jumentix/persistence-contracts` (JUM-601).
 *
 * It used to be defined here and imported by `external-store-proxy` through
 * the `@src` alias — a workspace library reaching into this application's
 * source. The definition moved to the contracts package the library can
 * legitimately depend on; this file keeps the application's own import paths
 * working, so nothing else in `apps/backend-template` changed.
 */
export { ConflictError } from '@jumentix/persistence-contracts';
