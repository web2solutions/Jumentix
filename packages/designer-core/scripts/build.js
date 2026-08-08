#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Build `@jumentix/designer-core` (JUM-493).
 *
 * The designer core's source of truth is `apps/service-management/src/` — the
 * modules the SPA itself runs. This build does three deterministic things:
 *
 * 1. copies exactly the DOM-free module closure (MODULES below) into `dist/`,
 *    preserving the relative layout so the modules' own imports resolve
 *    unchanged;
 * 2. rewrites the barrel (`src/index.js`) into `dist/index.js`, mapping the
 *    workspace-relative specifiers onto the copied tree;
 * 3. generates type declarations from the JSDoc-annotated sources with the
 *    repo-pinned TypeScript compiler, emitted next to each module.
 *
 * The module list is enumerated, not walked: a new file under
 * `apps/service-management/src/` is NOT published until it is named here,
 * which is what keeps a DOM-tainted module from slipping into the artifact
 * unnoticed. `test/packaging.test.ts` asserts the dist file set equals this
 * list; `test/dom-free.test.ts` proves every copied file is DOM-free.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const appSourceRoot = path.join(repoRoot, 'apps', 'service-management', 'src');
const distRoot = path.join(packageRoot, 'dist');

/**
 * The DOM-free module closure, repository-relative to
 * `apps/service-management/src/`. Every entry is also re-exported by
 * `src/index.js`; the two lists are asserted equal by the packaging test.
 *
 * Excluded by policy (the issue's "out" list): `state/designerSync.js` and
 * `state/catalogSyncClient.js` (sync clients that touch ambient storage and
 * the Cana event stream), `store/CanaDesignerStore.js`,
 * `store/canaMigration.js` and `store/designerStoreFactory.js` (storage
 * adapters), and everything under `ui/`, `pwa/` plus `script.js` (DOM).
 */
const MODULES = Object.freeze([
  'model/modelQueries.js',
  'model/rbacContract.js',
  'model/sampleModel.js',
  'model/deployCapabilityMatrix.js',
  'model/interfaceFrameworkMatrix.js',
  'state/designerState.js',
  'validation/modelValidation.js',
  'validation/asyncApi30Validation.js',
  'validation/deployTargetValidation.js',
  'validation/deployTargetLifecycleValidation.js',
  'validation/interfaceAdapterValidation.js',
  'validation/serviceConfigurationValidation.js',
  'exporters/designerExporters.js',
  'exporters/asyncApiExporters.js',
  'importers/designerImporters.js',
  'packages/packageVersioning.js',
  'codegen/hexagonalCodegen.js',
  'store/IDesignerStore.js'
]);

/** The workspace-relative prefix the barrel uses, and its dist replacement. */
const BARREL_SOURCE_PREFIX = '../../../apps/service-management/src/';

function main() {
  fs.rmSync(distRoot, { recursive: true, force: true });

  const missing = MODULES.filter((rel) => !fs.existsSync(path.join(appSourceRoot, rel)));
  if (missing.length > 0) {
    console.error('[designer-core] module(s) named by the build are missing:');
    for (const rel of missing) console.error(`  - apps/service-management/src/${rel}`);
    process.exit(1);
  }

  for (const rel of MODULES) {
    const from = path.join(appSourceRoot, rel);
    const to = path.join(distRoot, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }

  const barrelPath = path.join(packageRoot, 'src', 'index.js');
  const barrel = fs.readFileSync(barrelPath, 'utf8');
  if (!barrel.includes(BARREL_SOURCE_PREFIX)) {
    console.error('[designer-core] src/index.js no longer references the app source tree; nothing to rewrite.');
    process.exit(1);
  }
  fs.writeFileSync(
    path.join(distRoot, 'index.js'),
    barrel.split(BARREL_SOURCE_PREFIX).join('./')
  );

  // Type declarations from the copied JSDoc-annotated sources, emitted next
  // to each module. `process.execPath` rather than a bare `tsc`: the pinned
  // toolchain that is running this script is the one that must compile.
  const tscCli = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tscCli, '-p', 'tsconfig.build.json'], {
    cwd: packageRoot,
    stdio: 'inherit'
  });

  console.log(`[designer-core] built dist/ — ${MODULES.length} modules + index.js + declarations.`);
}

main();
