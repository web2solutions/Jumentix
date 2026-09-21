/**
 * Ambient module for workspace resolution of @jumentix/designer-core.
 * The package ships types from dist/; root build:dev may resolve src/*.js
 * before dist is present. Keep this shim shrink-only (JUM-846).
 */
declare module '@jumentix/designer-core' {
  export function filterOasDocumentForService(
    oas: Record<string, unknown>,
    serviceId: string
  ): Record<string, unknown>;
  export function buildDomainsFromOas(oas: Record<string, unknown>): {
    ok: boolean;
    domains?: unknown;
    architecture?: unknown;
    reason?: string;
  };
  export function buildOasDocumentSet(state: unknown): {
    merged: Record<string, unknown>;
    services: Record<string, Record<string, unknown>>;
  };
  export function buildStateFromSuiteExport(input: unknown): {
    ok: boolean;
    state?: unknown;
    reason?: string;
  };
  export function buildHexagonalBundle(
    state: unknown,
    contracts?: {
      oasDocument?: Record<string, unknown>;
      asyncApiDocument?: Record<string, unknown>;
    }
  ): {
    modules: Array<{
      module: string;
      path: string;
      files: Record<string, { path: string; content: string } | undefined>;
      entities: Array<{
        entity: string;
        files: Record<string, { path: string; content: string }>;
      }>;
    }>;
  };
  export function flattenBundleFiles(bundle: {
    modules: Array<{
      module: string;
      path: string;
      files: Record<string, { path: string; content: string } | undefined>;
      entities: Array<{
        entity: string;
        files: Record<string, { path: string; content: string }>;
      }>;
    }>;
  }): Array<{ path: string; content: string }>;
}
