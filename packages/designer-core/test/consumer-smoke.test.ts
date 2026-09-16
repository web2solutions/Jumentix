/* eslint-disable @typescript-eslint/no-var-requires, global-require */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ensureDesignerCoreBuilt } from './helpers/build-artifact';

/**
 * Consumer smoke test for `@jumentix/designer-core` (JUM-493).
 *
 * The issue's acceptance bar, executed: the published artifact is imported in
 * a non-DOM environment and runs a validate-and-export round trip. "Imported"
 * means a separate process running the repo-pinned runtime against
 * `dist/index.js` — not an in-process import through a test transform that
 * could quietly shim a global the artifact actually needs.
 *
 * It also pins the surface parity between the two ways the package is
 * consumed: the workspace barrel (`src/index.js`, what in-repo consumers
 * resolve through the `@jumentix/designer-core` alias) and the built artifact
 * (what npm consumers receive) must export exactly the same names.
 */

const packageRoot = path.resolve(__dirname, '..');

interface SmokeResult {
  ok: boolean;
  exportCount: number;
  domainCount: number;
  exports: string[];
}

function runConsumerSmoke(): SmokeResult {
  // `process.execPath` rather than a bare `node` or `bun`: the pinned runtime
  // executing this suite is the one that must be able to load the artifact —
  // under Bun's runner that is Bun, under Jest it is Node.
  const output = execFileSync(
    process.execPath,
    [path.join(packageRoot, 'test', 'fixtures', 'consumer-smoke.mjs')],
    { cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(output.trim().split('\n').pop() || '') as SmokeResult;
}

describe('designer-core consumer smoke (JUM-493)', () => {
  beforeAll(async () => {
    await ensureDesignerCoreBuilt(packageRoot);
  }, 180_000);

  it('loads the built artifact in a non-DOM process and runs a validate/export round trip', () => {
    expect.hasAssertions();
    // The fixture exits non-zero — failing this test through execFileSync —
    // if `window`, `document` or `localStorage` exist in the child process,
    // if the artifact throws at import time, if the sample model does not
    // validate clean, or if the round trip is not deep-equal.
    const result = runConsumerSmoke();

    expect(result.ok).toBe(true);
    expect(result.domainCount).toBeGreaterThan(0);
    expect(result.exportCount).toBeGreaterThan(100);
  });

  it('exports the same surface from the workspace barrel and from the built artifact', () => {
    expect.hasAssertions();
    // Drift between these two is invisible to every in-repo consumer (they
    // only ever see the barrel) and fatal to every npm consumer (they only
    // ever see the artifact). The barrel is required by path, the way every
    // service-management suite loads the first-party JavaScript modules —
    // under Jest the first-party JS transformer compiles it, under Bun it
    // loads as ESM.
    const result = runConsumerSmoke();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const barrel = require(path.join(packageRoot, 'src', 'index.js')) as Record<string, unknown>;

    expect(
      Object.keys(barrel).sort((left, right) => left.localeCompare(right))
    ).toStrictEqual(result.exports);
  });

  it('exports the core surface the issue names — model, validation, exporters, importers, schema-diff', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const barrel = require(path.join(packageRoot, 'src', 'index.js')) as Record<string, unknown>;

    const expected = [
      // model and normalizers
      'normalizeStatePayload', 'createDesignerState', 'buildSampleModelPayload',
      // validation / model-check engine
      'collectModelIssues', 'validateAsyncApi30Document', 'collectServiceConfigurationIssues',
      'collectArchitectureIssues', 'normalizeArchitectureInput',
      // exporters: JSON, Markdown, JSON Schema, AsyncAPI, bundle, package, OAS
      'buildJsonExportDocument', 'buildMarkdownExport', 'buildJsonSchemaDocument',
      'buildAsyncApiTransportDocument', 'buildBoilerplateBundleDocument',
      'buildDomainPackageDocument', 'buildOasDocument', 'buildOasDocumentSet', 'filterOasDocumentForService',
      // importers: domain package, state file, OAS file
      'buildDomainFromPackage', 'buildStateFromSuiteExport', 'buildDomainsFromOas',
      // schema-diff / merge-preview engine
      'buildPackageMerge', 'buildSameVersionConflictPreview',
      // the store contract, as a type
      'IDesignerStore'
    ];
    for (const name of expected) {
      expect(typeof barrel[name]).toBe('function');
    }

    // The "out" list, on the barrel side: no storage adapter, no sync client.
    expect('CanaDesignerStore' in barrel).toBe(false);
    expect('LocalStorageDesignerStore' in barrel).toBe(false);
  });
});
