/**
 * `@jumentix/designer-core` — the framework-free Service Management designer
 * core (JUM-493).
 *
 * This barrel is the package boundary, and it is a *re-export only* boundary:
 * the single source of truth for every module below stays in
 * `apps/service-management/src/`, where the designer SPA and its suites
 * exercise it daily. The build (`scripts/build.js`) copies exactly the modules
 * listed here into `dist/` and rewrites these specifiers to `./…`, so what the
 * workspace imports through this file is what the published artifact ships —
 * no second copy to drift.
 *
 * What is in (per the issue): the domain model and its normalizers, the
 * validation/model-check engine, the exporters (JSON, Markdown, JSON Schema,
 * AsyncAPI, boilerplate bundle, package, OAS), the importers (domain package,
 * state file, OAS file), the schema-diff/merge-preview engine, the hexagonal
 * codegen, and `IDesignerStore` as a *type/contract only*.
 *
 * What is out: every DOM module (`script.js`, `src/ui/`, `src/pwa/`), the
 * status surfaces, the sync clients (`state/designerSync.js`,
 * `state/catalogSyncClient.js`) and the storage adapters
 * (`store/CanaDesignerStore.js`, `store/canaMigration.js`,
 * `store/designerStoreFactory.js`). Nothing below imports Cana, the DOM,
 * `window`, `document` or `localStorage` — `test/dom-free.test.ts` proves it
 * on the built artifact, and `test/consumer-smoke.test.ts` loads and runs the
 * artifact in a non-DOM process.
 */

// The domain model: queries, matrices, RBAC contract and the sample model.
export * from '../../../apps/service-management/src/model/modelQueries.js';
export * from '../../../apps/service-management/src/model/rbacContract.js';
export * from '../../../apps/service-management/src/model/sampleModel.js';
export * from '../../../apps/service-management/src/model/deployCapabilityMatrix.js';
export * from '../../../apps/service-management/src/model/interfaceFrameworkMatrix.js';

// The model normalizers and the designer state shape.
export * from '../../../apps/service-management/src/state/designerState.js';

// The validation / model-check engine.
export * from '../../../apps/service-management/src/validation/modelValidation.js';
export * from '../../../apps/service-management/src/validation/asyncApi30Validation.js';
export * from '../../../apps/service-management/src/validation/deployTargetValidation.js';
export * from '../../../apps/service-management/src/validation/deployTargetLifecycleValidation.js';
export * from '../../../apps/service-management/src/validation/interfaceAdapterValidation.js';
export * from '../../../apps/service-management/src/validation/serviceConfigurationValidation.js';

// The exporters: JSON, Markdown, JSON Schema, AsyncAPI, boilerplate bundle,
// domain package and OAS.
export * from '../../../apps/service-management/src/exporters/designerExporters.js';
export * from '../../../apps/service-management/src/exporters/asyncApiExporters.js';

// The importers: domain package, state file and OAS file.
export * from '../../../apps/service-management/src/importers/designerImporters.js';

// The schema-diff / domain-package versioning and merge-preview engine.
export * from '../../../apps/service-management/src/packages/packageVersioning.js';

// The hexagonal boilerplate codegen behind the bundle exporter.
export * from '../../../apps/service-management/src/codegen/hexagonalCodegen.js';

// The storage port as a contract only — no adapter ships in this package.
export * from '../../../apps/service-management/src/store/IDesignerStore.js';
