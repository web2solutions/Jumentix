/**
 * Browser-side shim for @jumentix/shared-contracts.
 *
 * The real module reads the OpenAPI YAML from disk (node:fs) — it cannot be
 * bundled for the browser. The frontend always injects the bundled OAS into
 * the SDK (requirement 136: the contract is consumed as data), so this shim
 * is only ever a static placeholder: it fails loudly if anything calls it.
 */
export const loadCanonicalSpec = (_input: unknown): never => {
  throw new Error(
    'loadCanonicalSpec is unavailable in the browser — inject the bundled spec '
      + 'from src/contracts/openapi.json instead (requirement 136).'
  );
};
